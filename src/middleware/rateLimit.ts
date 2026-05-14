import rateLimit, { RateLimitRequestHandler, Store } from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { createClient } from 'redis';
import type { Request } from 'express';
import type { AppConfig } from '../types';

type RedisLike = ReturnType<typeof createClient>;
let redisClient: RedisLike | null = null;

async function buildStore(cfg: AppConfig): Promise<Store | undefined> {
  if (!cfg.rateLimit.redisUrl) return undefined;
  redisClient = createClient({ url: cfg.rateLimit.redisUrl });
  redisClient.on('error', () => {
    /* logger handles, swallowed here */
  });
  await redisClient.connect();
  return new RedisStore({
    // rate-limit-redis expects a sendCommand returning a redis reply; cast through unknown.
    sendCommand: ((...args: string[]) =>
      (redisClient as RedisLike).sendCommand(args)) as unknown as (...args: string[]) => Promise<never>,
    prefix: 'usi-rl:',
  }) as unknown as Store;
}

export async function build(cfg: AppConfig): Promise<RateLimitRequestHandler> {
  const store = await buildStore(cfg);
  return rateLimit({
    windowMs: cfg.rateLimit.windowMs,
    max: cfg.rateLimit.max,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    ...(store ? { store } : {}),
    keyGenerator: (req: Request) => (req.auth && req.auth.clientId) || req.ip || 'unknown',
    message: {
      status: 'FAIL',
      error: { code: 'RATE_LIMITED', message: 'Too many requests' },
    },
  });
}

export async function shutdown(): Promise<void> {
  if (redisClient) {
    try {
      await redisClient.quit();
    } catch {
      /* noop */
    }
    redisClient = null;
  }
}
