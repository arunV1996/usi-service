'use strict';

const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const readline = require('readline');
const { encryptAesGcm, decryptAesGcm, randomId } = require('./crypto');
const { redact } = require('./redact');

let _cfg = null;

function init(cfg) {
  _cfg = cfg;
  fs.mkdirSync(cfg.logging.auditDir, { recursive: true, mode: 0o750 });
}

function fileFor(date = new Date()) {
  const day = date.toISOString().slice(0, 10);
  return path.join(_cfg.logging.auditDir, `external-${day}.ndjson`);
}

/**
 * Records an external API call. Sensitive request/response bodies are
 * encrypted at rest with AES-256-GCM if AUDIT_ENCRYPTION_KEY is set.
 *
 * Callers must already pass `request.headers` / `request.body` with
 * sensitive fields redacted. We additionally redact again to be safe and
 * encrypt the full sealed payload.
 */
async function record(entry) {
  if (!_cfg) throw new Error('auditStore not initialised');
  const id = entry.id || randomId(12);
  const timestamp = new Date().toISOString();
  const key = _cfg.logging.auditEncryptionKey;

  const safeRequest = redact(entry.request || {});
  const safeResponse = redact(entry.response || {});

  const sealed = {
    request: safeRequest,
    response: safeResponse,
  };

  let payload;
  if (key) {
    try {
      payload = { encrypted: encryptAesGcm(JSON.stringify(sealed), key) };
    } catch (err) {
      // If encryption fails, store metadata only — never write raw bodies.
      payload = { encrypted: null, encryption_error: err.message };
    }
  } else {
    payload = { encrypted: null, plain: sealed };
  }

  const line = {
    id,
    timestamp,
    correlation_id: entry.correlationId || null,
    method: entry.method || 'POST',
    operation: entry.operation || null, // e.g. "transaction.createTransaction"
    status_code: entry.statusCode == null ? null : entry.statusCode,
    duration_ms: entry.durationMs == null ? null : entry.durationMs,
    upstream_status: entry.upstreamStatus || null, // SUCCESS / FAIL parsed from XML
    error: entry.error || null,
    ...payload,
  };

  await fsp.appendFile(fileFor(), `${JSON.stringify(line)}\n`, { mode: 0o600 });
  return id;
}

async function listFiles() {
  const files = await fsp.readdir(_cfg.logging.auditDir);
  return files.filter((f) => f.startsWith('external-') && f.endsWith('.ndjson')).sort().reverse();
}

/**
 * Returns audit entries matching the supplied filters.
 * Headers/bodies are decrypted only at retrieval time.
 */
async function query({
  id,
  correlationId,
  operation,
  upstreamStatus,
  fromDate,
  toDate,
  limit = 100,
  includeBodies = false,
} = {}) {
  if (!_cfg) throw new Error('auditStore not initialised');
  const key = _cfg.logging.auditEncryptionKey;
  const max = Math.min(Math.max(parseInt(limit, 10) || 100, 1), 500);

  const files = await listFiles();
  const results = [];
  const from = fromDate ? new Date(fromDate) : null;
  const to = toDate ? new Date(toDate) : null;

  for (const f of files) {
    if (results.length >= max) break;
    const full = path.join(_cfg.logging.auditDir, f);
    const stream = fs.createReadStream(full, { encoding: 'utf8' });
    const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
    // Buffer this file's matches then prepend so newest comes first.
    const fileMatches = [];
    for await (const raw of rl) {
      if (!raw) continue;
      let entry;
      try {
        entry = JSON.parse(raw);
      } catch {
        continue;
      }
      if (id && entry.id !== id) continue;
      if (correlationId && entry.correlation_id !== correlationId) continue;
      if (operation && entry.operation !== operation) continue;
      if (upstreamStatus && entry.upstream_status !== upstreamStatus) continue;
      if (from && new Date(entry.timestamp) < from) continue;
      if (to && new Date(entry.timestamp) > to) continue;

      let bodies = null;
      if (includeBodies || id) {
        if (entry.encrypted && key) {
          try {
            bodies = JSON.parse(decryptAesGcm(entry.encrypted, key));
          } catch (err) {
            bodies = { error: 'decryption_failed' };
          }
        } else if (entry.plain) {
          bodies = entry.plain;
        }
      }
      const { encrypted, plain, ...meta } = entry;
      fileMatches.push(includeBodies || id ? { ...meta, bodies } : meta);
      if (id) break;
    }
    rl.close();
    stream.destroy();
    results.push(...fileMatches.reverse());
    if (id && results.length) break;
  }
  return results.slice(0, max);
}

module.exports = { init, record, query };
