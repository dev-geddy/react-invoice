#!/usr/bin/env bash
# @spec L2-DEVOPS-02, L2-DEVOPS-07, L2-DEVOPS-15, L2-DEVOPS-16
# Deploy to a pm2-flavor droplet with the build done LOCALLY: typecheck + build on
# the operator's (multi-core) machine, ship only the assembled release as a
# tarball. No yarn install, no build, no node_modules on the droplet — minutes
# become seconds compared to devops/deploy-for-pm2.sh.
#
# Flow: preflight → local build → assemble artifact → upload + extract into the
# INACTIVE blue/green slot → migrate (over an ssh tunnel, from here) → flip
# `current` + pm2 restart → health check. Same failure isolation as the
# droplet-build deploy: everything before the flip leaves the live slot serving.
#
# Caveats:
# - The artifact is built on the operator's OS/arch. Everything the app actually
#   executes is JS today, so a macOS-built bundle runs on the droplet's Linux —
#   except the traced node_modules also carry Next's optional sharp binaries
#   (image optimizer) for the build machine's platform. Nothing renders
#   next/image today, so they are inert; the assembly step warns about them and
#   refuses outright if any other native module shows up. Use deploy-for-pm2.sh
#   (builds on the droplet) whenever a native module matters.
# - This flow does NOT rsync the source tree, so a droplet that was previously
#   deployed the other way keeps a stale copy of it. Harmless: only the env
#   files, shared/, the release slots and devops/pm2/ matter at runtime
#   (devops/pm2 is refreshed from the artifact on every deploy). Mixing the two
#   scripts on one instance is fine — they agree on the layout.
# - Migrations run from here through an ssh tunnel, because droplet Postgres
#   listens on loopback only and this flow leaves no drizzle-kit on the droplet.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/common.sh
source "$SCRIPT_DIR/lib/common.sh"

usage() {
  cat <<'USAGE'
Deploy the app to a pm2-flavor droplet, building on THIS machine:
typecheck → build → pack → upload → extract into the inactive slot → migrate
(via ssh tunnel) → flip `current` → pm2 restart → health check.

Same droplet layout, flags and blue/green semantics as ./devops/deploy-for-pm2.sh
— only the build location differs. Requires local deps (corepack yarn install).
nginx + TLS are owned by setup; deploy does not touch them.

Usage:
  ./devops/deploy-for-pm2-build-locally.sh -h <host> -i <path-to-ssh-key> -d <domain>
                             [-n <app-name>] [--app-port <port>] [-u user] [-p port]
                             [--env <file>] [--env-local <file>] [--skip-migrations]

  -h  droplet host or IP        (required)
  -i  ssh private key path      (required)
  -d  domain of this instance   (required — keys the deploy dir /var/www/<domain>; must match setup -d)
  -n  app/instance name         (default: backflip — must match setup -n)
  --app-port  app loopback port (default: 3070 — must match setup --app-port)
  -u  ssh user                  (default: root)
  -p  ssh port                  (default: 22)

  --env <file>        upload as /var/www/<domain>/.env       (first deploy only)
  --env-local <file>  upload as /var/www/<domain>/.env.local (first deploy only)
  --skip-migrations   don't run drizzle migrations

Templates for the env files: devops/env/production.env{,.local}.example
USAGE
}

HOST=""
SSH_KEY=""
SSH_USER="root"
SSH_PORT="22"
DOMAIN=""
ENV_FILE=""
ENV_LOCAL_FILE=""
SKIP_MIGRATIONS="no"

while [ $# -gt 0 ]; do
  case "$1" in
    -h|--host)         require_arg "$1" "${2:-}"; HOST="$2"; shift 2 ;;
    -i|--identity)     require_arg "$1" "${2:-}"; SSH_KEY="$2"; shift 2 ;;
    -d|--domain)       require_arg "$1" "${2:-}"; DOMAIN="$2"; shift 2 ;;
    -n|--app-name)     require_arg "$1" "${2:-}"; APP_NAME="$2"; shift 2 ;;
    --app-port)        require_arg "$1" "${2:-}"; APP_PORT="$2"; shift 2 ;;
    -u|--user)         require_arg "$1" "${2:-}"; SSH_USER="$2"; shift 2 ;;
    -p|--port)         require_arg "$1" "${2:-}"; SSH_PORT="$2"; shift 2 ;;
    --env)             require_arg "$1" "${2:-}"; ENV_FILE="$2"; shift 2 ;;
    --env-local)       require_arg "$1" "${2:-}"; ENV_LOCAL_FILE="$2"; shift 2 ;;
    --skip-migrations) SKIP_MIGRATIONS="yes"; shift ;;
    --help)            usage; exit 0 ;;
    *)                 die_usage "unknown argument: $1" ;;
  esac
