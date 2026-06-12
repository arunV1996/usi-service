import { build as buildConfig } from './config';
import * as loggerHelper from './helpers/logger';
import * as auditStore from './helpers/auditStore';
import * as kvStore from './helpers/kvStore';
import * as usiClient from './services/usi/httpClient';
import { buildApp } from './app';

export async function start(): Promise<void> {
  const cfg = await buildConfig();
  loggerHelper.build(cfg);
  auditStore.init(cfg);
  await kvStore.init(cfg);
  usiClient.build(cfg);

  const app = buildApp(cfg);
  const log = loggerHelper.get();

  if (!cfg.redis.url && cfg.auth.strict) {
    log.warn('redis_not_configured_strict_auth', {
      message:
        'STRICT_AUTH is on but REDIS_URL is unset. Nonce replay protection and idempotency are using an in-process memory fallback — only safe for single-process dev.',
    });
  }

  const server = app.listen(cfg.port, cfg.host, () => {
    log.info('server_started', {
      pid: process.pid,
      host: cfg.host,
      port: cfg.port,
      env: cfg.env,
      auth_mode: cfg.auth.strict ? 'strong' : 'legacy',
      kv_backend: kvStore.backend(),
    });
  });

  server.keepAliveTimeout = 65_000;
  server.headersTimeout = 66_000;

  const shutdown = async (signal: string): Promise<void> => {
    log.info('server_shutdown', { signal });
    server.close(async () => {
      try {
        await kvStore.shutdown();
      } catch {
        /* noop */
      }
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 30_000).unref();
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('unhandledRejection', (err) =>
    log.error('unhandled_rejection', { err: err instanceof Error ? err.message : String(err) }),
  );
  process.on('uncaughtException', (err: Error) => {
    log.error('uncaught_exception', { err: err.message, stack: err.stack });
    void shutdown('uncaughtException');
  });
}

if (require.main === module) {
  start().catch((err: unknown) => {
    // eslint-disable-next-line no-console
    console.error('Fatal startup error:', err);
    process.exit(1);
  });
}
