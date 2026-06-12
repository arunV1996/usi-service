import crypto from 'crypto';
import type { Request, Response, NextFunction, RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { timingSafeEquals, sha256Hex } from '../helpers/crypto';
import { setNx } from '../helpers/kvStore';
import { get as getLogger } from '../helpers/logger';
import type { AppConfig, InternalClient } from '../types';

function unauthorized(res: Response, code: string, message: string): void {
  res.status(401).json({ status: 'FAIL', error: { code, message } });
}

/**
 * Identifies an InternalClient by API key in constant time.
 * Returns the matching client or null. Avoids early-exit timing leaks by
 * scanning the full set even when a match is found.
 */
function lookupClient(apiKey: string, clients: InternalClient[]): InternalClient | null {
  let match: InternalClient | null = null;
  for (const c of clients) {
    if (timingSafeEquals(c.apiKey, apiKey) && !match) match = c;
  }
  return match;
}

/**
 * Computes the canonical string the client must HMAC-sign.
 *
 *   <METHOD>\n<PATH>\n<SORTED_QUERY>\n<SHA256(BODY)>\n<TIMESTAMP_MS>\n<NONCE>
 *
 * Notes:
 *  - PATH is the originalUrl path component (without query string).
 *  - SORTED_QUERY is `k=v&k=v` with keys lexicographically sorted, raw values.
 *  - BODY is the raw request body bytes (empty string when none).
 *  - TIMESTAMP_MS is the value of `x-timestamp` (unix millis as string).
 *  - NONCE is the value of `x-nonce`.
 */
function canonicalString(req: Request, bodyHash: string, timestamp: string, nonce: string): string {
  const fullUrl = req.originalUrl || req.url;
  const [pathOnly, query = ''] = fullUrl.split('?');
  const sortedQuery = query
    ? query.split('&').filter(Boolean).sort().join('&')
    : '';
  return [req.method.toUpperCase(), pathOnly, sortedQuery, bodyHash, timestamp, nonce].join('\n');
}

function hmacHex(secret: string, payload: string): string {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

/**
 * Strong, multi-factor authenticator for internal callers.
 *
 *   1. `x-api-key` identifies the client (constant-time lookup).
 *   2. The client's configured secret header (name itself is a secret) must
 *      carry the expected value (timing-safe compare).
 *   3. `x-timestamp` must be within ±SIGNATURE_SKEW_SEC of server time.
 *   4. `x-nonce` must be unused (SET-NX in Redis with NONCE_TTL_SEC).
 *   5. `x-signature` must equal HMAC-SHA256(signingSecret, canonicalString).
 *
 * On success `req.auth` is populated. On any failure a 401 is returned with
 * a generic code — diagnostic detail is logged server-side only.
 */
function strongAuth(cfg: AppConfig): RequestHandler {
  const { clients, signatureSkewSec, nonceTtlSec } = cfg.auth;

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const log = getLogger();
    const reject = (reason: string): void => {
      log.warn('auth_failed', { correlation_id: req.correlationId, reason });
      unauthorized(res, 'UNAUTHORIZED', 'Authentication failed');
    };

    const apiKey = req.header('x-api-key');
    if (!apiKey) return reject('missing_api_key');

    const client = lookupClient(apiKey, clients);
    if (!client) return reject('unknown_api_key');

    // Per-client custom secret header (name itself is a secret).
    const secretValue = req.header(client.secretHeaderName);
    if (!secretValue || !timingSafeEquals(secretValue, client.secretHeaderValue)) {
      return reject('bad_secret_header');
    }

    const timestampHeader = req.header('x-timestamp');
    const nonce = req.header('x-nonce');
    const signature = req.header('x-signature');
    if (!timestampHeader || !nonce || !signature) {
      return reject('missing_signature_headers');
    }

    const ts = Number.parseInt(timestampHeader, 10);
    if (!Number.isFinite(ts)) return reject('bad_timestamp');
    const skew = Math.abs(Date.now() - ts);
    if (skew > signatureSkewSec * 1000) return reject('timestamp_skew');

    if (!/^[A-Za-z0-9._-]{8,128}$/.test(nonce)) return reject('bad_nonce_format');

    // Replay protection: nonce must be unseen.
    const nonceKey = `nonce:${client.clientId}:${nonce}`;
    const fresh = await setNx(nonceKey, '1', nonceTtlSec);
    if (!fresh) return reject('nonce_replay');

    const bodyBuf = req.rawBody || Buffer.alloc(0);
    const bodyHash = sha256Hex(bodyBuf);
    const canonical = canonicalString(req, bodyHash, timestampHeader, nonce);
    const expected = hmacHex(client.signingSecret, canonical);
    if (!timingSafeEquals(expected, signature)) return reject('bad_signature');

    req.auth = { method: 'strong', clientId: client.clientId, scopes: client.scopes };
    next();
  };
}

/**
 * Legacy fallback: x-api-key (timing-safe) OR Bearer JWT (HS256).
 * Used outside production when STRICT_AUTH is not set and no clients are
 * defined. Convenient for local development.
 */
function legacyAuth(cfg: AppConfig): RequestHandler {
  const { jwtSecret, jwtAudience, jwtIssuer, apiKeys } = cfg.auth;
  const apiKeySet = new Set(apiKeys);

  return (req: Request, res: Response, next: NextFunction): void => {
    const apiKey = req.header('x-api-key');
    if (apiKey) {
      let matched = false;
      for (const k of apiKeySet) {
        if (timingSafeEquals(k, apiKey)) {
          matched = true;
          break;
        }
      }
      if (!matched) {
        unauthorized(res, 'UNAUTHORIZED', 'Invalid API key');
        return;
      }
      req.auth = { method: 'api_key', clientId: 'internal-api-key' };
      next();
      return;
    }

    const authz = req.header('authorization') || '';
    const m = /^Bearer\s+(.+)$/i.exec(authz);
    if (!m) {
      unauthorized(res, 'UNAUTHORIZED', 'Missing credentials');
      return;
    }
    if (!jwtSecret) {
      unauthorized(res, 'UNAUTHORIZED', 'Auth not configured');
      return;
    }

    try {
      const decoded = jwt.verify(m[1] as string, jwtSecret, {
        audience: jwtAudience,
        issuer: jwtIssuer,
        algorithms: ['HS256'],
      }) as jwt.JwtPayload;
      req.auth = {
        method: 'jwt',
        clientId: (decoded.sub as string) || (decoded['client_id'] as string) || 'unknown',
        scopes: decoded['scope'] ? String(decoded['scope']).split(' ') : [],
      };
      next();
    } catch {
      unauthorized(res, 'UNAUTHORIZED', 'Invalid or expired token');
    }
  };
}

/**
 * Picks the strong-auth flow when `STRICT_AUTH=true` or a non-empty
 * `INTERNAL_CLIENTS` roster is configured; falls back to the legacy api-key /
 * JWT path otherwise.
 */
export default function auth(cfg: AppConfig): RequestHandler {
  return cfg.auth.strict ? strongAuth(cfg) : legacyAuth(cfg);
}
