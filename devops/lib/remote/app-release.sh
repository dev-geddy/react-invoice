#!/usr/bin/env bash
# @spec L2-DEVOPS-07, L2-DEVOPS-15, L2-DEVOPS-16
# Remote fragment, runs as the app user: install → build → migrate → assemble the
# release into the inactive blue/green slot → flip `current` → pm2 restart.
#
# Blue/green: /var/www/<domain> holds two slots, blue/ and green/. `current` is a
# relative symlink to whichever one is live (so the tree stays relocatable). The
# ACTIVE slot is the one `current` points at; everything below is built into the
# other (TARGET) slot, which is wiped first. ACTIVE keeps serving until the flip,
# so any failure up to that point leaves the running release untouched — and the
# previous release stays on disk for devops/rollback-for-pm2.sh.
#
# Env: REMOTE_DIR, APP_NAME, APP_PORT, SKIP_MIGRATIONS (yes|no),
#      NEEDS_NVM (yes for the pm2 flavor's nvm node, no for the apt node).
set -euo pipefail

: "${REMOTE_DIR:?REMOTE_DIR not set}"
: "${APP_NAME:?APP_NAME not set}"

cd "$REMOTE_DIR"   # sudo keeps the invoking cwd; an inaccessible cwd makes node spawns fail EACCES

if [ "${NEEDS_NVM:-no}" = "yes" ]; then
  # Non-interactive ssh gets no profile — put the nvm node (and its pm2, yarn)
  # on PATH explicitly.
  export NVM_DIR="$HOME/.nvm"
  [ -s "$NVM_DIR/nvm.sh" ] || { echo "nvm not found for $(id -un) — run setup-droplet-for-pm2.sh first" >&2; exit 1; }
  # shellcheck disable=SC1091
  . "$NVM_DIR/nvm.sh"
fi

echo "--> install deps"
# Full install (not --production): the build and drizzle-kit need devDeps.
corepack yarn install --immutable

echo "--> build app"
# Build before migrating: a build failure aborts before the schema moves, and
# the old-app-on-new-schema window stays as short as possible.
# NEXT_SKIP_TYPECHECK: types already checked in the deploy preflight (local).
NEXT_SKIP_TYPECHECK=1 corepack yarn workspace web build

if [ "${SKIP_MIGRATIONS:-no}" = "yes" ]; then
  echo "--> skipping migrations"
else
  echo "--> migrations"
  # Runs on the host. packages/db/src/load-env.ts reads $REMOTE_DIR/.env, whose
  # DATABASE_URL points at the loopback postgres port.
  corepack yarn db:migrate
fi

# Slot selection. No `current` yet (first deploy) → build into blue.
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
echo "--> active slot: ${ACTIVE:-none} — assembling release into $TARGET"

slot="$REMOTE_DIR/$TARGET"
mkdir -p "$REMOTE_DIR/shared"   # persistent instance data; deploys never touch its contents
rm -rf "$slot"
mkdir -p "$slot"

# The standalone bundle mirrors the monorepo, so copying it wholesale gives
# <slot>/apps/web/server.js + a minimal node_modules at the root.
# Static assets and public/ are not traced into it and must be copied in.
cp -a apps/web/.next/standalone/. "$slot"/
mkdir -p "$slot/apps/web/.next"
cp -a apps/web/.next/static "$slot/apps/web/.next/static"
if [ -d apps/web/public ]; then cp -a apps/web/public "$slot/apps/web/public"; fi

# <slot>/shared → ../shared: app code addresses persistent data under its own
# release root, whichever slot is live.
ln -sfn ../shared "$slot/shared"

# Guard the flip: an incomplete slot must never go live.
[ -f "$slot/apps/web/server.js" ] || { echo "release incomplete: $slot/apps/web/server.js missing" >&2; exit 1; }

echo "--> switching current -> $TARGET"
ln -sfn "$TARGET" current

echo "--> pm2 restart ($APP_NAME only — other apps untouched)"
# pm2 never updates an existing app's script path via startOrRestart — a
# process defined under an old deploy dir would silently keep running the old
# entrypoint. Recreate when the stored script path differs; plain restart otherwise.
want_script="$REMOTE_DIR/devops/pm2/start.sh"
have_script="$(pm2 jlist 2>/dev/null | node -e '
let raw = ""
process.stdin.on("data", (d) => (raw += d)).on("end", () => {
  const app = JSON.parse(raw || "[]").find((a) => a.name === process.env.APP_NAME)
  process.stdout.write(app ? String(app.pm2_env.pm_exec_path || "") : "")
})
')"
if [ -n "$have_script" ] && [ "$have_script" != "$want_script" ]; then
  echo "--> pm2 script path changed ($have_script) — recreating $APP_NAME"
  pm2 delete "$APP_NAME" >/dev/null 2>&1 || true
fi
APP_DIR="$REMOTE_DIR" APP_PORT="${APP_PORT:-3070}" pm2 startOrRestart devops/pm2/ecosystem.config.cjs --only "$APP_NAME" && pm2 save
