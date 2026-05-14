import express, { Application, Request, Response } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import hpp from 'hpp';
import compression from 'compression';

import correlation from './middleware/correlation';
import requestLogger from './middleware/requestLogger';
import buildAuth from './middleware/auth';
import { build as buildRateLimit } from './middleware/rateLimit';
import routes from './routes';
import { notFound, errorHandler } from './middleware/errorHandler';
import type { AppConfig } from './types';

export async function buildApp(cfg: AppConfig): Promise<Application> {
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
  app.use(express.json({ limit: '256kb' }));
  app.use(express.urlencoded({ extended: false, limit: '256kb' }));
  app.use(hpp());

  app.use(correlation);

  app.get('/healthz', (_req: Request, res: Response) =>
    res.json({ status: 'ok', uptime: process.uptime() }),
  );
  app.get('/readyz', (_req: Request, res: Response) => res.json({ status: 'ok' }));

  const limiter = await buildRateLimit(cfg);
  app.use(limiter);

  app.use('/v1', buildAuth(cfg), requestLogger(), routes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
