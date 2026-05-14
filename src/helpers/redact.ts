// Field names whose values must NEVER be written to logs.
// Comparison is case-insensitive; partial matches handled below.
const SENSITIVE_KEYS = new Set<string>([
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

const FORBIDDEN_VALUE_KEYS = new Set<string>([
  'baseurl',
  'base_url',
  'host',
  'url',
  'endpoint',
  'domain',
]);

const MAX_STRING = 4 * 1024;

export function isSensitiveKey(key: string): boolean {
  if (!key) return false;
  const k = String(key).toLowerCase();
  if (SENSITIVE_KEYS.has(k)) return true;
  return SENSITIVE_SUBSTRINGS.some((s) => k.includes(s));
}

function isForbiddenContextKey(key: string): boolean {
  if (!key) return false;
  const k = String(key).toLowerCase().replace(/[-_]/g, '');
  return FORBIDDEN_VALUE_KEYS.has(k);
}

export function maskString(s: unknown): string {
  if (s == null) return '';
  const str = String(s);
  if (str.length <= 4) return '***';
  return `${str.slice(0, 2)}***${str.slice(-2)}`;
}

function truncate(s: string): string {
  return s.length > MAX_STRING ? `${s.slice(0, MAX_STRING)}…[truncated]` : s;
}

export function redact<T = unknown>(value: T): T {
  return redactInner(value) as T;
}

function redactInner(value: unknown): unknown {
  if (value == null) return value;
  if (Array.isArray(value)) return value.map((v) => redactInner(v));
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (isSensitiveKey(k)) {
        out[k] = typeof v === 'string' ? maskString(v) : '[REDACTED]';
      } else if (isForbiddenContextKey(k)) {
        out[k] = '[REDACTED:URL]';
      } else {
        out[k] = redactInner(v);
      }
    }
    return out;
  }
  if (typeof value === 'string') return truncate(value);
  return value;
}
