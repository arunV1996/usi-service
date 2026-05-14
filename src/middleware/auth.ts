import type { Request, Response, NextFunction, RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { timingSafeEquals } from '../helpers/crypto';
import type { AppConfig } from '../types';

function unauthorized(res: Response, message = 'Unauthorized'): Response {
  return res.status(401).json({ status: 'FAIL', error: { code: 'UNAUTHORIZED', message } });
}

/**
 * Authenticates internal callers. Accepts either:
 *   1) a Bearer JWT signed with INTERNAL_JWT_SECRET, or
 *   2) an x-api-key matching one of the configured INTERNAL_API_KEYS.
 */
export default function auth(cfg: AppConfig): RequestHandler {
  const { jwtSecret, jwtAudience, jwtIssuer, apiKeys } = cfg.auth;
  const apiKeySet = new Set(apiKeys);

  return function (req: Request, res: Response, next: NextFunction): void {
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
        unauthorized(res, 'Invalid API key');
        return;
      }
      req.auth = { method: 'api_key', clientId: 'internal-api-key' };
      next();
      return;
    }

    const authz = req.header('authorization') || '';
    const m = /^Bearer\s+(.+)$/i.exec(authz);
    if (!m) {
      unauthorized(res, 'Missing credentials');
      return;
    }
    if (!jwtSecret) {
      unauthorized(res, 'Auth not configured');
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
      unauthorized(res, 'Invalid or expired token');
    }
  };
}
