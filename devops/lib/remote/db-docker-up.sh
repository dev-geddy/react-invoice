#!/usr/bin/env bash
# @spec L2-DEVOPS-04
# Remote fragment: bring up the docker compose db and wait for its health check.
# Used by the docker flavor, whose db is always in compose.
# Env: REMOTE_DIR.
set -euo pipefail

: "${REMOTE_DIR:?REMOTE_DIR not set}"
cd "$REMOTE_DIR"

# --project-directory . → all relative paths in the compose file resolve against
# $REMOTE_DIR, and compose reads $REMOTE_DIR/.env for interpolation.
DC="docker compose --project-directory . -f devops/compose.prod.yml"

echo "--> start db"
$DC up -d db

echo "--> waiting for db health"
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
