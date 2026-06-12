import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { sha256Hex } from '../helpers/crypto';
import { get as getLogger } from '../helpers/logger';
import * as kv from '../helpers/kvStore';
import type { AppConfig } from '../types';

const KEY_PATTERN = /^[A-Za-z0-9._-]{8,128}$/;

interface CompletedEntry {
  status: 'complete';
  statusCode: number;
  body: unknown;
  fingerprint: string;
  storedAt: string;
}

interface InFlightEntry {
  status: 'in-progress';
  fingerprint: string;
  startedAt: string;
}

type StoredEntry = CompletedEntry | InFlightEntry;

function fail(res: Response, status: number, code: string, message: string): void {
  res.status(status).json({ status: 'FAIL', error: { code, message } });
}

/**
 * Idempotency for money-moving (payout) endpoints.
 *
 * Contract:
 *   - The caller MUST send an `Idempotency-Key` header (8–128 chars,
 *     [A-Za-z0-9._-]).
 *   - A first request with a key is processed normally; its response (any
 *     2xx/4xx) is cached for IDEMPOTENCY_TTL_SEC (default 24h).
 *   - A repeat of the same key + same body fingerprint replays the cached
 *     response (with `x-idempotent-replay: true`).
 *   - A repeat of the same key with a different body returns 422
 *     IDEMPOTENCY_CONFLICT.
 *   - A repeat while the first call is still in flight returns 409
 *     IDEMPOTENCY_IN_PROGRESS.
 *   - 5xx responses are NOT cached so the client can retry safely.
 *
 * Keys are namespaced per client (`idem:<clientId>:<idemKey>`) so two clients
 * can independently reuse the same key string.
 */
export default function idempotency(cfg: AppConfig): RequestHandler {
  const ttl = cfg.idempotency.ttlSec;
  const lockTtl = cfg.idempotency.lockTtlSec;
  const log = getLogger();

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const idemKey = req.header('idempotency-key');
    if (!idemKey) {
      return fail(
        res,
        400,
        'IDEMPOTENCY_KEY_REQUIRED',
        'Idempotency-Key header is required for payout endpoints',
      );
    }
    if (!KEY_PATTERN.test(idemKey)) {
      return fail(
        res,
        400,
        'IDEMPOTENCY_KEY_INVALID',
        'Idempotency-Key must be 8–128 chars of [A-Za-z0-9._-]',
      );
    }

    const clientId = (req.auth && req.auth.clientId) || 'anon';
    const storeKey = `idem:${clientId}:${idemKey}`;
    const bodyBytes = req.rawBody || Buffer.from(JSON.stringify(req.body ?? ''));
    const fingerprint = sha256Hex(bodyBytes);

    let existingRaw: string | null = null;
    try {
      existingRaw = await kv.get(storeKey);
    } catch (err) {
      log.error('idempotency_get_failed', {
        correlation_id: req.correlationId,
        message: (err as Error).message,
      });
    }

    if (existingRaw) {
      let existing: StoredEntry | null = null;
      try {
        existing = JSON.parse(existingRaw) as StoredEntry;
      } catch {
        /* fall through, treat as fresh */
      }
      if (existing) {
        if (existing.status === 'in-progress') {
          return fail(res, 409, 'IDEMPOTENCY_IN_PROGRESS', 'Request is being processed');
        }
        if (existing.fingerprint !== fingerprint) {
          return fail(
            res,
            422,
            'IDEMPOTENCY_CONFLICT',
            'Idempotency-Key was previously used with a different request body',
          );
        }
        res.setHeader('x-idempotent-replay', 'true');
        res.setHeader('x-idempotent-stored-at', existing.storedAt);
        res.status(existing.statusCode).json(existing.body);
        return;
      }
    }

    // Acquire in-flight lock. If another worker grabbed it first, surface 409.
    const lockEntry: InFlightEntry = {
      status: 'in-progress',
      fingerprint,
      startedAt: new Date().toISOString(),
    };
    let acquired = true;
    try {
      acquired = await kv.setNx(storeKey, JSON.stringify(lockEntry), lockTtl);
    } catch (err) {
      log.error('idempotency_lock_failed', {
        correlation_id: req.correlationId,
        message: (err as Error).message,
      });
    }
    if (!acquired) {
      return fail(res, 409, 'IDEMPOTENCY_IN_PROGRESS', 'Request is being processed');
    }

    // Hook into res.json to capture the final response and persist it.
    const origJson = res.json.bind(res);
    res.json = (body: unknown): Response => {
      const code = res.statusCode;
      if (code >= 500) {
        // Don't cache server errors — release the lock so the client may retry.
        kv.del(storeKey).catch((e) =>
          log.error('idempotency_release_failed', {
            correlation_id: req.correlationId,
            message: (e as Error).message,
          }),
        );
      } else {
        const completed: CompletedEntry = {
          status: 'complete',
          statusCode: code,
          body,
          fingerprint,
          storedAt: new Date().toISOString(),
        };
        kv.set(storeKey, JSON.stringify(completed), ttl).catch((e) =>
          log.error('idempotency_store_failed', {
            correlation_id: req.correlationId,
            message: (e as Error).message,
          }),
        );
      }
      return origJson(body);
    };

    next();
  };
}
