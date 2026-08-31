#!/usr/bin/env bash
# @spec L2-DEVOPS-15
# Roll a pm2-flavor instance back to the previous release: flip the `current`
# symlink to the inactive blue/green slot and restart pm2. No build, no sync,
# no migrations — seconds, not minutes.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/common.sh
source "$SCRIPT_DIR/lib/common.sh"

usage() {
  cat <<'USAGE'
Roll back to the previous release (the inactive blue/green slot) and restart pm2.
Refuses when the inactive slot holds no usable release.

Note: migrations are NOT reverted — the schema stays as the release being rolled
back from left it. Roll back code, not data.

Usage:
  ./devops/rollback-for-pm2.sh -h <host> -i <path-to-ssh-key> -d <domain>
                               [-n <app-name>] [--app-port <port>] [-u user] [-p port]

  -h  droplet host or IP        (required)
  -i  ssh private key path      (required)
  -d  domain of this instance   (required — keys the deploy dir /var/www/<domain>)
  -n  app/instance name         (default: backflip — must match the deploy -n)
  --app-port  app loopback port (default: 3070 — must match the deploy --app-port)
  -u  ssh user                  (default: root)
  -p  ssh port                  (default: 22)
USAGE
}

HOST=""
SSH_KEY=""
SSH_USER="root"
SSH_PORT="22"
DOMAIN=""

while [ $# -gt 0 ]; do
  case "$1" in
    -h|--host)      require_arg "$1" "${2:-}"; HOST="$2"; shift 2 ;;
    -i|--identity)  require_arg "$1" "${2:-}"; SSH_KEY="$2"; shift 2 ;;
    -d|--domain)    require_arg "$1" "${2:-}"; DOMAIN="$2"; shift 2 ;;
    -n|--app-name)  require_arg "$1" "${2:-}"; APP_NAME="$2"; shift 2 ;;
    --app-port)     require_arg "$1" "${2:-}"; APP_PORT="$2"; shift 2 ;;
    -u|--user)      require_arg "$1" "${2:-}"; SSH_USER="$2"; shift 2 ;;
    -p|--port)      require_arg "$1" "${2:-}"; SSH_PORT="$2"; shift 2 ;;
    --help)         usage; exit 0 ;;
    *)              die_usage "unknown argument: $1" ;;
  esac
done

[ -n "$HOST" ] || die_usage "-h <host> is required"
[ -n "$SSH_KEY" ] || die_usage "-i <path-to-ssh-key> is required"
[ -n "$DOMAIN" ] || die_usage "-d <domain> is required"
REMOTE_DIR="/var/www/$DOMAIN"

# --- preflight ---
require_file "$SSH_KEY" "ssh private key not found"
preflight_ssh "check host, key, port"

# --- switch slots (app user: pm2 + the symlink it serves) ---
log "rolling back $APP_NAME in $REMOTE_DIR (as $APP_USER)"
remote_script slot-switch.sh \
  "sudo -H -u $APP_USER REMOTE_DIR='$REMOTE_DIR' APP_NAME='$APP_NAME' APP_PORT='$APP_PORT' NEEDS_NVM=yes"

# --- health check ---
log "health check"
PM2_STATUS="$(pm2_health yes)"

if [ "$PM2_STATUS" != "online" ]; then
  warn "pm2 reports $APP_NAME status: ${PM2_STATUS:-unknown}"
  pm2_logs_tail yes
  die "app process is not online after rollback"
fi
ok "pm2 online"

CODE="$(http_health)"
case "$CODE" in
  000) die "no HTTP response on port 80. Check: pm2 logs $APP_NAME / systemctl status nginx" ;;
  2*)  ok "http $CODE" ;;
  *)   warn "http $CODE (expected — nginx redirects :80 to https once TLS is issued); stack is responding" ;;
esac

cat <<DONE

$(ok "rollback complete")

  host       $SSH_USER@$HOST
  dir        $REMOTE_DIR
  live slot  $REMOTE_DIR/current

  Re-run this script to flip back to the other slot.

  Site: https://$DOMAIN
DONE
