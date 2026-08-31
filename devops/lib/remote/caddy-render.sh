#!/usr/bin/env bash
# @spec L2-DEVOPS-05
# Remote fragment: render devops/Caddyfile for this instance's DOMAIN (read from
# the droplet's .env) and reload Caddy. Validated before the reload.
# Env: REMOTE_DIR.
set -euo pipefail

: "${REMOTE_DIR:?REMOTE_DIR not set}"
cd "$REMOTE_DIR"

DOMAIN="$(grep '^DOMAIN=' .env | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'")"
[ -n "$DOMAIN" ] || { echo "DOMAIN is not set in $REMOTE_DIR/.env" >&2; exit 1; }
sed "s/__DOMAIN__/$DOMAIN/" devops/Caddyfile > /etc/caddy/Caddyfile
caddy validate --config /etc/caddy/Caddyfile
systemctl reload caddy || systemctl restart caddy
echo "--> caddy serving $DOMAIN"
