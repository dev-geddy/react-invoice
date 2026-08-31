#!/usr/bin/env bash
# @spec L2-DEVOPS-02, L2-DEVOPS-07, L2-DEVOPS-15
# Deploy to a pm2-flavor droplet (setup-droplet-for-pm2.sh — nvm node, nginx).
# Thin orchestrator: parse flags, preflight, then pipe the remote fragments in
# devops/lib/remote/ to the droplet in order.
# Runs the same way from a laptop or from CI — CI configs are thin wrappers
# around this script, never copies of it.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/common.sh
source "$SCRIPT_DIR/lib/common.sh"

usage() {
  cat <<'USAGE'
Deploy the app to a pm2-flavor droplet (setup-droplet-for-pm2.sh):
sync → install → build → migrate → release slot → pm2 restart → health check.
nginx + TLS are owned by setup; deploy does not touch them.
The database must be provisioned (setup-droplet-db-native.sh or
setup-droplet-db-docker.sh) — native postgres is used when its service is
active, the docker compose db otherwise.

Multi-instance safe: pm2 startOrRestart touches only this instance's app
(-n name); other apps under the shared pm2 daemon keep running.

Deploy dir: /var/www/<domain> — synced source at the root, two release slots
blue/ and green/, live app behind the /var/www/<domain>/current symlink,
persistent instance data in shared/ (never touched by a deploy). Each deploy
rebuilds the inactive slot and flips `current` to it; the previous release stays
in the other slot for ./devops/rollback-for-pm2.sh.

Usage:
  ./devops/deploy-for-pm2.sh -h <host> -i <path-to-ssh-key> -d <domain>
                             [-n <app-name>] [--app-port <port>] [-u user] [-p port]
                             [--env <file>] [--env-local <file>] [--skip-migrations]

  -h  droplet host or IP        (required)
  -i  ssh private key path      (required)
  -d  domain of this instance   (required — keys the deploy dir /var/www/<domain>; must match setup -d)
  -n  app/instance name         (default: backflip — must match setup -n)
  --app-port  app loopback port (default: 3070 — must match setup --app-port)
  -u  ssh user                  (default: root)
  -p  ssh port                  (default: 22)

  --env <file>        upload as /var/www/<domain>/.env       (first deploy only)
  --env-local <file>  upload as /var/www/<domain>/.env.local (first deploy only)
  --skip-migrations   don't run drizzle migrations

Templates for the env files: devops/env/production.env{,.local}.example
USAGE
}

HOST=""
SSH_KEY=""
SSH_USER="root"
SSH_PORT="22"
DOMAIN=""
ENV_FILE=""
ENV_LOCAL_FILE=""
SKIP_MIGRATIONS="no"

while [ $# -gt 0 ]; do
  case "$1" in
    -h|--host)         require_arg "$1" "${2:-}"; HOST="$2"; shift 2 ;;
    -i|--identity)     require_arg "$1" "${2:-}"; SSH_KEY="$2"; shift 2 ;;
    -d|--domain)       require_arg "$1" "${2:-}"; DOMAIN="$2"; shift 2 ;;
    -n|--app-name)     require_arg "$1" "${2:-}"; APP_NAME="$2"; shift 2 ;;
    --app-port)        require_arg "$1" "${2:-}"; APP_PORT="$2"; shift 2 ;;
    -u|--user)         require_arg "$1" "${2:-}"; SSH_USER="$2"; shift 2 ;;
    -p|--port)         require_arg "$1" "${2:-}"; SSH_PORT="$2"; shift 2 ;;
    --env)             require_arg "$1" "${2:-}"; ENV_FILE="$2"; shift 2 ;;
    --env-local)       require_arg "$1" "${2:-}"; ENV_LOCAL_FILE="$2"; shift 2 ;;
    --skip-migrations) SKIP_MIGRATIONS="yes"; shift ;;
    --help)            usage; exit 0 ;;
    *)                 die_usage "unknown argument: $1" ;;
  esac
