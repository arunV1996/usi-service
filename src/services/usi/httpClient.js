'use strict';

const https = require('https');
const http = require('http');
const axios = require('axios');
const axiosRetry = require('axios-retry').default;
const { URLSearchParams } = require('url');
const { XMLParser } = require('fast-xml-parser');

const { sha256Hex } = require('../../helpers/crypto');
const auditStore = require('../../helpers/auditStore');
const { get: getLogger } = require('../../helpers/logger');
const { redact } = require('../../helpers/redact');

let _client = null;
let _cfg = null;

function build(cfg) {
  if (_client) return _client;
  _cfg = cfg;

  if (!cfg.usi.baseUrl) throw new Error('USI base URL is not configured');

  const httpsAgent = new https.Agent({
    keepAlive: true,
    maxSockets: cfg.usi.maxSockets,
    // Strict TLS by default. Set to true (default) — never disable.
    rejectUnauthorized: true,
    minVersion: 'TLSv1.2',
  });
  const httpAgent = new http.Agent({ keepAlive: true, maxSockets: cfg.usi.maxSockets });

  _client = axios.create({
    baseURL: cfg.usi.baseUrl,
    timeout: cfg.usi.timeoutMs,
    httpsAgent,
    httpAgent,
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/xml, text/xml',
      'User-Agent': `${cfg.appName}/1.0`,
    },
    // Don't throw on non-2xx — we parse XML to determine success.
    validateStatus: () => true,
    maxContentLength: 5 * 1024 * 1024,
    maxBodyLength: 2 * 1024 * 1024,
  });

  axiosRetry(_client, {
    retries: cfg.usi.maxRetries,
    retryDelay: axiosRetry.exponentialDelay,
    retryCondition: (err) => {
      // Retry only on network errors / 5xx — never on 4xx (idempotency unknown).
      if (axiosRetry.isNetworkOrIdempotentRequestError(err)) return true;
      const status = err.response && err.response.status;
      return status >= 500 && status < 600;
    },
  });

  return _client;
}

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  parseTagValue: false,
  trimValues: true,
  cdataPropName: '__cdata',
});

function parseXml(text) {
  if (!text || typeof text !== 'string') return null;
  try {
    return xmlParser.parse(text);
  } catch (err) {
    return { _parseError: err.message, _raw: text.slice(0, 1000) };
  }
}

function buildIntegrityHash(params, key) {
  // Per USI spec: concatenate all POST params except username, password, pin,
  // id1_scan, id2_scan, then append the key, then SHA-256.
  const exclude = new Set(['username', 'password', 'pin', 'id1_scan', 'id2_scan', 'data_integrity_hash']);
  let concat = '';
  for (const [k, v] of Object.entries(params)) {
    if (exclude.has(k)) continue;
    if (v == null) continue;
    concat += String(v);
  }
  return sha256Hex(concat + key);
}

/**
 * Calls a USI WebService method and returns the parsed response.
 *
 * @param {{ correlationId?: string, group: string, method: string, params?: object }} opts
 */
async function call({ correlationId, group, method, params = {} }) {
  if (!_client) throw new Error('USI client not initialised');
  const cfg = _cfg;
  const log = getLogger();

  const operation = `${group}.${method}`;
  const path = `/${group}/${method}`;

  const fullParams = {
    username: cfg.usi.username,
    password: cfg.usi.password,
    pin: cfg.usi.pin,
    ...Object.fromEntries(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ''),
    ),
  };

  if (cfg.usi.dataIntegrityKey) {
    fullParams.data_integrity_hash = buildIntegrityHash(fullParams, cfg.usi.dataIntegrityKey);
  }

  const form = new URLSearchParams();
  for (const [k, v] of Object.entries(fullParams)) form.append(k, String(v));

  const start = process.hrtime.bigint();
  let response = null;
  let error = null;
  let parsed = null;
  let upstreamStatus = null;

  try {
    response = await _client.post(path, form.toString());
    parsed = parseXml(response.data);
    if (parsed && parsed.response && parsed.response.status) {
      upstreamStatus = parsed.response.status;
    }
  } catch (err) {
    error = { message: err.message, code: err.code };
  }

  const durationMs = Number((process.hrtime.bigint() - start) / 1_000_000n);

  // Build redacted bodies for the audit record. We never persist the URL.
  const redactedRequestBody = redact(
    Object.fromEntries(
      Object.entries(fullParams).map(([k, v]) => {
        if (['username', 'password', 'pin', 'data_integrity_hash'].includes(k)) {
          return [k, '[REDACTED]'];
        }
        return [k, v];
      }),
    ),
  );

  const auditRequest = {
    operation,
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: redactedRequestBody,
  };
  const auditResponse = response
    ? {
      headers: redact(response.headers || {}),
      raw_xml: typeof response.data === 'string' ? response.data : null,
      parsed: parsed,
    }
    : null;

  let auditId = null;
  try {
    auditId = await auditStore.record({
      correlationId,
      operation,
      method: 'POST',
      statusCode: response ? response.status : null,
      durationMs,
      upstreamStatus,
      error,
      request: auditRequest,
      response: auditResponse,
    });
  } catch (auditErr) {
    log.error('audit_record_failed', { correlation_id: correlationId, message: auditErr.message });
  }

  log.info('usi_call', {
    type: 'usi_external_call',
    correlation_id: correlationId,
    operation,
    status: response ? response.status : null,
    upstream_status: upstreamStatus,
    duration_ms: durationMs,
    audit_id: auditId,
    error: error ? { code: error.code, message: error.message } : undefined,
  });

  if (error) {
    return { ok: false, error, auditId, durationMs, status: null, parsed: null };
  }

  return {
    ok: upstreamStatus === 'SUCCESS' && response.status >= 200 && response.status < 300,
    status: response.status,
    upstreamStatus,
    parsed,
    auditId,
    durationMs,
  };
}

module.exports = { build, call };
