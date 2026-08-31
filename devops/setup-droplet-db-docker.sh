#!/usr/bin/env bash
# @spec L2-DEVOPS-01
# One-time database provisioning — Docker engine for the db-only compose stack.
# Idempotent — safe to re-run.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/common.sh
source "$SCRIPT_DIR/lib/common.sh"

usage() {
  cat <<'USAGE'
Install Docker engine + compose plugin on the droplet for the db-only stack
(devops/compose.prod.yml — Postgres 17, loopback 127.0.0.1:5432). The db
container itself starts on the first deploy, once the droplet has its .env.

Usage:
  ./devops/setup-droplet-db-docker.sh -h <host> -i <path-to-ssh-key> [-u user] [-p port]

  -h  droplet host or IP        (required)
  -i  ssh private key path      (required)
  -u  ssh user                  (default: root)
  -p  ssh port                  (default: 22)
USAGE
}

HOST=""
SSH_KEY=""
SSH_USER="root"
SSH_PORT="22"

while [ $# -gt 0 ]; do
  case "$1" in
    -h|--host)      require_arg "$1" "${2:-}"; HOST="$2"; shift 2 ;;
    -i|--identity)  require_arg "$1" "${2:-}"; SSH_KEY="$2"; shift 2 ;;
    -u|--user)      require_arg "$1" "${2:-}"; SSH_USER="$2"; shift 2 ;;
    -p|--port)      require_arg "$1" "${2:-}"; SSH_PORT="$2"; shift 2 ;;
    --help)         usage; exit 0 ;;
    *)              die_usage "unknown argument: $1" ;;
  esac
done

[ -n "$HOST" ] || die_usage "-h <host> is required"
[ -n "$SSH_KEY" ] || die_usage "-i <path-to-ssh-key> is required"

# --- preflight ---
require_file "$SSH_KEY" "ssh private key not found"
log "checking ssh to $SSH_USER@$HOST:$SSH_PORT"
remote_run true >/dev/null 2>&1 || die "cannot ssh to $SSH_USER@$HOST:$SSH_PORT (check host, key, port)"
ok "ssh reachable"

# --- provision ---
log "installing docker engine (db only)"
remote_run 'bash -s' <<'REMOTE'
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive
if [ "$(id -u)" -eq 0 ]; then SUDO=""; else SUDO="sudo"; fi

if command -v docker >/dev/null 2>&1; then
  echo "--> docker already installed, skipping"
else
  echo "--> installing docker engine + compose plugin"
  curl -fsSL https://get.docker.com -o /tmp/get-docker.sh
  $SUDO sh /tmp/get-docker.sh
  rm -f /tmp/get-docker.sh
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "--> installing compose plugin"
  $SUDO apt-get install -y docker-compose-plugin
fi

echo "--> enabling docker"
$SUDO systemctl enable --now docker
docker --version
REMOTE

ok "docker ready for the db stack"

cat <<DONE

  The Postgres container (devops/compose.prod.yml) starts on the first deploy,
  after the droplet has its .env (POSTGRES_* + DATABASE_URL → 127.0.0.1:5432).
DONE
