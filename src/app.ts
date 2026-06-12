import express, { Application, Request, Response } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import hpp from 'hpp';
import compression from 'compression';

import correlation from './middleware/correlation';
import requestLogger from './middleware/requestLogger';
import buildAuth from './middleware/auth';
import buildIdempotency from './middleware/idempotency';
import { build as buildRateLimit } from './middleware/rateLimit';
import routes from './routes';
import { notFound, errorHandler } from './middleware/errorHandler';
import type { AppConfig } from './types';

// Sub-paths of /v1/transactions that move money and therefore require an
// Idempotency-Key (createTransaction + confirmTransaction). Read-only status
// lookups and quote endpoints are excluded.
const PAYOUT_SUBPATHS = new Set(['/', '/confirm']);

export function buildApp(cfg: AppConfig): Application {
  const app = express();

  app.set('trust proxy', cfg.trustProxy);
  app.disable('x-powered-by');
  app.disable('etag');

  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'same-origin' },
      hsts: cfg.isProd ? { maxAge: 63_072_000, includeSubDomains: true, preload: true } : false,
      referrerPolicy: { policy: 'no-referrer' },
    }),
  );

  app.use(cors({ origin: false }));

  app.use(compression());
  // Capture raw body bytes for HMAC signature verification.
  app.use(
    express.json({
      limit: '256kb',
      verify: (req, _res, buf) => {
        (req as Request).rawBody = Buffer.from(buf);
      },
    }),
  );
  app.use(
    express.urlencoded({
      extended: false,
      limit: '256kb',
      verify: (req, _res, buf) => {
        (req as Request).rawBody = Buffer.from(buf);
      },
    }),
  );
  app.use(hpp());

  app.use(correlation);

  app.get('/healthz', (_req: Request, res: Response) =>
    res.json({ status: 'ok', uptime: process.uptime() }),
  );
  app.get('/readyz', (_req: Request, res: Response) => res.json({ status: 'ok' }));

  app.use(buildRateLimit(cfg));

  // Apply auth + access log to everything under /v1.
  app.use('/v1', buildAuth(cfg), requestLogger());

  // Idempotency runs after auth but before the route handler, only for
  // money-moving transaction endpoints. req.path here is relative to the
  // mount point (`/v1/transactions`).
  const idem = buildIdempotency(cfg);
  app.use('/v1/transactions', (req, res, next) => {
    if (req.method === 'POST' && PAYOUT_SUBPATHS.has(req.path)) {
      idem(req, res, next);
      return;
    }
    next();
  });

  app.use('/v1', routes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
