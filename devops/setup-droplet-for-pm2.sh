#!/usr/bin/env bash
# @spec L2-DEVOPS-01
# One-time droplet provisioning — pm2 flavor (no Docker). Idempotent — safe to
# re-run. Thin orchestrator: the actual remote work lives in devops/lib/remote/,
# piped to the droplet fragment by fragment.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/common.sh
source "$SCRIPT_DIR/lib/common.sh"

usage() {
  cat <<'USAGE'
Provision an empty Ubuntu droplet — pm2 flavor: packages, swap, security
hardening (ssh key-only, fail2ban, unattended-upgrades), nvm + Node 24 +
corepack (yarn 4), pm2, nginx reverse proxy + Let's Encrypt TLS, firewall,
app dirs. No Docker. Pairs with ./devops/deploy-for-pm2.sh.

Database is provisioned separately — run one of:
  ./devops/setup-droplet-db-native.sh   (Postgres 17 on the host)
  ./devops/setup-droplet-db-docker.sh   (Postgres in Docker)

Multi-instance: re-run with a different -d/-n/--app-port to host another
instance on the same droplet (own /var/www/<domain>, pm2 app, nginx site, cert).

Usage:
  ./devops/setup-droplet-for-pm2.sh -h <host> -i <path-to-ssh-key> -d <domain>
                                    [-m <certbot-email>] [-n <app-name>]
                                    [--app-port <port>] [-u user] [-p port]

  -h  droplet host or IP        (required)
  -i  ssh private key path      (required)
  -d  domain for nginx + TLS    (required; A record should point at the droplet)
  -m  email for Let's Encrypt   (recommended: expiry notices)
  -n  app/instance name         (default: backflip — pm2 app + nginx site name)
  --app-port  app loopback port (default: 3070; must be unique per instance)
  -u  ssh user                  (default: root)
  -p  ssh port                  (default: 22)
USAGE
}

HOST=""
SSH_KEY=""
SSH_USER="root"
SSH_PORT="22"
DOMAIN=""
CERTBOT_EMAIL=""

while [ $# -gt 0 ]; do
  case "$1" in
    -h|--host)      require_arg "$1" "${2:-}"; HOST="$2"; shift 2 ;;
    -i|--identity)  require_arg "$1" "${2:-}"; SSH_KEY="$2"; shift 2 ;;
    -d|--domain)    require_arg "$1" "${2:-}"; DOMAIN="$2"; shift 2 ;;
    -m|--email)     require_arg "$1" "${2:-}"; CERTBOT_EMAIL="$2"; shift 2 ;;
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

NVM_VERSION="v0.40.3"

# --- preflight ---
require_file "$SSH_KEY" "ssh private key not found"
require_file "$SCRIPT_DIR/nginx/backflip.conf" "nginx site template missing"
preflight_ssh "check host, key, port"
ok "ssh reachable"

# --- provision ---
# Fragment parameters go through the remote command prefix, so the fragments
# themselves stay plain bash with no local-side escaping.
log "base packages, swap, app user"
remote_script base-provision.sh "APP_USER='$APP_USER'"

log "node runtime (nvm) + pm2"
remote_script node-nvm.sh "APP_USER='$APP_USER' NVM_VERSION='$NVM_VERSION'"

log "nginx + certbot"
remote_script nginx-install.sh ""

log "firewall"
remote_script firewall.sh "HTTP3=no"

log "security hardening"
remote_script hardening.sh ""

log "app dirs"
remote_script app-dirs.sh "REMOTE_DIR='$REMOTE_DIR' APP_USER='$APP_USER'"

# --- nginx site (rendered locally from the template, pushed to the droplet) ---
# One site file per instance — other instances' sites are untouched.
# The shared http-context snippet (rate-limit zone + scrubbed log_format) is
# host-wide, not per-instance; pushed verbatim to conf.d before the site so the
# site's `limit_req`/`access_log` references resolve when nginx -t runs.
log "nginx http snippet (rate-limit zone + scrubbed logs)"
require_file "$SCRIPT_DIR/nginx/backflip-http.conf" "nginx http snippet missing"
remote_run "tee /etc/nginx/conf.d/backflip-http.conf >/dev/null" < "$SCRIPT_DIR/nginx/backflip-http.conf"

log "nginx site $APP_NAME.conf for $DOMAIN (app port $APP_PORT)"
sed -e "s/__DOMAIN__/$DOMAIN/g" -e "s/__PORT__/$APP_PORT/g" "$SCRIPT_DIR/nginx/backflip.conf" \
  | remote_run "tee /etc/nginx/sites-available/$APP_NAME.conf >/dev/null"
remote_script nginx-certbot.sh "DOMAIN='$DOMAIN' CERTBOT_EMAIL='$CERTBOT_EMAIL' APP_NAME='$APP_NAME'"

ok "droplet provisioned (pm2 flavor)"

cat <<NEXT

Next steps:

  1. Provision the database (once):
       ./devops/setup-droplet-db-native.sh -h $HOST -i $SSH_KEY   # Postgres 17 on the host
     or
       ./devops/setup-droplet-db-docker.sh -h $HOST -i $SSH_KEY   # Postgres in Docker

  2. Create the two env files locally from the templates (both gitignored):
       cp devops/env/production.env.example       .env.production
       cp devops/env/production.env.local.example .env.production.local
     Then edit them — set a strong POSTGRES_PASSWORD, ENCRYPTION_KEY,
     AUTH_SECRET, DOMAIN=$DOMAIN and AUTH_URL.

  3. First deploy (uploads the env files to $REMOTE_DIR):
       ./devops/deploy-for-pm2.sh -h $HOST -i $SSH_KEY -d $DOMAIN -n $APP_NAME --app-port $APP_PORT --env .env.production --env-local .env.production.local

     Later deploys omit --env/--env-local; droplet env is left untouched.
     The first deploy lands in $REMOTE_DIR/blue; the next one in green/, and so
     on — `current` always points at the live slot.

  4. Seed the platform owner once (see README) if this is a fresh database.
NEXT
