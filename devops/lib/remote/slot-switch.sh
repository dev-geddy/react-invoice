#!/usr/bin/env bash
# @spec L2-DEVOPS-15
# Remote fragment, runs as the app user: flip `current` to the *inactive*
# blue/green slot (= the previous release) and restart pm2. Rollback path — no
# build, no migrations; the schema is left as the rolled-back-from release made it.
# Refuses when the inactive slot holds no usable release.
#
# Env: REMOTE_DIR, APP_NAME, APP_PORT, NEEDS_NVM (yes|no).
set -euo pipefail

: "${REMOTE_DIR:?REMOTE_DIR not set}"
: "${APP_NAME:?APP_NAME not set}"

cd "$REMOTE_DIR"   # sudo keeps the invoking cwd; an inaccessible cwd makes node spawns fail EACCES

if [ "${NEEDS_NVM:-no}" = "yes" ]; then
  export NVM_DIR="$HOME/.nvm"
  [ -s "$NVM_DIR/nvm.sh" ] || { echo "nvm not found for $(id -un) — run setup-droplet-for-pm2.sh first" >&2; exit 1; }
  # shellcheck disable=SC1091
  . "$NVM_DIR/nvm.sh"
fi

[ -L current ] || { echo "no $REMOTE_DIR/current symlink — nothing deployed yet, cannot roll back" >&2; exit 1; }
case "$(basename "$(readlink current)")" in
  blue)  ACTIVE="blue"; TARGET="green" ;;
  green) ACTIVE="green"; TARGET="blue" ;;
  *)     echo "$REMOTE_DIR/current points outside blue/green — refusing to roll back" >&2; exit 1 ;;
esac

[ -f "$REMOTE_DIR/$TARGET/apps/web/server.js" ] \
  || { echo "slot $TARGET holds no release ($TARGET/apps/web/server.js missing) — nothing to roll back to" >&2; exit 1; }

echo "--> active slot: $ACTIVE"
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
