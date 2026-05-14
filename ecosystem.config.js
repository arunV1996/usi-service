// PM2 process manager config — alternative to docker cluster mode.
// Build first:  npm run build
// Run with:     pm2 start ecosystem.config.js --env production
module.exports = {
  apps: [
    {
      name: 'usi-payout-service',
      script: 'dist/server.js',
      exec_mode: 'cluster',
      instances: 'max',
      max_memory_restart: '512M',
      kill_timeout: 30000,
      wait_ready: false,
      env_production: { NODE_ENV: 'production' },
    },
  ],
};
