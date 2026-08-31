#!/usr/bin/env bash
# @spec L2-DEVOPS-05
# Remote fragment: enable this instance's nginx site (already pushed to
# sites-available by the entrypoint) and issue its Let's Encrypt certificate.
# Env: DOMAIN, APP_NAME, CERTBOT_EMAIL (may be empty).
set -euo pipefail

: "${DOMAIN:?DOMAIN not set}"
: "${APP_NAME:?APP_NAME not set}"

if [ "$(id -u)" -eq 0 ]; then SUDO=""; else SUDO="sudo"; fi

$SUDO ln -sfn "/etc/nginx/sites-available/$APP_NAME.conf" "/etc/nginx/sites-enabled/$APP_NAME.conf"
$SUDO rm -f /etc/nginx/sites-enabled/default
$SUDO nginx -t
$SUDO systemctl reload nginx
echo "--> nginx serving $DOMAIN on :80"

# TLS. Needs the domain's A record resolving to this droplet; if DNS isn't
# ready yet the setup still completes — re-run the printed command later.
if [ -d "/etc/letsencrypt/live/$DOMAIN" ]; then
  echo "--> certificate for $DOMAIN already present, skipping certbot"
elif [ -n "${CERTBOT_EMAIL:-}" ]; then
  certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos -m "$CERTBOT_EMAIL" --redirect \
    || { echo "warn: certbot failed (DNS not pointing here yet?). Site stays on http."; \
         echo "      re-run when DNS is ready: certbot --nginx -d $DOMAIN --non-interactive --agree-tos -m $CERTBOT_EMAIL --redirect"; }
else
  certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --register-unsafely-without-email --redirect \
    || { echo "warn: certbot failed (DNS not pointing here yet?). Site stays on http."; \
         echo "      re-run when DNS is ready: certbot --nginx -d $DOMAIN --non-interactive --agree-tos --register-unsafely-without-email --redirect"; }
fi
