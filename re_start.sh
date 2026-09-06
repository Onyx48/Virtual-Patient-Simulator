#!/usr/bin/env bash
#
# Recreate the backend pm2 process from ecosystem.config.cjs.
#
#   ./re_start.sh
#
# Use this when the pm2 entry itself needs rebuilding — wrong cwd, a stale
# environment pm2 keeps re-injecting, or adopting ecosystem.config.cjs for the
# first time. For an ordinary code deploy `pm2 restart vps-backend --update-env`
# is enough and leaves the process list alone.
#
# Does NOT pull or build. Run `git pull && pnpm build` yourself first if the
# frontend changed — the SPA is served from static dist/ and pm2 cannot rebuild
# it.
set -uo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")"

echo "==> repo: $(pwd)"

if [ ! -f ecosystem.config.cjs ]; then
  echo "!! ecosystem.config.cjs not found in $(pwd)" >&2
  exit 1
fi

# .env is read by dotenv from the process cwd, and ecosystem.config.cjs pins cwd
# to this directory. Without .env the backend exits on a missing MONGODB_URI.
[ -f .env ] || echo "!! no .env here -- the backend will exit without MONGODB_URI" >&2

# Delete is allowed to fail: the process may already be gone, which is fine.
echo "==> deleting vps-backend (ok if it does not exist)"
pm2 delete vps-backend || true

echo "==> starting vps-backend from ecosystem.config.cjs"
pm2 start ecosystem.config.cjs --only vps-backend || exit 1

# The process list changed, so persist it or a reboot loses the backend.
echo "==> saving process list"
pm2 save || exit 1

pm2 ls
echo "==> done; tail the log with: pm2 logs vps-backend"
