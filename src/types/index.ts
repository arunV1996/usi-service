export interface InternalClient {
  /** Logical client identifier (e.g. "ledger-service"). Used in logs & idempotency keys. */
  clientId: string;
  /** Value sent in the `x-api-key` header to identify this client. */
  apiKey: string;
  /** Custom header name carrying the shared secret value (name itself is a secret). */
  secretHeaderName: string;
  /** Expected value of that secret header. Compared timing-safely. */
  secretHeaderValue: string;
  /** HMAC-SHA256 signing key for the request signature. */
  signingSecret: string;
  /** Optional capabilities (e.g. ["payout", "read"]). Reserved for future use. */
  scopes?: string[];
}

export interface AppConfig {
  env: string;
  isProd: boolean;
  appName: string;
  host: string;
  port: number;
  trustProxy: number;
  logLevel: string;
  aws: {
    region: string;
    kmsKeyId: string | null;
    secretsEnabled: boolean;
    secretId: string | null;
  };
  auth: {
    /** Legacy JWT bearer auth — kept for non-strict environments. */
    jwtSecret: string;
    jwtAudience: string;
    jwtIssuer: string;
    /** Legacy plain API keys — kept for non-strict environments. */
    apiKeys: string[];
    /** Strong-auth client roster. When non-empty, replaces the legacy paths. */
    clients: InternalClient[];
    /** Acceptable clock skew (seconds) for x-timestamp. */
    signatureSkewSec: number;
    /** TTL for nonce replay-protection entries (seconds). */
    nonceTtlSec: number;
    /** When true, requires the full multi-factor flow even outside production. */
    strict: boolean;
  };
  rateLimit: {
    windowMs: number;
    max: number;
  };
  redis: {
    url: string | null;
  };
  idempotency: {
    /** Cache TTL for idempotent payout responses (seconds). Default 86400 = 24h. */
    ttlSec: number;
    /** TTL for in-flight idempotency locks (seconds). */
    lockTtlSec: number;
  };
  usi: {
    baseUrl: string;
    username: string;
    password: string;
    pin: string;
    dataIntegrityKey: string;
    timeoutMs: number;
    maxRetries: number;
    maxSockets: number;
  };
  logging: {
    dir: string;
    auditDir: string;
    retentionDays: number;
    maxSize: string;
    auditEncryptionKey: string;
  };
  cluster: {
    workers: number;
  };
}

export interface Ctx {
  correlationId: string;
}

export interface AuthContext {
  method: 'api_key' | 'jwt' | 'strong';
  clientId: string;
  scopes?: string[];
}

export interface USICallOptions {
  correlationId?: string | undefined;
  group: string;
  method: string;
  params?: Record<string, unknown>;
}

export interface USIError {
  message: string;
  code?: string | undefined;
}

export interface USIResult {
  ok: boolean;
  error?: USIError | null;
  status: number | null;
  upstreamStatus?: string | null;
  parsed: unknown;
  auditId: string | null;
  durationMs: number;
}

export interface EncryptedPayload {
  alg: 'aes-256-gcm';
  iv: string;
  tag: string;
  data: string;
}

export interface AuditEntryInput {
  id?: string;
  correlationId?: string | undefined;
  operation?: string | undefined;
  method?: string;
  statusCode?: number | null;
  durationMs?: number | null;
  upstreamStatus?: string | null;
  error?: USIError | null;
  request?: unknown;
  response?: unknown;
}

export interface AuditEntryStored {
  id: string;
  timestamp: string;
  correlation_id: string | null;
  method: string;
  operation: string | null;
  status_code: number | null;
  duration_ms: number | null;
  upstream_status: string | null;
  error: USIError | null;
  encrypted: EncryptedPayload | null;
  encryption_error?: string;
  plain?: unknown;
}

export interface AuditQuery {
  id?: string | undefined;
  correlationId?: string | undefined;
  operation?: string | undefined;
  upstreamStatus?: string | undefined;
  fromDate?: string | undefined;
  toDate?: string | undefined;
  limit?: number | string;
  includeBodies?: boolean;
}
