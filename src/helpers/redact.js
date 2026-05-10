'use strict';

// Field names whose values must NEVER be written to logs.
// Comparison is case-insensitive; partial matches handled below.
const SENSITIVE_KEYS = new Set([
  'username',
  'password',
  'pin',
  'data_integrity_hash',
  'authorization',
  'cookie',
  'set-cookie',
  'x-api-key',
  'apikey',
  'token',
  'access_token',
  'refresh_token',
  'jwt',
  'secret',

  // Account / financial
  'account_number',
  'iban',
  'benef_bank_iban',
  'benef_bank_swift_code',
  'benef_bank_ifsc_code',
  'card_number',
  'cvv',
  'cvc',

  // PII often in payloads we must not log raw
  'national_id_number',
  'id_details',
  'id_scan',
  'id_scan1',
  'id_scan2',
  'id_scan3',
  'id1_scan',
  'id2_scan',
  'kyc_video',
  'mobile',
  'telephone',
  'email',
  'dob',
  'collection_pin',
]);

// Substrings that, if found in a key, mark the value as sensitive.
const SENSITIVE_SUBSTRINGS = [
  'password',
  'secret',
  'token',
  'apikey',
  'api_key',
  'authorization',
  'iban',
  'swift',
  'ifsc',
  'cardnumber',
  'card_number',
  'cvv',
  'integrity_hash',
  'id_scan',
  'kyc',
];

// Forbidden pieces that must never appear in logs even as values
// (e.g. base URL of the third-party). These are hashed instead.
const FORBIDDEN_VALUE_KEYS = new Set([
  'baseurl',
  'base_url',
  'host',
  'url',
  'endpoint',
  'domain',
]);

const MAX_STRING = 4 * 1024;

function isSensitiveKey(key) {
  if (!key) return false;
  const k = String(key).toLowerCase();
  if (SENSITIVE_KEYS.has(k)) return true;
  return SENSITIVE_SUBSTRINGS.some((s) => k.includes(s));
}

function isForbiddenContextKey(key) {
  if (!key) return false;
  const k = String(key).toLowerCase().replace(/[-_]/g, '');
  return FORBIDDEN_VALUE_KEYS.has(k);
}

function maskString(s) {
  if (s == null) return s;
  const str = String(s);
  if (str.length <= 4) return '***';
  return `${str.slice(0, 2)}***${str.slice(-2)}`;
}

function truncate(s) {
  const str = String(s);
  return str.length > MAX_STRING ? `${str.slice(0, MAX_STRING)}…[truncated]` : str;
}

function redact(value, keyPath = '') {
  if (value == null) return value;
  if (Array.isArray(value)) return value.map((v, i) => redact(v, `${keyPath}[${i}]`));
  if (typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (isSensitiveKey(k)) {
        out[k] = typeof v === 'string' ? maskString(v) : '[REDACTED]';
      } else if (isForbiddenContextKey(k)) {
        out[k] = '[REDACTED:URL]';
      } else {
        out[k] = redact(v, k);
      }
    }
    return out;
  }
  if (typeof value === 'string') return truncate(value);
  return value;
}

module.exports = { redact, isSensitiveKey, maskString };
