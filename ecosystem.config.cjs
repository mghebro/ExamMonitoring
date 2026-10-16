/**
 * PM2 Ecosystem Configuration for Exam Monitor
 * Tailored for production / self-hosted environments (e.g., Ubuntu server / local machine).
 *
 * Usage:
 *   pnpm pm2:start            # Start all services (API + Worker + Web)
 *   pnpm pm2:start:backend    # Start only API + Polling Worker (if web is hosted on Vercel)
 *   pnpm pm2:status           # Check process status and memory
 *   pnpm pm2:logs             # Stream live logs
 *   pnpm pm2:stop             # Stop all services
 */

module.exports = {
  apps: [
    {
      name: "exam-api",
      script: "apps/api/dist/index.js",
      cwd: "./",
      exec_mode: "fork",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "250M",
      restart_delay: 3000,
      time: true,
      env: {
        NODE_ENV: "production",
      },
    },
    {
      name: "exam-worker",
      script: "apps/worker/dist/index.js",
      cwd: "./",
      exec_mode: "fork",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "250M",
      restart_delay: 5000,
      time: true,
      env: {
        NODE_ENV: "production",
      },
    },
    {
      name: "exam-web",
      script: "apps/web/node_modules/next/dist/bin/next",
      args: "start apps/web -p 3000",
      cwd: "./",
      exec_mode: "fork",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "350M",
      restart_delay: 3000,
      time: true,
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
    },
  ],
};
