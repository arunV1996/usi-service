'use strict';

require('dotenv').config();
const path = require('path');
const { loadAll, getSecret } = require('./secretManager');

function intEnv(name, fallback) {
  const v = process.env[name];
  if (v == null || v === '') return fallback;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
}

function boolEnv(name, fallback = false) {
  const v = process.env[name];
  if (v == null || v === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(v).toLowerCase());
}

let resolved = null;

async function build() {
  if (resolved) return resolved;
  await loadAll();

  const [
    internalJwtSecret,
    internalApiKeysRaw,
    usiBaseUrl,
    usiUsername,
    usiPassword,
    usiPin,
    usiHashKey,
    auditEncKey,
  ] = await Promise.all([
    getSecret('INTERNAL_JWT_SECRET'),
    getSecret('INTERNAL_API_KEYS'),
    getSecret('USI_BASE_URL'),
    getSecret('USI_USERNAME'),
    getSecret('USI_PASSWORD'),
    getSecret('USI_PIN'),
    getSecret('USI_DATA_INTEGRITY_KEY'),
    getSecret('AUDIT_ENCRYPTION_KEY'),
  ]);

  const env = process.env.NODE_ENV || 'development';
  const isProd = env === 'production';

  if (isProd) {
    const required = { internalJwtSecret, usiBaseUrl, usiUsername, usiPassword, usiPin };
    for (const [k, v] of Object.entries(required)) {
      if (!v) throw new Error(`Missing required production secret: ${k}`);
    }
  }

  resolved = {
    env,
    isProd,
    appName: process.env.APP_NAME || 'usi-payout-service',
    host: process.env.HOST || '0.0.0.0',
    port: intEnv('PORT', 8080),
    trustProxy: intEnv('TRUST_PROXY', 1),
    logLevel: process.env.LOG_LEVEL || 'info',

    aws: {
      region: process.env.AWS_REGION || 'us-east-1',
      kmsKeyId: process.env.KMS_KEY_ID || null,
      secretsEnabled: boolEnv('SECRETS_MANAGER_ENABLED', false),
      secretId: process.env.SECRETS_MANAGER_SECRET_ID || null,
    },

    auth: {
      jwtSecret: internalJwtSecret || '',
      jwtAudience: process.env.INTERNAL_JWT_AUDIENCE || 'usi-payout-service',
      jwtIssuer: process.env.INTERNAL_JWT_ISSUER || 'internal-auth',
      apiKeys: (internalApiKeysRaw || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    },

    rateLimit: {
      windowMs: intEnv('RATE_LIMIT_WINDOW_MS', 60_000),
      max: intEnv('RATE_LIMIT_MAX', 300),
      redisUrl: process.env.REDIS_URL || null,
    },

    usi: {
      baseUrl: (usiBaseUrl || '').replace(/\/+$/, ''),
      username: usiUsername || '',
      password: usiPassword || '',
      pin: usiPin || '',
      dataIntegrityKey: usiHashKey || '',
      timeoutMs: intEnv('USI_TIMEOUT_MS', 15_000),
      maxRetries: intEnv('USI_MAX_RETRIES', 2),
      maxSockets: intEnv('USI_MAX_SOCKETS', 200),
    },

    logging: {
      dir: process.env.LOG_DIR || path.resolve(process.cwd(), 'logs'),
      auditDir: process.env.AUDIT_LOG_DIR || path.resolve(process.cwd(), 'logs', 'audit'),
      retentionDays: intEnv('LOG_RETENTION_DAYS', 30),
      maxSize: process.env.LOG_MAX_SIZE || '50m',
      auditEncryptionKey: auditEncKey || '',
    },

    cluster: {
      workers: intEnv('CLUSTER_WORKERS', 0),
    },
  };
  return resolved;
}

module.exports = { build };
