#!/usr/bin/env bash
# @spec L2-DEVOPS-01
# One-time database provisioning — native Postgres 17 on the droplet host.
# Idempotent — safe to re-run (existing role/db/password are left untouched).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/common.sh
source "$SCRIPT_DIR/lib/common.sh"

usage() {
  cat <<'USAGE'
Install Postgres 17 (PGDG apt repo) on the droplet, loopback-only, and create
the app role + database. Prints the DATABASE_URL for .env.production.

Usage:
  ./devops/setup-droplet-db-native.sh -h <host> -i <path-to-ssh-key>
                                      [--db-name backflip] [--db-user backflip]
                                      [--db-password <pw>] [-u user] [-p port]

  -h  droplet host or IP        (required)
  -i  ssh private key path      (required)
  --db-name      database name  (default: backflip)
  --db-user      role name      (default: backflip)
  --db-password  role password  (default: generated, printed once)
  -u  ssh user                  (default: root)
  -p  ssh port                  (default: 22)
USAGE
}

HOST=""
SSH_KEY=""
SSH_USER="root"
SSH_PORT="22"
DB_NAME="backflip"
DB_USER="backflip"
DB_PASSWORD=""

while [ $# -gt 0 ]; do
  case "$1" in
    -h|--host)      require_arg "$1" "${2:-}"; HOST="$2"; shift 2 ;;
    -i|--identity)  require_arg "$1" "${2:-}"; SSH_KEY="$2"; shift 2 ;;
    --db-name)      require_arg "$1" "${2:-}"; DB_NAME="$2"; shift 2 ;;
    --db-user)      require_arg "$1" "${2:-}"; DB_USER="$2"; shift 2 ;;
    --db-password)  require_arg "$1" "${2:-}"; DB_PASSWORD="$2"; shift 2 ;;
    -u|--user)      require_arg "$1" "${2:-}"; SSH_USER="$2"; shift 2 ;;
    -p|--port)      require_arg "$1" "${2:-}"; SSH_PORT="$2"; shift 2 ;;
    --help)         usage; exit 0 ;;
    *)              die_usage "unknown argument: $1" ;;
  esac
done

[ -n "$HOST" ] || die_usage "-h <host> is required"
[ -n "$SSH_KEY" ] || die_usage "-i <path-to-ssh-key> is required"

if [ -z "$DB_PASSWORD" ]; then
  DB_PASSWORD="$(openssl rand -hex 16)"
  GENERATED_PW="yes"
else
  GENERATED_PW="no"
fi

# --- preflight ---
require_file "$SSH_KEY" "ssh private key not found"
log "checking ssh to $SSH_USER@$HOST:$SSH_PORT"
remote_run true >/dev/null 2>&1 || die "cannot ssh to $SSH_USER@$HOST:$SSH_PORT (check host, key, port)"
ok "ssh reachable"

# --- provision ---
log "installing native Postgres 17"
remote_run "DB_NAME='$DB_NAME' DB_USER='$DB_USER' DB_PASSWORD='$DB_PASSWORD' bash -s" <<'REMOTE'
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive
if [ "$(id -u)" -eq 0 ]; then SUDO=""; else SUDO="sudo"; fi

# PGDG repo — matches the Postgres 17 used by local dev + docker flavor.
if [ -f /etc/apt/sources.list.d/pgdg.sources ] || [ -f /etc/apt/sources.list.d/pgdg.list ]; then
  echo "--> pgdg repo already configured, skipping"
else
  echo "--> adding pgdg apt repo"
  $SUDO apt-get install -y --no-install-recommends ca-certificates curl gnupg
  $SUDO install -d /usr/share/postgresql-common/pgdg
  $SUDO curl -fsSL -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc https://www.postgresql.org/media/keys/ACCC4CF8.asc
  echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] https://apt.postgresql.org/pub/repos/apt $(. /etc/os-release && echo "$VERSION_CODENAME")-pgdg main" \
    | $SUDO tee /etc/apt/sources.list.d/pgdg.list >/dev/null
  $SUDO apt-get update -y
fi

if command -v pg_isready >/dev/null 2>&1 && [ -d /etc/postgresql/17 ]; then
  echo "--> postgres 17 already installed, skipping"
else
  echo "--> installing postgresql-17"
  $SUDO apt-get install -y postgresql-17
fi
$SUDO systemctl enable --now postgresql

# Loopback only (Ubuntu default is localhost — assert it stays that way).
echo "--> listen_addresses"
listen="$(sudo -u postgres psql -tAc "SHOW listen_addresses" 2>/dev/null || echo localhost)"
case "$listen" in
  localhost|127.0.0.1|"127.0.0.1, ::1") echo "    loopback-only ($listen), ok" ;;
  *) echo "warn: listen_addresses='$listen' — expected loopback only; check postgresql.conf" >&2 ;;
esac

echo "--> role + database"
role_exists="$(sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname = '$DB_USER'")"
if [ "$role_exists" = "1" ]; then
  echo "    role $DB_USER exists, leaving password untouched"
else
  sudo -u postgres psql -v ON_ERROR_STOP=1 -c "CREATE ROLE \"$DB_USER\" LOGIN PASSWORD '$DB_PASSWORD'"
  echo "    role $DB_USER created"
fi

db_exists="$(sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname = '$DB_NAME'")"
if [ "$db_exists" = "1" ]; then
  echo "    database $DB_NAME exists, skipping"
else
  sudo -u postgres createdb -O "$DB_USER" "$DB_NAME"
  echo "    database $DB_NAME created (owner $DB_USER)"
fi

echo "--> pg_isready"
pg_isready -h 127.0.0.1 -p 5432
REMOTE

ok "native postgres ready"

cat <<DONE

  Postgres 17 on the droplet host, loopback only (127.0.0.1:5432).

  database  $DB_NAME
  role      $DB_USER
$( [ "$GENERATED_PW" = "yes" ] && echo "  password  $DB_PASSWORD   (generated — save it now, it is not stored anywhere else)" || echo "  password  (as provided)" )

  For .env.production:
    DATABASE_URL=postgresql://$DB_USER:<password>@127.0.0.1:5432/$DB_NAME

  Note: if the role already existed, its old password still applies —
  this script never overwrites credentials.
DONE