done

[ -n "$HOST" ] || die_usage "-h <host> is required"
[ -n "$SSH_KEY" ] || die_usage "-i <path-to-ssh-key> is required"
[ -n "$DOMAIN" ] || die_usage "-d <domain> is required"
REMOTE_DIR="/var/www/$DOMAIN"
REMOTE_TGZ="/tmp/$APP_NAME-artifact-$$.tgz"

# --- cleanup: local temp dir, ssh tunnel, half-uploaded artifact ---
ART_DIR=""
TUNNEL_CTL=""
TGZ_UPLOADED="no"
cleanup() {
  if [ -n "$TUNNEL_CTL" ] && [ -S "$TUNNEL_CTL" ]; then
    ssh -S "$TUNNEL_CTL" -O exit "$SSH_USER@$HOST" >/dev/null 2>&1 || true
  fi
  if [ "$TGZ_UPLOADED" = "yes" ]; then
    remote_run "rm -f $REMOTE_TGZ" >/dev/null 2>&1 || true
  fi
  if [ -n "$ART_DIR" ]; then rm -rf "$ART_DIR"; fi
}
trap cleanup EXIT

# --- preflight ---
require_file "$SSH_KEY" "ssh private key not found"
if [ -n "$ENV_FILE" ]; then require_file "$ENV_FILE" "--env file not found"; fi
if [ -n "$ENV_LOCAL_FILE" ]; then require_file "$ENV_LOCAL_FILE" "--env-local file not found"; fi
[ -d "$REPO_ROOT/node_modules" ] \
  || die "local node_modules missing — this flow builds here. Run: corepack yarn install"

preflight_ssh "run setup-droplet-for-pm2.sh first?"

# Deploy dir + persistent shared/ (setup creates them too; harmless to re-ensure).
remote_script app-dirs.sh "REMOTE_DIR='$REMOTE_DIR' APP_USER='$APP_USER'" >/dev/null

# --- env files (uploaded only when explicitly passed; never overwritten otherwise) ---
push_env_files "$ENV_FILE" "$ENV_LOCAL_FILE"

# --- typecheck (local; deps are guaranteed present in this flow) ---
preflight_typecheck

# --- build (local, multi-core) ---
# NEXT_SKIP_TYPECHECK: types already checked above; don't pay for the pass twice.
log "building web (local)"
(cd "$REPO_ROOT" && NEXT_SKIP_TYPECHECK=1 corepack yarn workspace web build) \
  || die "build failed — fix before deploying"
ok "build done"

# --- assemble the artifact (same layout app-release.sh builds on the droplet) ---
log "packing release artifact"
ART_DIR="$(mktemp -d "${TMPDIR:-/tmp}/backflip-artifact-XXXXXX")"
ART_ROOT="$ART_DIR/release"
mkdir -p "$ART_ROOT"

cd "$REPO_ROOT"
[ -d apps/web/.next/standalone ] \
  || die "apps/web/.next/standalone missing — is output: \"standalone\" still set in apps/web/next.config.ts?"

# The standalone bundle mirrors the monorepo, so copying it wholesale gives
# <root>/apps/web/server.js + a minimal node_modules at the root.
# Static assets and public/ are not traced into it and must be copied in.
cp -a apps/web/.next/standalone/. "$ART_ROOT"/
mkdir -p "$ART_ROOT/apps/web/.next"
cp -a apps/web/.next/static "$ART_ROOT/apps/web/.next/static"
if [ -d apps/web/public ]; then cp -a apps/web/public "$ART_ROOT/apps/web/public"; fi

# pm2 runtime files ride along: the droplet may have no synced source in this
# flow, and pm2 startOrRestart needs $REMOTE_DIR/devops/pm2/{ecosystem,start.sh}.
mkdir -p "$ART_ROOT/devops"
cp -a devops/pm2 "$ART_ROOT/devops/pm2"

# packages/db migrations are deliberately NOT shipped: migrations run from this
# machine over an ssh tunnel (below), against the local repo's drizzle-kit.

