'use strict';

const { build: buildConfig } = require('./config');
const loggerHelper = require('./helpers/logger');
const auditStore = require('./helpers/auditStore');
const usiClient = require('./services/usi/httpClient');
const { buildApp } = require('./app');
const { shutdown: shutdownRateLimit } = require('./middleware/rateLimit');

async function start() {
  const cfg = await buildConfig();
  loggerHelper.build(cfg);
  auditStore.init(cfg);
  usiClient.build(cfg);

  const app = await buildApp(cfg);
  const log = loggerHelper.get();

  const server = app.listen(cfg.port, cfg.host, () => {
    log.info('server_started', {
      pid: process.pid,
      host: cfg.host,
      port: cfg.port,
      env: cfg.env,
    });
  });

  server.keepAliveTimeout = 65_000;
  server.headersTimeout = 66_000;

  const shutdown = async (signal) => {
    log.info('server_shutdown', { signal });
    server.close(async () => {
      try { await shutdownRateLimit(); } catch (_) { /* noop */ }
      process.exit(0);
    });
    // Force-exit if we hang past 30s.
    setTimeout(() => process.exit(1), 30_000).unref();
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('unhandledRejection', (err) => log.error('unhandled_rejection', { err: err && err.message }));
  process.on('uncaughtException', (err) => {
    log.error('uncaught_exception', { err: err.message, stack: err.stack });
    shutdown('uncaughtException');
  });
}

if (require.main === module) {
  start().catch((err) => {
    // eslint-disable-next-line no-console
    console.error('Fatal startup error:', err);
    process.exit(1);
  });
}

module.exports = { start };
