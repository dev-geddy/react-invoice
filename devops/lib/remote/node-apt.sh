#!/usr/bin/env bash
# @spec L2-DEVOPS-01
# Remote fragment: system-wide Node 24 (NodeSource apt) + corepack + pm2, plus
# the pm2 boot-persistence systemd unit. Docker-flavor counterpart of node-nvm.sh.
# Env: APP_USER.
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive

: "${APP_USER:?APP_USER not set}"

if [ "$(id -u)" -eq 0 ]; then SUDO=""; else SUDO="sudo"; fi

node_major=0
if command -v node >/dev/null 2>&1; then
  node_major="$(node -v | sed 's/^v//' | cut -d. -f1)"
fi
if [ "$node_major" -lt 24 ]; then
  echo "--> installing node 24"
  curl -fsSL https://deb.nodesource.com/setup_24.x -o /tmp/nodesource_setup.sh
  $SUDO bash /tmp/nodesource_setup.sh
  rm -f /tmp/nodesource_setup.sh
  $SUDO apt-get install -y nodejs
else
  echo "--> node $(node -v) already installed, skipping"
fi
$SUDO corepack enable

if command -v pm2 >/dev/null 2>&1; then
  echo "--> pm2 already installed, skipping"
else
  echo "--> installing pm2"
  $SUDO npm i -g pm2
fi

# Boot persistence: pm2-<app-user> systemd unit. Node is system-wide (apt),
# so the unit's PATH needs no nvm handling here.
APP_HOME="$(getent passwd "$APP_USER" | cut -d: -f6)"
if systemctl list-unit-files | grep -q "pm2-$APP_USER"; then
  echo "--> pm2 startup unit present, skipping"
else
  echo "--> pm2 boot persistence (pm2-$APP_USER)"
  $SUDO env PATH="$PATH" pm2 startup systemd -u "$APP_USER" --hp "$APP_HOME"
fi

echo "--> versions"
node -v
pm2 -v
