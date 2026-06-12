import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from '@aws-sdk/client-secrets-manager';
import { KMSClient, DecryptCommand } from '@aws-sdk/client-kms';

export const SECRET_KEYS = [
  'INTERNAL_JWT_SECRET',
  'INTERNAL_API_KEYS',
  // Strong-auth client roster — JSON array of InternalClient objects.
  'INTERNAL_CLIENTS',
  'USI_BASE_URL',
  'USI_USERNAME',
  'USI_PASSWORD',
  'USI_PIN',
  'USI_DATA_INTEGRITY_KEY',
  'AUDIT_ENCRYPTION_KEY',
] as const;

export type SecretKey = (typeof SECRET_KEYS)[number];

type SecretMap = Partial<Record<string, string>>;

let cache: SecretMap | null = null;
let cachePromise: Promise<SecretMap> | null = null;

function buildClients(region: string): { secrets: SecretsManagerClient; kms: KMSClient } {
  return {
    secrets: new SecretsManagerClient({ region, maxAttempts: 3 }),
    kms: new KMSClient({ region, maxAttempts: 3 }),
  };
}

async function fetchSecretsFromAws(secretId: string, region: string): Promise<Record<string, string>> {
  const { secrets } = buildClients(region);
  const result = await secrets.send(new GetSecretValueCommand({ SecretId: secretId }));
  if (result.SecretString) {
    try {
      return JSON.parse(result.SecretString) as Record<string, string>;
    } catch {
      throw new Error(`Secret ${secretId} is not valid JSON`);
    }
  }
  if (result.SecretBinary) {
    const buf = Buffer.from(result.SecretBinary as Uint8Array);
    return JSON.parse(buf.toString('utf8')) as Record<string, string>;
  }
  throw new Error(`Secret ${secretId} returned no value`);
}

async function decryptEnvelopeIfNeeded(value: string | undefined, region: string): Promise<string | undefined> {
  if (typeof value !== 'string' || !value.startsWith('kms:')) return value;
  const cipherB64 = value.slice('kms:'.length);
  const { kms } = buildClients(region);
  const out = await kms.send(
    new DecryptCommand({ CiphertextBlob: Buffer.from(cipherB64, 'base64') }),
  );
  if (!out.Plaintext) throw new Error('KMS decrypt returned empty plaintext');
  return Buffer.from(out.Plaintext as Uint8Array).toString('utf8');
}

/**
 * Loads (and caches) a single secret. Order: cached secret-manager value, then env.
 * Values prefixed with "kms:" are decrypted via KMS at read-time.
 */
export async function getSecret(key: SecretKey): Promise<string | undefined> {
  const region = process.env.AWS_REGION || 'us-east-1';
  if (!cache) await loadAll();
  const raw = cache && Object.prototype.hasOwnProperty.call(cache, key)
    ? cache[key]
    : process.env[key];
  if (raw == null || raw === '') return undefined;
  return decryptEnvelopeIfNeeded(raw, region);
}

export async function loadAll(): Promise<SecretMap> {
  if (cache) return cache;
  if (cachePromise) return cachePromise;

  cachePromise = (async () => {
    const enabled = String(process.env.SECRETS_MANAGER_ENABLED || 'false').toLowerCase() === 'true';
    const secretId = process.env.SECRETS_MANAGER_SECRET_ID;
    const region = process.env.AWS_REGION || 'us-east-1';

    let payload: Record<string, string> = {};
    if (enabled && secretId) {
      try {
        payload = await fetchSecretsFromAws(secretId, region);
      } catch (err) {
        if (process.env.NODE_ENV === 'production') throw err;
        // eslint-disable-next-line no-console
        console.warn(`[secretManager] falling back to env. Reason: ${(err as Error).message}`);
      }
    }

    const merged: SecretMap = {};
    for (const k of SECRET_KEYS) {
      if (payload && Object.prototype.hasOwnProperty.call(payload, k) && payload[k] !== '') {
        merged[k] = payload[k];
      } else if (process.env[k] != null && process.env[k] !== '') {
        merged[k] = process.env[k] as string;
      }
    }
    cache = merged;
    return cache;
  })();
  return cachePromise;
}

export function clearCache(): void {
  cache = null;
  cachePromise = null;
}
