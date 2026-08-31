#!/usr/bin/env bash
# @spec L2-DEVOPS-15, L2-DEVOPS-16
# Remote fragment, runs as root: unpack a locally built artifact into the
# INACTIVE blue/green slot. No install, no build — the tarball already holds the
# assembled Next standalone release (see devops/deploy-for-pm2-build-locally.sh).
#
# Does NOT flip `current`: the caller migrates first, then runs slot-activate.sh.
# Slot choice is a pure function of `current`, so both fragments pick the same
# TARGET without passing state around.
#
# Env: REMOTE_DIR, APP_USER, ARTIFACT (path to the uploaded .tgz).
set -euo pipefail

: "${REMOTE_DIR:?REMOTE_DIR not set}"
: "${APP_USER:?APP_USER not set}"
: "${ARTIFACT:?ARTIFACT not set}"

[ -f "$ARTIFACT" ] || { echo "artifact not found: $ARTIFACT" >&2; exit 1; }
cd "$REMOTE_DIR"

# Slot selection. No `current` yet (first deploy) → target blue.
ACTIVE=""
if [ -L current ]; then
  case "$(basename "$(readlink current)")" in
    blue)  ACTIVE="blue" ;;
    green) ACTIVE="green" ;;
  esac
fi
case "$ACTIVE" in
  blue)  TARGET="green" ;;
  green) TARGET="blue" ;;
  *)     TARGET="blue" ;;
esac
echo "--> active slot: ${ACTIVE:-none} — extracting artifact into $TARGET"

slot="$REMOTE_DIR/$TARGET"
mkdir -p "$REMOTE_DIR/shared"   # persistent instance data; deploys never touch its contents
rm -rf "$slot"
mkdir -p "$slot"
tar -xzf "$ARTIFACT" -C "$slot"

# <slot>/shared → ../shared: app code addresses persistent data under its own
# release root, whichever slot is live.
ln -sfn ../shared "$slot/shared"

# Guard: an incomplete slot must never be handed to slot-activate.sh.
[ -f "$slot/apps/web/server.js" ] \
  || { echo "artifact incomplete: $slot/apps/web/server.js missing" >&2; exit 1; }

# pm2 runtime files. This flow never rsyncs the source tree, so the ecosystem +
# start.sh the pm2 daemon needs at $REMOTE_DIR/devops/pm2 come from the artifact.
echo "--> refreshing $REMOTE_DIR/devops/pm2"
mkdir -p "$REMOTE_DIR/devops/pm2"
cp -a "$slot/devops/pm2/." "$REMOTE_DIR/devops/pm2/"
chmod +x "$REMOTE_DIR/devops/pm2/start.sh"
[ -f "$REMOTE_DIR/devops/pm2/ecosystem.config.cjs" ] \
  || { echo "artifact missing devops/pm2/ecosystem.config.cjs" >&2; exit 1; }

chown -R "$APP_USER:$APP_USER" "$slot" "$REMOTE_DIR/devops"
rm -f "$ARTIFACT"
echo "--> slot $TARGET ready (current not flipped yet)"
