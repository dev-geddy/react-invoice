#!/usr/bin/env bash
# @spec L2-DEVOPS-04
# Remote fragment: make sure a database is reachable — native postgres when its
# service is active, the docker compose db otherwise. Used by the pm2 flavor,
# which supports either.
# Env: REMOTE_DIR.
set -euo pipefail

: "${REMOTE_DIR:?REMOTE_DIR not set}"
cd "$REMOTE_DIR"

PG_PORT="$(grep '^POSTGRES_PORT=' .env | head -1 | cut -d= -f2- | tr -d '"' || true)"
PG_PORT="${PG_PORT:-5432}"
if systemctl is-active --quiet postgresql; then
  # Native flavor (setup-droplet-db-native.sh).
  echo "--> native postgres active"
  pg_isready -h 127.0.0.1 -p "$PG_PORT" -t 30 || { echo "postgres not accepting connections on 127.0.0.1:$PG_PORT" >&2; exit 1; }
elif command -v docker >/dev/null 2>&1; then
  # Docker flavor (setup-droplet-db-docker.sh). --project-directory . → paths +
  # env interpolation resolve against $REMOTE_DIR.
  DC="docker compose --project-directory . -f devops/compose.prod.yml"
  echo "--> docker db"
  $DC up -d db
  healthy="no"
  for _ in $(seq 1 30); do
    cid="$($DC ps -q db)"
    if [ -n "$cid" ] && [ "$(docker inspect -f '{{.State.Health.Status}}' "$cid" 2>/dev/null || echo starting)" = "healthy" ]; then
      healthy="yes"; break
    fi
    sleep 2
  done
  [ "$healthy" = "yes" ] || { echo "db did not become healthy within 60s" >&2; $DC logs --tail 50 db >&2; exit 1; }
  echo "    db healthy"
else
  echo "no database found: neither the postgresql service is active nor docker is installed." >&2
  echo "run setup-droplet-db-native.sh or setup-droplet-db-docker.sh first." >&2
  exit 1
fi
