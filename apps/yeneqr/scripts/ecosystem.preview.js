// ============================================================
// YeneQR — Local Preview PM2 Ecosystem (dev mode)
// Runs `next dev` so we can verify UI fixes without going
// through the broken standalone build (next-themes 0.4.6 +
// Next.js 16 has an SSG crash on _global-error / _not-found
// when ThemeProvider is in the root layout).
// ============================================================
module.exports = {
  apps: [{
    name: 'yeneqr',
    script: 'node_modules/next/dist/bin/next',
    args: 'dev -p 3000',
    cwd: '/home/z/my-project/YeneQR_token2',
    env: {
      NODE_ENV: 'development',
      PORT: '3000',
      HOSTNAME: '0.0.0.0',
      DATABASE_URL: 'file:/home/z/my-project/YeneQR_token2/db/yeneqr.db',
      JWT_SECRET: 'yene-qr-dev-jwt-secret-preview',
      QR_SECRET: 'yene-qr-dev-hmac-secret-preview',
      CRON_SECRET: 'yene-qr-dev-cron-secret-preview',
      NEXT_PUBLIC_BASE_URL: 'http://localhost:3000',
      NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
    },
    instances: 1,
    autorestart: true,
    max_restarts: 10,
    restart_delay: 5000,
    watch: false,
    max_memory_restart: '1G',
    out_file: '/home/z/my-project/YeneQR_token2/.pm2-logs/out.log',
    error_file: '/home/z/my-project/YeneQR_token2/.pm2-logs/err.log',
    time: true,
  }]
};