[ -f "$ART_ROOT/apps/web/server.js" ] || die "artifact incomplete: apps/web/server.js missing"

# Cross-platform guard. The traced node_modules are built for THIS machine, so
# any native binary in them is wrong for the droplet's Linux. Today the only one
# is Next's optional sharp (image optimizer) — inert while the app uses no
# next/image, hence a warning. Anything else is required at boot → refuse.
NATIVE_BINS="$( (cd "$ART_ROOT" && find . -name '*.node' -o -name '*.dylib' -o -name '*.dll') | sed 's|^\./||' )"
if [ -n "$NATIVE_BINS" ] && [ "$(uname -s)" != "Linux" ]; then
  OTHER_BINS="$(printf '%s\n' "$NATIVE_BINS" | grep -Ev '^node_modules/(@img|sharp)/' || true)"
  if [ -n "$OTHER_BINS" ]; then
    die "artifact contains $(uname -s)/$(uname -m) native modules the droplet cannot load:
$(printf '%s\n' "$OTHER_BINS" | sed 's/^/       /')
     Deploy with ./devops/deploy-for-pm2.sh instead (builds on the droplet)."
  fi
  warn "artifact carries $(uname -s)/$(uname -m) sharp binaries (Next's optional image optimizer).
     Harmless while nothing renders next/image; the moment it does, /_next/image
     breaks on the droplet — deploy with ./devops/deploy-for-pm2.sh then."
fi
# COPYFILE_DISABLE: keep macOS tar from sprinkling ._ AppleDouble files into the
# tarball. --no-xattrs (bsdtar): drop Apple xattr pax headers too — GNU tar on
# the droplet warns "Ignoring unknown extended header keyword" on each one.
tar_flags=()
if tar --version 2>/dev/null | grep -q bsdtar; then tar_flags=(--no-xattrs --no-mac-metadata); fi
COPYFILE_DISABLE=1 tar "${tar_flags[@]}" -czf "$ART_DIR/artifact.tgz" -C "$ART_ROOT" .
ok "artifact $(du -h "$ART_DIR/artifact.tgz" | cut -f1 | tr -d ' ')"

# --- upload + extract into the inactive slot (root: owns /var/www/<domain>) ---
log "uploading artifact → $SSH_USER@$HOST:$REMOTE_TGZ"
remote_copy "$ART_DIR/artifact.tgz" "$REMOTE_TGZ"
TGZ_UPLOADED="yes"

remote_script artifact-extract.sh \
  "REMOTE_DIR='$REMOTE_DIR' APP_USER='$APP_USER' ARTIFACT='$REMOTE_TGZ'"
TGZ_UPLOADED="no"   # the fragment removes it
ok "slot staged"

# --- migrations (from here, through an ssh tunnel) ---
# Order matches the droplet-build flow: build ok → migrate → flip. A failed
# migration aborts before the flip, so the live slot keeps serving.
if [ "$SKIP_MIGRATIONS" = "yes" ]; then
  warn "skipping migrations (--skip-migrations)"
