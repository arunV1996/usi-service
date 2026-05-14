import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import readline from 'readline';
import { encryptAesGcm, decryptAesGcm, randomId } from './crypto';
import { redact } from './redact';
import type {
  AppConfig,
  AuditEntryInput,
  AuditEntryStored,
  AuditQuery,
  EncryptedPayload,
} from '../types';

let _cfg: AppConfig | null = null;

export function init(cfg: AppConfig): void {
  _cfg = cfg;
  fs.mkdirSync(cfg.logging.auditDir, { recursive: true, mode: 0o750 });
}

function fileFor(date: Date = new Date()): string {
  if (!_cfg) throw new Error('auditStore not initialised');
  const day = date.toISOString().slice(0, 10);
  return path.join(_cfg.logging.auditDir, `external-${day}.ndjson`);
}

/**
 * Records an external API call. Sensitive request/response bodies are
 * encrypted at rest with AES-256-GCM if AUDIT_ENCRYPTION_KEY is set.
 */
export async function record(entry: AuditEntryInput): Promise<string> {
  if (!_cfg) throw new Error('auditStore not initialised');
  const id = entry.id || randomId(12);
  const timestamp = new Date().toISOString();
  const key = _cfg.logging.auditEncryptionKey;

  const safeRequest = redact(entry.request || {});
  const safeResponse = redact(entry.response || {});

  const sealed = { request: safeRequest, response: safeResponse };

  let encrypted: EncryptedPayload | null = null;
  let encryption_error: string | undefined;
  let plain: unknown | undefined;

  if (key) {
    try {
      encrypted = encryptAesGcm(JSON.stringify(sealed), key);
    } catch (err) {
      encryption_error = (err as Error).message;
    }
  } else {
    plain = sealed;
  }

  const line: AuditEntryStored = {
    id,
    timestamp,
    correlation_id: entry.correlationId || null,
    method: entry.method || 'POST',
    operation: entry.operation || null,
    status_code: entry.statusCode == null ? null : entry.statusCode,
    duration_ms: entry.durationMs == null ? null : entry.durationMs,
    upstream_status: entry.upstreamStatus || null,
    error: entry.error || null,
    encrypted,
    ...(encryption_error ? { encryption_error } : {}),
    ...(plain !== undefined ? { plain } : {}),
  };

  await fsp.appendFile(fileFor(), `${JSON.stringify(line)}\n`, { mode: 0o600 });
  return id;
}

async function listFiles(): Promise<string[]> {
  if (!_cfg) throw new Error('auditStore not initialised');
  const files = await fsp.readdir(_cfg.logging.auditDir);
  return files
    .filter((f) => f.startsWith('external-') && f.endsWith('.ndjson'))
    .sort()
    .reverse();
}

export async function query(opts: AuditQuery = {}): Promise<Array<Record<string, unknown>>> {
  if (!_cfg) throw new Error('auditStore not initialised');
  const key = _cfg.logging.auditEncryptionKey;
  const max = Math.min(Math.max(parseInt(String(opts.limit ?? 100), 10) || 100, 1), 500);

  const files = await listFiles();
  const results: Array<Record<string, unknown>> = [];
  const from = opts.fromDate ? new Date(opts.fromDate) : null;
  const to = opts.toDate ? new Date(opts.toDate) : null;

  for (const f of files) {
    if (results.length >= max) break;
    const full = path.join(_cfg.logging.auditDir, f);
    const stream = fs.createReadStream(full, { encoding: 'utf8' });
    const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
    const fileMatches: Array<Record<string, unknown>> = [];
    for await (const raw of rl) {
      if (!raw) continue;
      let entry: AuditEntryStored;
      try {
        entry = JSON.parse(raw);
      } catch {
        continue;
      }
      if (opts.id && entry.id !== opts.id) continue;
      if (opts.correlationId && entry.correlation_id !== opts.correlationId) continue;
      if (opts.operation && entry.operation !== opts.operation) continue;
      if (opts.upstreamStatus && entry.upstream_status !== opts.upstreamStatus) continue;
      if (from && new Date(entry.timestamp) < from) continue;
      if (to && new Date(entry.timestamp) > to) continue;

      let bodies: unknown = null;
      if (opts.includeBodies || opts.id) {
        if (entry.encrypted && key) {
          try {
            const decoded = decryptAesGcm(entry.encrypted, key);
            bodies = decoded ? JSON.parse(decoded) : null;
          } catch {
            bodies = { error: 'decryption_failed' };
          }
        } else if (entry.plain) {
          bodies = entry.plain;
        }
      }
      const { encrypted, plain, ...meta } = entry;
      fileMatches.push(opts.includeBodies || opts.id ? { ...meta, bodies } : meta);
      if (opts.id) break;
    }
    rl.close();
    stream.destroy();
    results.push(...fileMatches.reverse());
    if (opts.id && results.length) break;
  }
  return results.slice(0, max);
}
