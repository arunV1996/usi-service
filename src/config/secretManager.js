'use strict';

const {
  SecretsManagerClient,
  GetSecretValueCommand,
} = require('@aws-sdk/client-secrets-manager');
const { KMSClient, DecryptCommand } = require('@aws-sdk/client-kms');

const SECRET_KEYS = [
  'INTERNAL_JWT_SECRET',
  'INTERNAL_API_KEYS',
  'USI_BASE_URL',
  'USI_USERNAME',
  'USI_PASSWORD',
  'USI_PIN',
  'USI_DATA_INTEGRITY_KEY',
  'AUDIT_ENCRYPTION_KEY',
];

let cache = null;
let cachePromise = null;

function buildClients(region) {
  return {
    secrets: new SecretsManagerClient({ region, maxAttempts: 3 }),
    kms: new KMSClient({ region, maxAttempts: 3 }),
  };
}

async function fetchSecretsFromAws(secretId, region) {
  const { secrets } = buildClients(region);
  const result = await secrets.send(new GetSecretValueCommand({ SecretId: secretId }));
  if (result.SecretString) {
    try {
      return JSON.parse(result.SecretString);
    } catch (err) {
      throw new Error(`Secret ${secretId} is not valid JSON`);
    }
  }
  if (result.SecretBinary) {
    const buf = Buffer.from(result.SecretBinary);
    return JSON.parse(buf.toString('utf8'));
  }
  throw new Error(`Secret ${secretId} returned no value`);
}

async function decryptEnvelopeIfNeeded(value, region) {
  if (typeof value !== 'string' || !value.startsWith('kms:')) return value;
  const cipherB64 = value.slice('kms:'.length);
  const { kms } = buildClients(region);
  const out = await kms.send(
    new DecryptCommand({ CiphertextBlob: Buffer.from(cipherB64, 'base64') }),
  );
  return Buffer.from(out.Plaintext).toString('utf8');
}

/**
 * Load a single key. Resolution order:
 *   1) cached secret manager payload
 *   2) process.env (env vars in .env)
 * If a value is prefixed with "kms:" it will be decrypted via KMS.
 */
async function getSecret(key) {
  const region = process.env.AWS_REGION || 'us-east-1';
  if (!cache) await loadAll();
  let raw = cache && Object.prototype.hasOwnProperty.call(cache, key)
    ? cache[key]
    : process.env[key];
  if (raw == null || raw === '') return undefined;
  return decryptEnvelopeIfNeeded(raw, region);
}

async function loadAll() {
  if (cache) return cache;
  if (cachePromise) return cachePromise;

  cachePromise = (async () => {
    const enabled = String(process.env.SECRETS_MANAGER_ENABLED || 'false').toLowerCase() === 'true';
    const secretId = process.env.SECRETS_MANAGER_SECRET_ID;
    const region = process.env.AWS_REGION || 'us-east-1';

    let payload = {};
    if (enabled && secretId) {
      try {
        payload = await fetchSecretsFromAws(secretId, region);
      } catch (err) {
        // Fail closed in production: refuse to start with a misconfigured secret.
        if (process.env.NODE_ENV === 'production') throw err;
        // In non-prod, log and fall back to env.
        // eslint-disable-next-line no-console
        console.warn(`[secretManager] falling back to env. Reason: ${err.message}`);
      }
    }

    // Materialise into one map: secret manager values take priority over env.
    const merged = {};
    for (const k of SECRET_KEYS) {
      if (payload && Object.prototype.hasOwnProperty.call(payload, k) && payload[k] !== '') {
        merged[k] = payload[k];
      } else if (process.env[k] != null && process.env[k] !== '') {
        merged[k] = process.env[k];
      }
    }
    cache = merged;
    return cache;
  })();
  return cachePromise;
}

function clearCache() {
  cache = null;
  cachePromise = null;
}

module.exports = { loadAll, getSecret, clearCache, SECRET_KEYS };
