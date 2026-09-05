/**
 * pm2 process list for the deployed app.
 *
 *   pm2 start ecosystem.config.cjs
 *   pm2 save                          # persist for reboot (only after list changes)
 *
 * The frontend is a static build, so `pm2 restart vps-frontend` does NOT pick up
 * code changes — run `pnpm build` first. VITE_* vars are baked into that build.
 *
 * Deliberately no APP_ENV / NODE_ENV here: pm2 re-injects whatever env a process
 * was started with on every restart, and dotenv will not overwrite an
 * already-set variable. Setting the mode here would make .env unable to change
 * it without a `pm2 delete`. Let .env be the single source of truth.
 */
const path = require("path");

const ROOT = __dirname;

module.exports = {
  apps: [
    {
      name: "vps-backend",
      script: "backend/index.js",
      // dotenv resolves .env from the process cwd, and .env lives at the repo
      // root. Starting from backend/ would silently lose MONGODB_URI.
      cwd: ROOT,
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      max_memory_restart: "500M",
      error_file: path.join(ROOT, "logs/backend-error.log"),
      out_file: path.join(ROOT, "logs/backend-out.log"),
      time: true,
    },
    {
      name: "vps-frontend",
      // Static SPA: every unknown path must fall through to index.html or a
      // hard refresh on /scenarios/add 404s.
      script: "npx",
      args: "--yes serve dist --single --listen 5173",
      cwd: ROOT,
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      time: true,
    },
  ],
};
