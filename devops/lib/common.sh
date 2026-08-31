# @spec L2-DEVOPS-03
# Shared helpers for the devops scripts. Source it, don't execute it.
# Callers set: HOST (required), SSH_KEY (required), SSH_USER (default root), SSH_PORT (default 22).

# Colors only on a tty.
if [ -t 1 ]; then
  _C_RESET=$'\033[0m'; _C_DIM=$'\033[2m'; _C_RED=$'\033[31m'
  _C_GREEN=$'\033[32m'; _C_YELLOW=$'\033[33m'; _C_BLUE=$'\033[34m'
else
  _C_RESET=''; _C_DIM=''; _C_RED=''; _C_GREEN=''; _C_YELLOW=''; _C_BLUE=''
fi

log()  { printf '%s==>%s %s\n' "$_C_BLUE" "$_C_RESET" "$*"; }
ok()   { printf '%s ok %s %s\n' "$_C_GREEN" "$_C_RESET" "$*"; }
warn() { printf '%swarn%s %s\n' "$_C_YELLOW" "$_C_RESET" "$*" >&2; }
note() { printf '%s%s%s\n' "$_C_DIM" "$*" "$_C_RESET"; }
die()  { printf '%sfail%s %s\n' "$_C_RED" "$_C_RESET" "$*" >&2; exit 1; }

# require_file <path> [hint] — die unless the file exists.
require_file() {
  [ -f "$1" ] || die "missing file: $1${2:+ — $2}"
}

# usage support. Callers define usage(); these print it on bad input.
# die_usage <msg>
die_usage() {
  printf '%sfail%s %s\n\n' "$_C_RED" "$_C_RESET" "$*" >&2
  usage >&2
  exit 1
}

# require_arg <flag> <value> — die unless the flag got a non-empty value.
require_arg() {
  [ -n "${2:-}" ] || die_usage "$1 requires a value"
}

# Paths. REPO_ROOT = two levels up from this file (devops/lib → repo root).
_COMMON_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEVOPS_DIR="${DEVOPS_DIR:-$(cd "$_COMMON_DIR/.." && pwd)}"
REPO_ROOT="${REPO_ROOT:-$(cd "$_COMMON_DIR/../.." && pwd)}"
# Instance identity: several instances can share one droplet. The domain keys
# the deploy dir (/var/www/<domain> — source at the root, blue/ + green/ release
# slots, `current` symlink, shared/ instance data); APP_NAME names the pm2
# process and nginx site; APP_PORT the loopback port. Scripts taking -d/--domain
# set REMOTE_DIR after parsing flags.
APP_NAME="${APP_NAME:-backflip}"
APP_PORT="${APP_PORT:-3070}"
REMOTE_DIR="${REMOTE_DIR:-}"
# Dedicated app user: pm2 + the app run as this locked, no-ssh user; root does
# only system work (packages, db, proxy). Created by the setup scripts.
# Shared by all instances on a droplet (one pm2 daemon supervising all).
APP_USER="${APP_USER:-backflip}"

SSH_OPTS=(-o BatchMode=yes -o StrictHostKeyChecking=accept-new)

# Validate + default the connection vars. Called by every remote helper.
_ssh_ready() {
  : "${HOST:?HOST not set}"
  : "${SSH_KEY:?SSH_KEY not set}"
  SSH_USER="${SSH_USER:-root}"
  SSH_PORT="${SSH_PORT:-22}"
}

# remote_run "<cmd>" — run a command on the droplet. Stdin is forwarded, so
# `remote_run 'bash -s' <<'EOF' … EOF` works for multi-line remote scripts.
remote_run() {
  _ssh_ready
  ssh -i "$SSH_KEY" -p "$SSH_PORT" "${SSH_OPTS[@]}" "$SSH_USER@$HOST" "$@"
}

# remote_copy <local> <remote> — copy a single file to the droplet.
remote_copy() {
  _ssh_ready
  scp -i "$SSH_KEY" -P "$SSH_PORT" "${SSH_OPTS[@]}" "$1" "$SSH_USER@$HOST:$2"
}

# remote_script <fragment> [prefix …] — run devops/lib/remote/<fragment> on the
# droplet by piping its content into `bash -s`. Everything after the fragment
# name is the remote command prefix, so callers pass parameters as env
# (already quoted), e.g.
#   remote_script app-release.sh "sudo -H -u $APP_USER REMOTE_DIR='$REMOTE_DIR'"
# Fragments are plain bash: no common.sh, no local vars — they run remotely.
remote_script() {
  local frag="$1"; shift
  local path="$DEVOPS_DIR/lib/remote/$frag"
  require_file "$path" "remote fragment missing"
  remote_run "$* bash -s" < "$path"
}

