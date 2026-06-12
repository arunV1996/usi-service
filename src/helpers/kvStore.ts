import { createClient } from 'redis';
import type { AppConfig } from '../types';

type RedisLike = ReturnType<typeof createClient>;

let redis: RedisLike | null = null;
let initPromise: Promise<void> | null = null;

interface MemEntry {
  value: string;
  expiresAt: number;
}

const mem = new Map<string, MemEntry>();

function pruneMem(): void {
  const now = Date.now();
  for (const [k, v] of mem) if (v.expiresAt < now) mem.delete(k);
}

export async function init(cfg: AppConfig): Promise<void> {
  if (initPromise) return initPromise;
  if (!cfg.redis.url) return;
  initPromise = (async () => {
    const c = createClient({ url: cfg.redis.url as string });
    c.on('error', () => {
      /* logger handles, swallow */
    });
    await c.connect();
    redis = c;
  })();
  return initPromise;
}

export function getRedis(): RedisLike | null {
  return redis;
}

export function backend(): 'redis' | 'memory' {
  return redis ? 'redis' : 'memory';
}

/**
 * SET key value EX ttl NX. Returns true if the key was written, false if it
 * already existed. Useful for distributed locks (nonces, idempotency starts).
 */
export async function setNx(key: string, value: string, ttlSec: number): Promise<boolean> {
  if (redis) {
    const r = await redis.set(key, value, { EX: ttlSec, NX: true });
    return r === 'OK';
  }
  pruneMem();
  if (mem.has(key)) return false;
  mem.set(key, { value, expiresAt: Date.now() + ttlSec * 1000 });
  return true;
}

export async function set(key: string, value: string, ttlSec: number): Promise<void> {
  if (redis) {
    await redis.set(key, value, { EX: ttlSec });
    return;
  }
  mem.set(key, { value, expiresAt: Date.now() + ttlSec * 1000 });
}

export async function get(key: string): Promise<string | null> {
  if (redis) {
    const v = await redis.get(key);
    return v ?? null;
  }
  pruneMem();
  const entry = mem.get(key);
  if (!entry || entry.expiresAt < Date.now()) {
    mem.delete(key);
    return null;
  }
  return entry.value;
}

export async function del(key: string): Promise<void> {
  if (redis) {
    await redis.del(key);
    return;
  }
  mem.delete(key);
}

export async function shutdown(): Promise<void> {
  if (redis) {
    try {
      await redis.quit();
    } catch {
      /* noop */
    }
    redis = null;
  }
  mem.clear();
  initPromise = null;
}
