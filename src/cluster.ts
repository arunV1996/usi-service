// Multi-process bootstrap. Use this entrypoint behind a load balancer to
// saturate all CPU cores on a single host.

import cluster from 'cluster';
import os from 'os';

if (cluster.isPrimary) {
  const desired = Number.parseInt(process.env.CLUSTER_WORKERS || '', 10);
  const workers = Number.isFinite(desired) && desired > 0 ? desired : os.cpus().length;
  // eslint-disable-next-line no-console
  console.log(`[cluster] primary ${process.pid} forking ${workers} workers`);
  for (let i = 0; i < workers; i += 1) cluster.fork();

  cluster.on('exit', (worker, code, signal) => {
    // eslint-disable-next-line no-console
    console.warn(`[cluster] worker ${worker.process.pid} exited (${signal || code}); respawning`);
    cluster.fork();
  });
} else {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('./server').start().catch((err: unknown) => {
    // eslint-disable-next-line no-console
    console.error('[cluster] worker startup failed:', err);
    process.exit(1);
  });
}
