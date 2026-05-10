'use strict';

const jwt = require('jsonwebtoken');
const { timingSafeEquals } = require('../helpers/crypto');

function unauthorized(res, message = 'Unauthorized') {
  return res.status(401).json({ status: 'FAIL', error: { code: 'UNAUTHORIZED', message } });
}

/**
 * Authenticates internal callers. Accepts either:
 *   1) a Bearer JWT signed with INTERNAL_JWT_SECRET, or
 *   2) an x-api-key matching one of the configured INTERNAL_API_KEYS.
 *
 * In production, deploy this service inside a private subnet behind mTLS too.
 */
module.exports = function auth(cfg) {
  const { jwtSecret, jwtAudience, jwtIssuer, apiKeys } = cfg.auth;
  const apiKeySet = new Set(apiKeys);

  return function (req, res, next) {
    // API key path
    const apiKey = req.header('x-api-key');
    if (apiKey) {
      let matched = false;
      for (const k of apiKeySet) {
        if (timingSafeEquals(k, apiKey)) {
          matched = true;
          break;
        }
      }
      if (!matched) return unauthorized(res, 'Invalid API key');
      req.auth = { method: 'api_key', clientId: 'internal-api-key' };
      return next();
    }

    // JWT path
    const authz = req.header('authorization') || '';
    const m = /^Bearer\s+(.+)$/i.exec(authz);
    if (!m) return unauthorized(res, 'Missing credentials');
    if (!jwtSecret) return unauthorized(res, 'Auth not configured');

    try {
      const decoded = jwt.verify(m[1], jwtSecret, {
        audience: jwtAudience,
        issuer: jwtIssuer,
        algorithms: ['HS256'],
      });
      req.auth = {
        method: 'jwt',
        clientId: decoded.sub || decoded.client_id || 'unknown',
        scopes: decoded.scope ? String(decoded.scope).split(' ') : [],
      };
      return next();
    } catch (err) {
      return unauthorized(res, 'Invalid or expired token');
    }
  };
};