# sync_repo — mirror the repo root to $REMOTE_DIR. --delete, so the droplet
# copy tracks the working tree exactly; env files and build output are excluded
# (secrets live only on the droplet, artifacts are rebuilt there).
# Excluded paths are also protected from --delete, so the droplet's own .env,
# .env.local and .env.init survive every sync. The `*.pem` / `env*.deploy`
# excludes keep CI-written keys and env payloads off the droplet, and
# anchored /blue, /green, /current keep the release slots (served by pm2) out of
# rsync's reach, and /shared protects persistent instance data (uploads).
# Note: SSH_KEY paths with spaces aren't supported (rsync splits -e on spaces).
# When syncing as root, files are chowned to $APP_USER after the sync so the
# app user can install/build in the tree (a non-root SSH_USER is assumed to BE
# the app user). Post-sync chown, not rsync --chown — macOS rsync lacks it.
sync_repo() {
  _ssh_ready
  : "${REMOTE_DIR:?REMOTE_DIR not set (script must derive it from the domain)}"
  log "syncing $REPO_ROOT → $SSH_USER@$HOST:$REMOTE_DIR"
  rsync -az --delete \
    --exclude '.git' \
    --exclude 'node_modules' \
    --exclude '.next' \
    --exclude '.turbo' \
    --exclude '/blue' \
    --exclude '/green' \
    --exclude '/shared' \
    --exclude '/current' \
    --exclude '.env' \
    --exclude '.env.local' \
    --exclude '.env.init' \
    --exclude '.env.*' \
    --exclude '*.pem' \
    --exclude 'env.deploy' \
    --exclude 'env.local.deploy' \
    -e "ssh -i $SSH_KEY -p $SSH_PORT -o BatchMode=yes -o StrictHostKeyChecking=accept-new" \
    "$REPO_ROOT/" "$SSH_USER@$HOST:$REMOTE_DIR/"
  if [ "$SSH_USER" = "root" ]; then
    remote_run "chown -R $APP_USER:$APP_USER $REMOTE_DIR"
  fi
}

# preflight_ssh [hint] — die unless the droplet answers ssh.
preflight_ssh() {
  log "checking ssh to $SSH_USER@$HOST:$SSH_PORT"
  remote_run true >/dev/null 2>&1 || die "cannot ssh to $SSH_USER@$HOST:$SSH_PORT${1:+ ($1)}"
}

# push_env_files <env-file> <env-local-file> — upload the two env files when the
# caller passed them (empty = leave the droplet's copies alone), then require
# both to exist on the droplet. 0600 + owned by $APP_USER: only the app reads them.
push_env_files() {
  : "${REMOTE_DIR:?REMOTE_DIR not set}"
  if [ -n "${1:-}" ]; then
    log "uploading $1 → $REMOTE_DIR/.env"
    remote_copy "$1" "$REMOTE_DIR/.env"
    remote_run "chmod 600 $REMOTE_DIR/.env && chown $APP_USER:$APP_USER $REMOTE_DIR/.env"
  fi
  if [ -n "${2:-}" ]; then
    log "uploading $2 → $REMOTE_DIR/.env.local"
    remote_copy "$2" "$REMOTE_DIR/.env.local"
    remote_run "chmod 600 $REMOTE_DIR/.env.local && chown $APP_USER:$APP_USER $REMOTE_DIR/.env.local"
  fi

  if ! remote_run "test -f $REMOTE_DIR/.env && test -f $REMOTE_DIR/.env.local"; then
    die "$REMOTE_DIR/.env and $REMOTE_DIR/.env.local must both exist on the droplet.
     Fill in devops/env/production.env.example and devops/env/production.env.local.example,
     then re-run with --env <file> --env-local <file>."
  fi
  ok "droplet env present"
}

# preflight_typecheck — the droplet build skips the TypeScript pass
# (NEXT_SKIP_TYPECHECK=1); it costs ~60s on a 1-vCPU droplet. Check here instead,
# where it's fast. Skipped when deps aren't installed (e.g. thin CI wrappers) —
# CI should typecheck separately.
preflight_typecheck() {
  if [ -d "$REPO_ROOT/node_modules" ]; then
    log "typecheck (local)"
    (cd "$REPO_ROOT" && corepack yarn workspace web typecheck) || die "typecheck failed — fix before deploying"
    ok "typecheck clean"
  else
    warn "node_modules missing locally — skipping preflight typecheck (droplet build skips it too)"
  fi
}

# pm2_health <needs-nvm> — echo the pm2 status of $APP_NAME ("online", "stopped",
# "missing", …). Name-scoped so other instances on the shared daemon don't matter.
pm2_health() {
  remote_script health-pm2.sh "sudo -H -u $APP_USER APP_NAME='$APP_NAME' NEEDS_NVM='${1:-no}'"
}

# pm2_logs_tail <needs-nvm> — dump the last lines of the app's pm2 log (failure path).
pm2_logs_tail() {
  if [ "${1:-no}" = "yes" ]; then
    remote_run "sudo -H -u $APP_USER bash -c 'cd; . \"\$HOME/.nvm/nvm.sh\"; pm2 logs $APP_NAME --lines 30 --nostream'" || true
  else
    remote_run "sudo -H -u $APP_USER bash -c 'cd; pm2 logs $APP_NAME --lines 30 --nostream'" || true
  fi
}

# http_health — echo the HTTP status code the droplet's :80 answers with ("000" = none).
http_health() {
  remote_script health-http.sh ""
}
