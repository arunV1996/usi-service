import 'dotenv/config';
import path from 'path';
import { loadAll, getSecret } from './secretManager';
import type { AppConfig, InternalClient } from '../types';

function intEnv(name: string, fallback: number): number {
  const v = process.env[name];
  if (v == null || v === '') return fallback;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
}

function boolEnv(name: string, fallback = false): boolean {
  const v = process.env[name];
  if (v == null || v === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(v).toLowerCase());
}

function parseClients(raw: string | undefined): InternalClient[] {
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('INTERNAL_CLIENTS is not valid JSON');
  }
  if (!Array.isArray(parsed)) {
    throw new Error('INTERNAL_CLIENTS must be a JSON array of client objects');
  }
  return (parsed as Array<Record<string, unknown>>).map((c, i) => {
    const fields = ['clientId', 'apiKey', 'secretHeaderName', 'secretHeaderValue', 'signingSecret'];
    for (const f of fields) {
      if (typeof c[f] !== 'string' || (c[f] as string).length === 0) {
        throw new Error(`INTERNAL_CLIENTS[${i}].${f} is missing or empty`);
      }
    }
    return {
      clientId: c['clientId'] as string,
      apiKey: c['apiKey'] as string,
      secretHeaderName: (c['secretHeaderName'] as string).toLowerCase(),
      secretHeaderValue: c['secretHeaderValue'] as string,
      signingSecret: c['signingSecret'] as string,
      scopes: Array.isArray(c['scopes']) ? (c['scopes'] as string[]) : undefined,
    };
  });
}

let resolved: AppConfig | null = null;

export async function build(): Promise<AppConfig> {
  if (resolved) return resolved;
  await loadAll();

  const [
    internalJwtSecret,
    internalApiKeysRaw,
    internalClientsRaw,
    usiBaseUrl,
    usiUsername,
    usiPassword,
    usiPin,
    usiHashKey,
    auditEncKey,
  ] = await Promise.all([
    getSecret('INTERNAL_JWT_SECRET'),
    getSecret('INTERNAL_API_KEYS'),
    getSecret('INTERNAL_CLIENTS'),
    getSecret('USI_BASE_URL'),
    getSecret('USI_USERNAME'),
    getSecret('USI_PASSWORD'),
    getSecret('USI_PIN'),
    getSecret('USI_DATA_INTEGRITY_KEY'),
    getSecret('AUDIT_ENCRYPTION_KEY'),
  ]);

  const env = process.env.NODE_ENV || 'development';
  const isProd = env === 'production';
  const clients = parseClients(internalClientsRaw);
  const strictAuth = boolEnv('STRICT_AUTH', isProd) || clients.length > 0;

  if (isProd) {
    const required: Record<string, string | undefined> = {
      usiBaseUrl,
      usiUsername,
      usiPassword,
      usiPin,
    };
    for (const [k, v] of Object.entries(required)) {
      if (!v) throw new Error(`Missing required production secret: ${k}`);
    }
    if (clients.length === 0) {
      throw new Error('INTERNAL_CLIENTS must define at least one client in production');
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
      clients,
      signatureSkewSec: intEnv('SIGNATURE_SKEW_SEC', 300),
      nonceTtlSec: intEnv('NONCE_TTL_SEC', 900),
      strict: strictAuth,
    },

    rateLimit: {
      windowMs: intEnv('RATE_LIMIT_WINDOW_MS', 60_000),
      max: intEnv('RATE_LIMIT_MAX', 300),
    },

    redis: {
      url: process.env.REDIS_URL || null,
    },

    idempotency: {
      ttlSec: intEnv('IDEMPOTENCY_TTL_SEC', 24 * 60 * 60),
      lockTtlSec: intEnv('IDEMPOTENCY_LOCK_TTL_SEC', 5 * 60),
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
