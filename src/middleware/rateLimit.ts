import rateLimit, { RateLimitRequestHandler, Store } from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import type { Request } from 'express';
import { getRedis } from '../helpers/kvStore';
import type { AppConfig } from '../types';

function buildStore(): Store | undefined {
  const redis = getRedis();
  if (!redis) return undefined;
  return new RedisStore({
    sendCommand: ((...args: string[]) =>
      redis.sendCommand(args)) as unknown as (...args: string[]) => Promise<never>,
    prefix: 'usi-rl:',
  }) as unknown as Store;
}

export function build(cfg: AppConfig): RateLimitRequestHandler {
  const store = buildStore();
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
