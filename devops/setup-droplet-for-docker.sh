#!/usr/bin/env bash
# @spec L2-DEVOPS-01
# One-time droplet provisioning — docker flavor. Idempotent — safe to re-run.
# Thin orchestrator: the actual remote work lives in devops/lib/remote/, piped to
# the droplet fragment by fragment (base + hardening shared with the pm2 flavor).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/common.sh
source "$SCRIPT_DIR/lib/common.sh"

usage() {
  cat <<'USAGE'
Provision an empty Ubuntu droplet — docker flavor: packages, swap, Docker
(db only), Node 24 + pm2 (app runtime), native Caddy, firewall, security
hardening (ssh key-only, fail2ban, unattended-upgrades), app dirs.
Pairs with ./devops/deploy-for-docker.sh.

Usage:
  ./devops/setup-droplet-for-docker.sh -h <host> -i <path-to-ssh-key> -d <domain> [-u user] [-p port]

  -h  droplet host or IP        (required)
  -i  ssh private key path      (required)
  -d  domain of this instance   (required — keys the deploy dir /var/www/<domain>)
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
ok "ssh reachable"

# --- provision ---
log "base packages, swap, app user"
remote_script base-provision.sh "APP_USER='$APP_USER'"

log "docker engine (db only)"
remote_script docker-engine.sh ""

log "node runtime (apt) + pm2"
remote_script node-apt.sh "APP_USER='$APP_USER'"

log "caddy"
remote_script caddy.sh ""

log "firewall"
remote_script firewall.sh "HTTP3=yes"

log "security hardening"
remote_script hardening.sh ""

log "app dirs"
remote_script app-dirs.sh "REMOTE_DIR='$REMOTE_DIR' APP_USER='$APP_USER'"

ok "droplet provisioned"

cat <<NEXT

Next steps:

  1. Point a DNS A record at this droplet (needed for Caddy's TLS cert).

  2. Create the two env files locally from the templates (both gitignored):
       cp devops/env/production.env.example       .env.production
       cp devops/env/production.env.local.example .env.production.local
     Then edit them — set a strong POSTGRES_PASSWORD, ENCRYPTION_KEY,
     AUTH_SECRET, your DOMAIN and AUTH_URL.

  3. First deploy (uploads the env files to $REMOTE_DIR):
       ./devops/deploy-for-docker.sh -h $HOST -i $SSH_KEY -d $DOMAIN --env .env.production --env-local .env.production.local

     Later deploys omit --env/--env-local; droplet env is left untouched.
     The first deploy lands in $REMOTE_DIR/blue; the next one in green/, and so
     on — `current` always points at the live slot.

  4. Seed the platform owner once (see README) if this is a fresh database.
NEXT
