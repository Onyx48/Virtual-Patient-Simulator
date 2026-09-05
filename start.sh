#!/usr/bin/env bash
#
# Launcher for the Virtual Patient Simulator (Express API + Vite SPA).
# Run from anywhere; the script cds to the repo root itself.
#
#   ./start.sh                 backend + vite dev server
#   ./start.sh --help          full flag list
#
set -uo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")"

# ---- defaults -------------------------------------------------------------
MODE="dev"          # dev | build | preview | lint
PROD=0              # NODE_ENV=production; implies --preview
RUN_BACKEND=1
RUN_FRONTEND=1
WITH_REDIS=0
INSTALL="auto"      # auto | always | never
BACKEND_PORT=""     # empty -> backend/index.js default (5001)
FRONTEND_PORT=""    # empty -> vite.config.js default (5173)
EXPOSE_HOST=0
OPEN_BROWSER=0

usage() {
  cat <<'EOF'
Usage: ./start.sh [flags]

What to run (default: both):
  -b, --backend-only     Express API only (node backend/index.js)
  -f, --frontend-only    Vite dev server only
  -r, --redis            Also start a local redis-server (OTP + login lockout)

Mode (default: dev):
      --build            Production build (vite build), then exit
      --preview          vite build, then serve the build with vite preview
      --prod             --preview with APP_ENV/NODE_ENV=production for the API
      --lint             eslint . , then exit

Dependencies:
  -i, --install          Force `pnpm install` before starting
      --no-install       Never install, even if node_modules/ is missing

Networking:
  -p, --port <n>         Backend port      (default 5001, sets PORT)
      --frontend-port <n>  Vite port       (default 5173)
      --host             Expose Vite on 0.0.0.0 (LAN / tunnel access)
  -o, --open             Open the app in a browser once Vite is up

Other:
  -h, --help             This message

Notes:
  * .env lives at the repo root and is read via dotenv from the process cwd,
    so the backend is always launched from the root -- not from backend/.
  * MongoDB is required: backend/db.js exits non-zero without MONGODB_URI.
  * Redis is optional: without it the server boots but OTP endpoints refuse.
  * Ctrl-C stops every process this script started.
EOF
}

# ---- flags ----------------------------------------------------------------
while [ $# -gt 0 ]; do
  case "$1" in
    -b|--backend-only)   RUN_FRONTEND=0 ;;
    -f|--frontend-only)  RUN_BACKEND=0 ;;
    -r|--redis)          WITH_REDIS=1 ;;
    --build)             MODE="build" ;;
    --preview)           MODE="preview" ;;
    --prod)              PROD=1; MODE="preview" ;;
    --lint)              MODE="lint" ;;
    -i|--install)        INSTALL="always" ;;
    --no-install)        INSTALL="never" ;;
    -p|--port)           BACKEND_PORT="${2:-}"; shift ;;
    --port=*)            BACKEND_PORT="${1#*=}" ;;
    --frontend-port)     FRONTEND_PORT="${2:-}"; shift ;;
    --frontend-port=*)   FRONTEND_PORT="${1#*=}" ;;
    --host)              EXPOSE_HOST=1 ;;
    -o|--open)           OPEN_BROWSER=1 ;;
    -h|--help)           usage; exit 0 ;;
    *) echo "start.sh: unknown flag '$1' (try --help)" >&2; exit 2 ;;
  esac
  shift
done

if [ "$RUN_BACKEND" = 0 ] && [ "$RUN_FRONTEND" = 0 ]; then
  echo "start.sh: --backend-only and --frontend-only are mutually exclusive" >&2
  exit 2
fi

PM="pnpm"
command -v pnpm >/dev/null 2>&1 || PM="npx --yes pnpm"

# ---- install --------------------------------------------------------------
if [ "$INSTALL" = "always" ] || { [ "$INSTALL" = "auto" ] && [ ! -d node_modules ]; }; then
  echo "==> installing dependencies"
  $PM install || exit 1
fi

# ---- preflight ------------------------------------------------------------
[ -f .env ] && echo "==> using .env at $(pwd)/.env" \
            || echo "!! no .env at repo root -- the backend will exit without MONGODB_URI" >&2

# ---- one-shot modes -------------------------------------------------------
case "$MODE" in
  lint)  echo "==> eslint ."; exec $PM lint ;;
  build) echo "==> vite build"; exec $PM build ;;
esac

# ---- process bookkeeping --------------------------------------------------
PIDS=()
cleanup() {
  trap - INT TERM EXIT
  echo ""
  echo "==> shutting down"
  for pid in "${PIDS[@]:-}"; do
    [ -n "$pid" ] && kill "$pid" 2>/dev/null
  done
  wait 2>/dev/null
}
trap cleanup INT TERM EXIT

start() {  # start <label> <cmd...>
  local label="$1"; shift
  echo "==> $label: $*"
  "$@" &
  PIDS+=("$!")
}

# ---- redis ----------------------------------------------------------------
if [ "$WITH_REDIS" = 1 ]; then
  if command -v redis-server >/dev/null 2>&1; then
    start "redis" redis-server
    sleep 1
  else
    echo "!! --redis given but redis-server is not on PATH; skipping" >&2
  fi
fi

# ---- build before anything long-lived starts ------------------------------
if [ "$MODE" = "preview" ] && [ "$RUN_FRONTEND" = 1 ]; then
  # A production build bakes in the DEPLOYED api base url, so a local preview
  # would call vpsbackend.metawingsxr.com and get blocked by its CORS policy.
  # Point it at the local API instead.
  : "${VITE_API_BASE_URL:=http://localhost:${BACKEND_PORT:-5001}}"
  export VITE_API_BASE_URL
  echo "==> vite build (VITE_API_BASE_URL=$VITE_API_BASE_URL)"
  $PM build || exit 1
  # --prod sets NODE_ENV=production, which turns off the local-origin allowance
  # in the API's CORS check; the preview origin has to be named explicitly.
  PREVIEW_ORIGIN="http://localhost:${FRONTEND_PORT:-4173}"
  export CORS_ORIGINS="${CORS_ORIGINS:+$CORS_ORIGINS,}$PREVIEW_ORIGIN,http://127.0.0.1:${FRONTEND_PORT:-4173}"
fi

# ---- backend --------------------------------------------------------------
if [ "$RUN_BACKEND" = 1 ]; then
  [ -n "$BACKEND_PORT" ] && export PORT="$BACKEND_PORT"
  # APP_ENV drives the API's dev/prod behaviour (error detail, /debug/env, CORS).
  [ "$PROD" = 1 ] && { export NODE_ENV=production; export APP_ENV=production; }
  [ "$PROD" = 1 ] || export APP_ENV="${APP_ENV:-development}"
  start "backend" node backend/index.js
fi

# ---- frontend -------------------------------------------------------------
if [ "$RUN_FRONTEND" = 1 ]; then
  VITE_ARGS=()
  [ -n "$FRONTEND_PORT" ] && VITE_ARGS+=(--port "$FRONTEND_PORT")
  [ "$EXPOSE_HOST" = 1 ]  && VITE_ARGS+=(--host 0.0.0.0)
  [ "$OPEN_BROWSER" = 1 ] && VITE_ARGS+=(--open)

  if [ "$MODE" = "preview" ]; then
    start "vite preview" $PM exec vite preview "${VITE_ARGS[@]+"${VITE_ARGS[@]}"}"
  else
    start "vite" $PM exec vite "${VITE_ARGS[@]+"${VITE_ARGS[@]}"}"
  fi
fi

echo "==> running; Ctrl-C to stop"
wait
