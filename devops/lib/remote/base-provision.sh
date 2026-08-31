#!/usr/bin/env bash
# @spec L2-DEVOPS-01
# Remote fragment (piped into `bash -s` on the droplet): apt base packages,
# swap, dedicated app user. Shared by both setup flavors.
# Env: APP_USER.
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive

: "${APP_USER:?APP_USER not set}"

# Run as root; fall back to sudo for a non-root ssh user.
if [ "$(id -u)" -eq 0 ]; then SUDO=""; else SUDO="sudo"; fi

echo "--> apt-get update"
$SUDO apt-get update -y

echo "--> base packages"
$SUDO apt-get install -y --no-install-recommends ca-certificates curl git ufw rsync gnupg

# Swap. Next builds run on the droplet and OOM on small ones without it.
if [ -z "$(swapon --show)" ]; then
  echo "--> creating 2G swapfile"
  $SUDO fallocate -l 2G /swapfile || $SUDO dd if=/dev/zero of=/swapfile bs=1M count=2048
  $SUDO chmod 600 /swapfile
  $SUDO mkswap /swapfile
  $SUDO swapon /swapfile
  grep -q '^/swapfile ' /etc/fstab || echo '/swapfile none swap sw 0 0' | $SUDO tee -a /etc/fstab >/dev/null
else
  echo "--> swap already active, skipping"
fi

# Dedicated app user: locked (no password, no ssh keys → no remote login),
# owns /var/www/<domain> and runs pm2 + the app. Root stays for system work only.
if id "$APP_USER" >/dev/null 2>&1; then
  echo "--> user $APP_USER exists, skipping"
else
  echo "--> creating app user $APP_USER"
  $SUDO useradd -m -s /bin/bash "$APP_USER"
fi
