#!/usr/bin/env bash
# @spec L2-DEVOPS-01
# Remote fragment: Docker engine + compose plugin. Docker runs the database
# only; the app itself runs on the host under pm2.
# Env: none.
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

echo "--> versions"
docker --version
