'use strict';

const rateLimit = require('express-rate-limit');
const { RedisStore } = require('rate-limit-redis');
const { createClient } = require('redis');

let redisClient = null;

async function buildStore(cfg) {
  if (!cfg.rateLimit.redisUrl) return undefined;
  redisClient = createClient({ url: cfg.rateLimit.redisUrl });
  redisClient.on('error', () => { /* swallowed; logger handles */ });
  await redisClient.connect();
  return new RedisStore({
    sendCommand: (...args) => redisClient.sendCommand(args),
    prefix: 'usi-rl:',
  });
}

async function build(cfg) {
  const store = await buildStore(cfg);
  return rateLimit({
    windowMs: cfg.rateLimit.windowMs,
    max: cfg.rateLimit.max,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    store,
    // Rate limit per authenticated client when available, else per IP.
    keyGenerator: (req) => (req.auth && req.auth.clientId) || req.ip,
    message: { status: 'FAIL', error: { code: 'RATE_LIMITED', message: 'Too many requests' } },
  });
}

async function shutdown() {
  if (redisClient) {
    try { await redisClient.quit(); } catch { /* noop */ }
    redisClient = null;
  }
}

module.exports = { build, shutdown };