else
  log "checking database"
  remote_script db-ready.sh "REMOTE_DIR='$REMOTE_DIR'"

  # Droplet DATABASE_URL: the only place the db creds live.
  REMOTE_DB_URL="$(remote_run "grep -E '^DATABASE_URL=' $REMOTE_DIR/.env | head -1 | cut -d= -f2-" \
    | tr -d '\r' | sed -e 's/^"//' -e "s/^'//" -e 's/"$//' -e "s/'$//")"
  [ -n "$REMOTE_DB_URL" ] || die "no DATABASE_URL in $REMOTE_DIR/.env — fix the droplet env or pass --skip-migrations"

  # user:pass@host[:port]/rest — greedy pass so an @ inside it splits at the last one.
  # `rest` keeps the db name plus any ?query, so it is reused verbatim below.
  if [[ "$REMOTE_DB_URL" =~ ^(postgresql|postgres)://([^:]+):(.*)@([^@:/]+)(:([0-9]+))?/(.+)$ ]]; then
    DB_USER="${BASH_REMATCH[2]}"
    DB_PASS="${BASH_REMATCH[3]}"
    DB_PORT="${BASH_REMATCH[6]:-5432}"
    DB_REST="${BASH_REMATCH[7]}"
  else
    die "cannot parse DATABASE_URL from $REMOTE_DIR/.env (expected postgres://user:pass@host[:port]/db)"
  fi

  # Free local end of the tunnel — probe in a subshell so no fd leaks here.
  LOCAL_PORT=""
  for candidate in $(seq 54329 54349); do
    if ! (exec 3<>"/dev/tcp/127.0.0.1/$candidate") 2>/dev/null; then LOCAL_PORT="$candidate"; break; fi
  done
  [ -n "$LOCAL_PORT" ] || die "no free local port in 54329-54349 for the db tunnel"

  log "tunnelling 127.0.0.1:$LOCAL_PORT → droplet 127.0.0.1:$DB_PORT"
  # ControlMaster socket instead of a pid: teardown is `ssh -O exit`, no pgrep
  # guesswork. ExitOnForwardFailure makes a busy port fail here, not later.
  TUNNEL_CTL="$ART_DIR/tunnel.sock"
  ssh -i "$SSH_KEY" -p "$SSH_PORT" "${SSH_OPTS[@]}" \
    -o ExitOnForwardFailure=yes -M -S "$TUNNEL_CTL" -f -N \
    -L "$LOCAL_PORT:127.0.0.1:$DB_PORT" "$SSH_USER@$HOST" \
    || die "could not open the db tunnel to $SSH_USER@$HOST"

  log "migrations (drizzle-kit, local → tunnel)"
  # DATABASE_URL is exported, and packages/db/src/load-env.ts calls dotenv
  # `config()` without `override` — dotenv never overwrites an already-set
  # process.env key, so this wins over the local repo's .env/.env.local.
  (cd "$REPO_ROOT" && DATABASE_URL="postgres://$DB_USER:$DB_PASS@127.0.0.1:$LOCAL_PORT/$DB_REST" corepack yarn db:migrate) \
    || die "migrations failed — the live slot is untouched; fix and re-run"

  ssh -S "$TUNNEL_CTL" -O exit "$SSH_USER@$HOST" >/dev/null 2>&1 || true
  TUNNEL_CTL=""
  ok "migrations applied"
fi

# --- go live (app user: pm2 + the symlink it serves) ---
log "activating slot (as $APP_USER)"
remote_script slot-activate.sh \
  "sudo -H -u $APP_USER REMOTE_DIR='$REMOTE_DIR' APP_NAME='$APP_NAME' APP_PORT='$APP_PORT' NEEDS_NVM=yes"
ok "release live"

# --- health check ---
log "health check"
PM2_STATUS="$(pm2_health yes)"

if [ "$PM2_STATUS" != "online" ]; then
  warn "pm2 reports $APP_NAME status: ${PM2_STATUS:-unknown}"
  pm2_logs_tail yes
  die "app process is not online"
fi
ok "pm2 online"

CODE="$(http_health)"

# Any HTTP response means the stack is serving. With TLS issued, nginx answers
# :80 with a 301 to https — only "no response at all" is a failure.
case "$CODE" in
  000) die "no HTTP response on port 80. Check: pm2 logs $APP_NAME / systemctl status nginx" ;;
  2*)  ok "http $CODE" ;;
  *)   warn "http $CODE (expected — nginx redirects :80 to https once TLS is issued); stack is responding" ;;
esac

LIVE_SLOT="$(remote_run "readlink $REMOTE_DIR/current" 2>/dev/null || echo unknown)"

cat <<DONE

$(ok "deploy complete (built locally)")

  host       $SSH_USER@$HOST
  dir        $REMOTE_DIR
  live slot  $LIVE_SLOT ($REMOTE_DIR/current)
  migrations $([ "$SKIP_MIGRATIONS" = "yes" ] && echo skipped || echo applied)

  Logs:     ssh -i $SSH_KEY -p $SSH_PORT $SSH_USER@$HOST "sudo -H -u $APP_USER bash -c 'cd; . \\\$HOME/.nvm/nvm.sh; pm2 logs $APP_NAME'"
  Status:   ssh -i $SSH_KEY -p $SSH_PORT $SSH_USER@$HOST "sudo -H -u $APP_USER bash -c 'cd; . \\\$HOME/.nvm/nvm.sh; pm2 status'; readlink $REMOTE_DIR/current; systemctl status nginx --no-pager | head -5"
  Rollback: ./devops/rollback-for-pm2.sh -h $HOST -i $SSH_KEY -d $DOMAIN -n $APP_NAME --app-port $APP_PORT

  Site: https://$DOMAIN
DONE
