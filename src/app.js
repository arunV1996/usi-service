'use strict';

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const hpp = require('hpp');
const compression = require('compression');

const correlation = require('./middleware/correlation');
const requestLogger = require('./middleware/requestLogger');
const buildAuth = require('./middleware/auth');
const { build: buildRateLimit } = require('./middleware/rateLimit');
const routes = require('./routes');
const { notFound, errorHandler } = require('./middleware/errorHandler');

async function buildApp(cfg) {
  const app = express();

  app.set('trust proxy', cfg.trustProxy);
  app.disable('x-powered-by');
  app.disable('etag');

  app.use(helmet({
    contentSecurityPolicy: false, // pure JSON API; no HTML rendered
    crossOriginResourcePolicy: { policy: 'same-origin' },
    hsts: cfg.isProd ? { maxAge: 63_072_000, includeSubDomains: true, preload: true } : false,
    referrerPolicy: { policy: 'no-referrer' },
  }));

  // CORS is intentionally locked down — internal callers only.
  app.use(cors({ origin: false }));

  app.use(compression());
  app.use(express.json({ limit: '256kb' }));
  app.use(express.urlencoded({ extended: false, limit: '256kb' }));
  app.use(hpp());

  app.use(correlation);

  // Health endpoint MUST be reachable without auth for load balancers.
  app.get('/healthz', (_req, res) => res.json({ status: 'ok', uptime: process.uptime() }));
  app.get('/readyz', (_req, res) => res.json({ status: 'ok' }));

  const limiter = await buildRateLimit(cfg);
  app.use(limiter);

  // All business endpoints require authentication.
  app.use('/v1', buildAuth(cfg), requestLogger(), routes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

module.exports = { buildApp };
