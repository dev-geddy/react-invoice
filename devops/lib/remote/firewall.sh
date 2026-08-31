#!/usr/bin/env bash
# @spec L2-DEVOPS-01
# Remote fragment: ufw — ssh + http + https (plus 443/udp for HTTP/3 when the
# proxy is Caddy).
# Env: HTTP3 (yes|no, default no).
set -euo pipefail

if [ "$(id -u)" -eq 0 ]; then SUDO=""; else SUDO="sudo"; fi

echo "--> firewall"
$SUDO ufw allow OpenSSH
$SUDO ufw allow 80/tcp
$SUDO ufw allow 443/tcp
if [ "${HTTP3:-no}" = "yes" ]; then
  $SUDO ufw allow 443/udp   # HTTP/3
fi
$SUDO ufw --force enable
