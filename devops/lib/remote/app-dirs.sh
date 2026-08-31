#!/usr/bin/env bash
# @spec L2-DEVOPS-15
# Remote fragment: the instance's deploy dir and its persistent shared/ dir.
# Release slots (blue/, green/) are created by the deploy, not here.
# shared/ holds instance data that outlives releases (file uploads) — never
# deleted or overwritten by a deploy, and excluded from the rsync of the source.
# Env: REMOTE_DIR, APP_USER.
set -euo pipefail

: "${REMOTE_DIR:?REMOTE_DIR not set}"
: "${APP_USER:?APP_USER not set}"

if [ "$(id -u)" -eq 0 ]; then SUDO=""; else SUDO="sudo"; fi

echo "--> app dirs $REMOTE_DIR (owned by $APP_USER)"
$SUDO mkdir -p "$REMOTE_DIR" "$REMOTE_DIR/shared"
$SUDO chown "$APP_USER:$APP_USER" "$REMOTE_DIR" "$REMOTE_DIR/shared"
