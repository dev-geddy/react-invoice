#!/usr/bin/env bash
# @spec L2-DEVOPS-15
# pm2 entrypoint for the Next standalone server. Loads the instance env, then
# execs node so pm2 supervises the server process itself (no bash wrapper pid).
# APP_DIR (= /var/www/<domain>) and APP_PORT come from the pm2 ecosystem —
# multi-instance: one droplet can run several instances, each with its own
# dir + port. The live release sits behind the $APP_DIR/current symlink.
set -euo pipefail

: "${APP_DIR:?APP_DIR not set (pm2 ecosystem provides it)}"

set -a
source "$APP_DIR/.env"
source "$APP_DIR/.env.local"
set +a

export NODE_ENV=production PORT="${APP_PORT:-3070}" HOSTNAME=127.0.0.1   # loopback only — the reverse proxy (nginx/Caddy) fronts it

exec node "$APP_DIR/current/apps/web/server.js"