done

[ -n "$HOST" ] || die_usage "-h <host> is required"
[ -n "$SSH_KEY" ] || die_usage "-i <path-to-ssh-key> is required"
[ -n "$DOMAIN" ] || die_usage "-d <domain> is required"
REMOTE_DIR="/var/www/$DOMAIN"

# --- preflight ---
require_file "$SSH_KEY" "ssh private key not found"
if [ -n "$ENV_FILE" ]; then require_file "$ENV_FILE" "--env file not found"; fi
if [ -n "$ENV_LOCAL_FILE" ]; then require_file "$ENV_LOCAL_FILE" "--env-local file not found"; fi

preflight_ssh "run setup-droplet-for-pm2.sh first?"

# Deploy dir + persistent shared/ (setup creates them too; harmless to re-ensure).
remote_script app-dirs.sh "REMOTE_DIR='$REMOTE_DIR' APP_USER='$APP_USER'" >/dev/null

# --- env files (uploaded only when explicitly passed; never overwritten otherwise) ---
push_env_files "$ENV_FILE" "$ENV_LOCAL_FILE"

# --- preflight typecheck (local, multi-core) ---
preflight_typecheck

# --- sync ---
sync_repo

# --- database (root: system services) ---
log "checking database"
remote_script db-ready.sh "REMOTE_DIR='$REMOTE_DIR'"
ok "database ready"

# --- install, build, migrate, release (app user: everything pm2/app-side) ---
# Failure isolation: the live app serves the ACTIVE slot via the current symlink,
# and the release is assembled in the INACTIVE one. Deps, build and migrations all
# run against the synced working tree, so any failure before the symlink flip
# leaves the previous release running untouched.
log "building + releasing (as $APP_USER)"
remote_script app-release.sh \
  "sudo -H -u $APP_USER REMOTE_DIR='$REMOTE_DIR' SKIP_MIGRATIONS='$SKIP_MIGRATIONS' APP_NAME='$APP_NAME' APP_PORT='$APP_PORT' NEEDS_NVM=yes"

ok "release live"

# --- health check ---
log "health check"
PM2_STATUS="$(pm2_health yes)"

if [ "$PM2_STATUS" != "online" ]; then
  warn "pm2 reports $APP_NAME status: ${PM2_STATUS:-unknown}"
  pm2_logs_tail yes
  die "app process is not online"
fi
ok "pm2 online"

CODE="$(http_health)"

# Any HTTP response means the stack is serving. With TLS issued, nginx answers
# :80 with a 301 to https — only "no response at all" is a failure.
case "$CODE" in
  000) die "no HTTP response on port 80. Check: pm2 logs $APP_NAME / systemctl status nginx" ;;
  2*)  ok "http $CODE" ;;
  *)   warn "http $CODE (expected — nginx redirects :80 to https once TLS is issued); stack is responding" ;;
esac

cat <<DONE

$(ok "deploy complete")

  host       $SSH_USER@$HOST
  dir        $REMOTE_DIR
  live slot  $REMOTE_DIR/current
  migrations $([ "$SKIP_MIGRATIONS" = "yes" ] && echo skipped || echo applied)

  Logs:     ssh -i $SSH_KEY -p $SSH_PORT $SSH_USER@$HOST "sudo -H -u $APP_USER bash -c 'cd; . \\\$HOME/.nvm/nvm.sh; pm2 logs $APP_NAME'"
  Status:   ssh -i $SSH_KEY -p $SSH_PORT $SSH_USER@$HOST "sudo -H -u $APP_USER bash -c 'cd; . \\\$HOME/.nvm/nvm.sh; pm2 status'; readlink $REMOTE_DIR/current; systemctl status nginx --no-pager | head -5"
  Rollback: ./devops/rollback-for-pm2.sh -h $HOST -i $SSH_KEY -d $DOMAIN -n $APP_NAME --app-port $APP_PORT

  Site: https://$DOMAIN
DONE
