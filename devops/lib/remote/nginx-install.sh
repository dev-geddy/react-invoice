#!/usr/bin/env bash
# @spec L2-DEVOPS-05
# Remote fragment: nginx + certbot packages. Runs before the site file is pushed
# (the render step needs /etc/nginx to exist).
# Env: none.
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive

if [ "$(id -u)" -eq 0 ]; then SUDO=""; else SUDO="sudo"; fi

echo "--> nginx + certbot"
$SUDO apt-get install -y nginx certbot python3-certbot-nginx
$SUDO systemctl enable --now nginx

echo "--> versions"
nginx -v
certbot --version
