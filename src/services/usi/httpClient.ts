import https from 'https';
import http from 'http';
import axios, { AxiosInstance, AxiosResponse } from 'axios';
import axiosRetry from 'axios-retry';
import { URLSearchParams } from 'url';
import { XMLParser } from 'fast-xml-parser';

import { sha256Hex } from '../../helpers/crypto';
import * as auditStore from '../../helpers/auditStore';
import { get as getLogger } from '../../helpers/logger';
import { redact } from '../../helpers/redact';
import type { AppConfig, USICallOptions, USIError, USIResult } from '../../types';

let _client: AxiosInstance | null = null;
let _cfg: AppConfig | null = null;

export function build(cfg: AppConfig): AxiosInstance {
  if (_client) return _client;
  _cfg = cfg;

  if (!cfg.usi.baseUrl) throw new Error('USI base URL is not configured');

  const httpsAgent = new https.Agent({
    keepAlive: true,
    maxSockets: cfg.usi.maxSockets,
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
    validateStatus: () => true,
    maxContentLength: 5 * 1024 * 1024,
    maxBodyLength: 2 * 1024 * 1024,
  });

  axiosRetry(_client, {
    retries: cfg.usi.maxRetries,
    retryDelay: axiosRetry.exponentialDelay,
    retryCondition: (err) => {
      if (axiosRetry.isNetworkOrIdempotentRequestError(err)) return true;
      const status = err.response && err.response.status;
      return typeof status === 'number' && status >= 500 && status < 600;
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

function parseXml(text: unknown): unknown {
  if (!text || typeof text !== 'string') return null;
  try {
    return xmlParser.parse(text);
  } catch (err) {
    return { _parseError: (err as Error).message, _raw: text.slice(0, 1000) };
  }
}

function buildIntegrityHash(params: Record<string, unknown>, key: string): string {
  const exclude = new Set([
    'username',
    'password',
    'pin',
    'id1_scan',
    'id2_scan',
    'data_integrity_hash',
  ]);
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
 */
export async function call({ correlationId, group, method, params = {} }: USICallOptions): Promise<USIResult> {
  if (!_client || !_cfg) throw new Error('USI client not initialised');
  const cfg = _cfg;
  const log = getLogger();

  const operation = `${group}.${method}`;
  const apiPath = `/${group}/${method}`;

  const fullParams: Record<string, string> = {
    username: cfg.usi.username,
    password: cfg.usi.password,
    pin: cfg.usi.pin,
    ...Object.fromEntries(
      Object.entries(params)
        .filter(([, v]) => v !== undefined && v !== null && v !== '')
        .map(([k, v]) => [k, String(v)]),
    ),
  };

  if (cfg.usi.dataIntegrityKey) {
    fullParams['data_integrity_hash'] = buildIntegrityHash(fullParams, cfg.usi.dataIntegrityKey);
  }

  const form = new URLSearchParams();
  for (const [k, v] of Object.entries(fullParams)) form.append(k, v);

  const start = process.hrtime.bigint();
  let response: AxiosResponse | null = null;
  let error: USIError | null = null;
  let parsed: unknown = null;
  let upstreamStatus: string | null = null;

  try {
    const r: AxiosResponse = await _client.post(apiPath, form.toString());
    response = r;
    parsed = parseXml(r.data);
    const parsedTyped = parsed as { response?: { status?: string } } | null;
    if (parsedTyped && parsedTyped.response && parsedTyped.response.status) {
      upstreamStatus = parsedTyped.response.status;
    }
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    error = { message: e.message, code: e.code };
  }

  const durationMs = Number((process.hrtime.bigint() - start) / 1_000_000n);

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
        parsed,
      }
    : null;

  let auditId: string | null = null;
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
    log.error('audit_record_failed', {
      correlation_id: correlationId,
      message: (auditErr as Error).message,
    });
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
    ok: upstreamStatus === 'SUCCESS' && response!.status >= 200 && response!.status < 300,
    status: response!.status,
    upstreamStatus,
    parsed,
    auditId,
    durationMs,
  };
}
