#!/usr/bin/env bash
# @spec L2-DEVOPS-05
# Remote fragment: native Caddy (systemd) from the official apt repo. Fronts the
# pm2 app on the loopback port; the Caddyfile itself is rendered by the deploy.
# Env: none.
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive

if [ "$(id -u)" -eq 0 ]; then SUDO=""; else SUDO="sudo"; fi

if command -v caddy >/dev/null 2>&1; then
  echo "--> caddy already installed, skipping"
else
  echo "--> installing caddy (official apt repo)"
  $SUDO apt-get install -y debian-keyring debian-archive-keyring apt-transport-https
  curl -fsSL https://dl.cloudsmith.io/public/caddy/stable/gpg.key | gpg --dearmor | $SUDO tee /usr/share/keyrings/caddy-stable-archive-keyring.gpg >/dev/null
  curl -fsSL https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt | $SUDO tee /etc/apt/sources.list.d/caddy-stable.list >/dev/null
  $SUDO apt-get update -y
  $SUDO apt-get install -y caddy
fi

echo "--> versions"
caddy version
