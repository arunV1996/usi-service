import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { timingSafeEquals } from '../helpers/crypto';
import { get as getLogger } from '../helpers/logger';
import type { AppConfig, InternalClient } from '../types';

function unauthorized(res: Response, message = 'Unauthorized'): void {
  res.status(401).json({ status: 'FAIL', error: { code: 'UNAUTHORIZED', message } });
}

/**
 * Lighter authenticator for the read-only /v1/audit/* endpoints.
 *
 * Only the `x-api-key` header is validated (timing-safe). No signature,
 * no nonce, no secret-header pair. This lets operators inspect upstream
 * call records with a simple curl while the rest of the API keeps the
 * full 4-factor strong auth.
 *
 * If `INTERNAL_CLIENTS` is configured, the key must match one of those
 * entries' `apiKey`. Otherwise falls back to the legacy `INTERNAL_API_KEYS`
 * list so dev workflows keep working.
 */
export default function auditAuth(cfg: AppConfig): RequestHandler {
  const clients = cfg.auth.clients;
  const legacyKeys = new Set(cfg.auth.apiKeys);

  return (req: Request, res: Response, next: NextFunction): void => {
    const log = getLogger();
    const apiKey = req.header('x-api-key');
    if (!apiKey) {
      log.warn('audit_auth_failed', {
        correlation_id: req.correlationId,
        reason: 'missing_api_key',
      });
      unauthorized(res, 'x-api-key is required');
      return;
    }

    // Strong-auth roster takes priority.
    if (clients.length > 0) {
      let matched: InternalClient | null = null;
      for (const c of clients) {
        if (timingSafeEquals(c.apiKey, apiKey) && !matched) matched = c;
      }
      if (!matched) {
        log.warn('audit_auth_failed', {
          correlation_id: req.correlationId,
          reason: 'unknown_api_key',
        });
        unauthorized(res, 'Invalid API key');
        return;
      }
      req.auth = { method: 'api_key', clientId: matched.clientId, scopes: matched.scopes };
      next();
      return;
    }

    // Legacy fallback (dev / non-strict).
    let ok = false;
    for (const k of legacyKeys) {
      if (timingSafeEquals(k, apiKey)) {
        ok = true;
        break;
      }
    }
    if (!ok) {
      log.warn('audit_auth_failed', {
        correlation_id: req.correlationId,
        reason: 'unknown_api_key_legacy',
      });
      unauthorized(res, 'Invalid API key');
      return;
    }
    req.auth = { method: 'api_key', clientId: 'legacy-api-key' };
    next();
  };
}
