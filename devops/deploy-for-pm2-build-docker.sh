#!/usr/bin/env bash
# @spec L2-DEVOPS-02, L2-DEVOPS-07, L2-DEVOPS-15, L2-DEVOPS-16, L2-DEVOPS-27
# Deploy to a pm2-flavor droplet with the build done in a DOCKER CONTAINER that
# matches the droplet (linux/amd64, glibc, Node 24), then ship only the
# assembled release as a tarball. Third member of the deploy family:
#
#   deploy-for-pm2.sh                — build ON the droplet     (slow, always correct)
#   deploy-for-pm2-build-locally.sh  — build on the operator OS (fast, arch-fragile)
#   deploy-for-pm2-build-docker.sh   — build in a droplet-like container (this one)
#
# The point is correctness, not speed: the build-locally flow ships the operator
# machine's traced node_modules, which on macOS means Darwin/arm64 sharp binaries
# that only survive because nothing calls them. Here the artifact is produced on
# linux/amd64 glibc, so every native module in it is one the droplet can actually
# load — and the arch guard below FAILS the deploy if that is ever not true.
#
# Cost: on an arm64 operator machine the container is emulated, so a CPU-bound
# Next build is slower than the native one — how much slower depends entirely on
# the emulator. Docker Desktop's Rosetta backend (Settings → General → "Use
# Rosetta for x86_64/amd64 emulation") costs roughly 2x; plain QEMU costs far
# more. Warm BuildKit caches (yarn cache + .next/cache, both named cache mounts
# in devops/Dockerfile.build-artifact) take most of the rest back on repeat runs.
# Measured numbers and the honest speed comparison: devops/docs/deploy-local.md.
#
# Flow: preflight → native typecheck → container build (linux/amd64) → export
# artifact → upload + extract into the INACTIVE blue/green slot → migrate (over
# an ssh tunnel, from here) → flip `current` + pm2 restart → health check.
# Blue/green and rollback semantics are identical to the sibling scripts:
# everything before the flip leaves the live slot serving, and the previous slot
# stays on disk for devops/rollback-for-pm2.sh.
#
# Caveats:
# - Same as the build-locally flow: no source rsync, so a droplet previously
#   deployed with deploy-for-pm2.sh keeps a stale source copy. Harmless — only
#   the env files, shared/, the slots and devops/pm2/ (refreshed from every
#   artifact) matter at runtime. The three scripts agree on the layout and can
#   be alternated on one instance.
# - Migrations run from here through an ssh tunnel: droplet Postgres listens on
#   loopback only and this flow leaves no drizzle-kit on the droplet. That needs
#   local node_modules (unless --skip-migrations / --build-only).
# - The droplet's .env/.env.local are never touched unless --env/--env-local is
#   passed, and the app is never rebuilt on the droplet.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/common.sh
source "$SCRIPT_DIR/lib/common.sh"

usage() {
  cat <<'USAGE'
Deploy the app to a pm2-flavor droplet, building in a droplet-like container:
typecheck (native) → build in linux/amd64 glibc Node 24 → export artifact →
upload → extract into the inactive slot → migrate (via ssh tunnel) → flip
`current` → pm2 restart → health check.

Same droplet layout, flags and blue/green semantics as
./devops/deploy-for-pm2-build-locally.sh — only the build location differs, and
the artifact is guaranteed to carry the droplet's own Linux/x86-64 binaries.
nginx + TLS are owned by setup; deploy does not touch them.

Usage:
  ./devops/deploy-for-pm2-build-docker.sh -h <host> -i <path-to-ssh-key> -d <domain>
                             [-n <app-name>] [--app-port <port>] [-u user] [-p port]
                             [--env <file>] [--env-local <file>] [--skip-migrations]
                             [--platform <p>] [--build-only] [--no-cache]

  -h  droplet host or IP        (required unless --build-only)
  -i  ssh private key path      (required unless --build-only)
  -d  domain of this instance   (required unless --build-only — keys the deploy dir
                                 /var/www/<domain>; must match setup -d)
  -n  app/instance name         (default: backflip — must match setup -n)
  --app-port  app loopback port (default: 3070 — must match setup --app-port)
  -u  ssh user                  (default: root)
  -p  ssh port                  (default: 22)

  --env <file>        upload as /var/www/<domain>/.env       (first deploy only)
  --env-local <file>  upload as /var/www/<domain>/.env.local (first deploy only)
  --skip-migrations   don't run drizzle migrations

  --platform <p>      build platform (default: linux/amd64 — the droplet's).
                      Set linux/arm64 for an arm droplet, or on an arm operator
                      machine only if the droplet is arm too.
  --build-only        build + assemble + verify the artifact, print its path and
                      size, then exit. Touches no remote host at all.
  --no-cache          ignore the BuildKit cache (cold build; for measuring).

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
PLATFORM="linux/amd64"
BUILD_ONLY="no"
NO_CACHE="no"

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
    --platform)        require_arg "$1" "${2:-}"; PLATFORM="$2"; shift 2 ;;
    --build-only)      BUILD_ONLY="yes"; shift ;;
    --no-cache)        NO_CACHE="yes"; shift ;;
    --help)            usage; exit 0 ;;
    *)                 die_usage "unknown argument: $1" ;;
  esac
done

if [ "$BUILD_ONLY" = "no" ]; then
  [ -n "$HOST" ] || die_usage "-h <host> is required (or use --build-only)"
  [ -n "$SSH_KEY" ] || die_usage "-i <path-to-ssh-key> is required (or use --build-only)"
  [ -n "$DOMAIN" ] || die_usage "-d <domain> is required (or use --build-only)"
fi
REMOTE_DIR="/var/www/$DOMAIN"
REMOTE_TGZ="/tmp/$APP_NAME-artifact-$$.tgz"

# The artifact lives in the repo, not /tmp: --build-only exists so it can be
# inspected afterwards, and one fixed name means runs don't pile up.
ART_OUT_DIR="$REPO_ROOT/.artifacts"
ART_TGZ="$ART_OUT_DIR/$APP_NAME-artifact.tgz"
BUILDX_OUT="$ART_OUT_DIR/artifact.tgz"   # buildx names the exported file after the image path

# --- cleanup: unpack dir, ssh tunnel, half-uploaded artifact ---
# The artifact itself is deliberately NOT cleaned up — it is the deliverable.
VERIFY_DIR=""
TUNNEL_CTL=""
TGZ_UPLOADED="no"
cleanup() {
  if [ -n "$TUNNEL_CTL" ] && [ -S "$TUNNEL_CTL" ]; then
    ssh -S "$TUNNEL_CTL" -O exit "$SSH_USER@$HOST" >/dev/null 2>&1 || true
  fi
  if [ "$TGZ_UPLOADED" = "yes" ]; then
    remote_run "rm -f $REMOTE_TGZ" >/dev/null 2>&1 || true
  fi
  if [ -n "$VERIFY_DIR" ]; then rm -rf "$VERIFY_DIR"; fi
}
trap cleanup EXIT

# --- preflight ---
command -v docker >/dev/null 2>&1 \
  || die "docker not found — this flow builds in a container. Install Docker Desktop, or use ./devops/deploy-for-pm2-build-locally.sh"
docker buildx version >/dev/null 2>&1 \
  || die "docker buildx not available — needed for cross-platform builds and the artifact export"
docker info >/dev/null 2>&1 \
  || die "docker daemon not responding — start Docker Desktop and retry"

DOCKERFILE="$DEVOPS_DIR/Dockerfile.build-artifact"
require_file "$DOCKERFILE" "the artifact build image is missing"

if [ "$BUILD_ONLY" = "no" ]; then
  require_file "$SSH_KEY" "ssh private key not found"
  if [ -n "$ENV_FILE" ]; then require_file "$ENV_FILE" "--env file not found"; fi
  if [ -n "$ENV_LOCAL_FILE" ]; then require_file "$ENV_LOCAL_FILE" "--env-local file not found"; fi
  # Migrations run from HERE (droplet Postgres is loopback-only and this flow
  # installs nothing there), so they need the local drizzle-kit.
  if [ "$SKIP_MIGRATIONS" = "no" ] && [ ! -d "$REPO_ROOT/node_modules" ]; then
    die "local node_modules missing — migrations run from this machine over an ssh tunnel.
     Run: corepack yarn install   (or pass --skip-migrations)"
  fi
fi

# Emulation notice. Cross-arch builds are slower than native; on Docker Desktop
# for Apple Silicon with Rosetta enabled it is roughly 2x, under plain QEMU much
# worse. Say so up front rather than leaving the operator wondering — and point
# at the Rosetta toggle, which is the single biggest lever here.
HOST_ARCH="$(uname -m)"
case "$PLATFORM:$HOST_ARCH" in
  linux/amd64:arm64|linux/amd64:aarch64|linux/arm64:x86_64|linux/arm64:amd64)
    note "     $PLATFORM on $HOST_ARCH — emulated build, slower than native.
     macOS: keep Docker Desktop → Settings → General → \"Use Rosetta for
     x86_64/amd64 emulation\" ON (~2x native instead of far worse).
     Repeat runs reuse the warm BuildKit caches." ;;
esac

if [ "$BUILD_ONLY" = "no" ]; then
  preflight_ssh "run setup-droplet-for-pm2.sh first?"

  # Deploy dir + persistent shared/ (setup creates them too; harmless to re-ensure).
  remote_script app-dirs.sh "REMOTE_DIR='$REMOTE_DIR' APP_USER='$APP_USER'" >/dev/null

  # --- env files (uploaded only when explicitly passed; never overwritten otherwise) ---
  push_env_files "$ENV_FILE" "$ENV_LOCAL_FILE"
fi

# --- typecheck (native — never under emulation) ---
# The container build sets NEXT_SKIP_TYPECHECK=1 for exactly this reason.
preflight_typecheck

# --- build the artifact inside a droplet-like container ---
log "building web in a $PLATFORM container (docker buildx)"
note "     image: $(grep -m1 '^ARG NODE_IMAGE=' "$DOCKERFILE" | cut -d= -f2-) — glibc, Node 24, matches the droplet"
mkdir -p "$ART_OUT_DIR"
rm -f "$BUILDX_OUT" "$ART_TGZ"

build_args=(
  buildx build
  --platform "$PLATFORM"
  --file "$DOCKERFILE"
  --target artifact
  --output "type=local,dest=$ART_OUT_DIR"
  --progress plain
)
[ "$NO_CACHE" = "yes" ] && build_args+=(--no-cache)
build_args+=("$REPO_ROOT")

# BUILDKIT_PROGRESS is honoured by some setups instead of --progress; harmless twice.
(cd "$REPO_ROOT" && BUILDKIT_PROGRESS=plain docker "${build_args[@]}") \
  || die "container build failed — fix before deploying"

[ -f "$BUILDX_OUT" ] || die "buildx produced no $BUILDX_OUT — check the build log above"
mv "$BUILDX_OUT" "$ART_TGZ"
ok "build done"

# --- verify the artifact (layout + native binary arch) ---
# A silently-wrong artifact is worse than a slow build: it deploys green and
# then fails at runtime, on the droplet, in production. Everything below is a
# hard failure.
log "verifying artifact"
VERIFY_DIR="$(mktemp -d "${TMPDIR:-/tmp}/backflip-verify-XXXXXX")"
tar -xzf "$ART_TGZ" -C "$VERIFY_DIR"

# Layout: exactly what devops/lib/remote/artifact-extract.sh untars and asserts.
[ -f "$VERIFY_DIR/apps/web/server.js" ] \
  || die "artifact incomplete: apps/web/server.js missing — is output: \"standalone\" still set in apps/web/next.config.ts?"
[ -d "$VERIFY_DIR/apps/web/.next/static" ] \
  || die "artifact incomplete: apps/web/.next/static missing (client assets are not traced into the standalone bundle)"
[ -f "$VERIFY_DIR/devops/pm2/ecosystem.config.cjs" ] \
  || die "artifact incomplete: devops/pm2/ecosystem.config.cjs missing — pm2 needs it at \$REMOTE_DIR/devops/pm2"
[ -f "$VERIFY_DIR/devops/pm2/start.sh" ] \
  || die "artifact incomplete: devops/pm2/start.sh missing"
[ -d "$VERIFY_DIR/node_modules" ] \
  || die "artifact incomplete: no node_modules at the artifact root (the standalone trace produced nothing)"

# bin_kind <file> — classify an executable by its magic bytes. `od` is POSIX and
# always present; `file` is not guaranteed and its wording varies by platform.
# ELF: bytes 0-3 = 7f454c46, e_machine at bytes 18-19 little-endian
#      (0x003e = x86-64, 0x00b7 = aarch64).
# Mach-O: cffaedfe / cefaedfe (thin, LE), cafebabe / bebafeca (fat).
# PE/COFF: 4d5a ("MZ").
bin_kind() {
  local hdr
  hdr="$(od -An -tx1 -N20 -v "$1" 2>/dev/null | tr -d ' \n')"
  case "$hdr" in
    7f454c46*)
      case "${hdr:36:4}" in
        3e00) echo "Linux/x86-64" ;;
        b700) echo "Linux/aarch64" ;;
        *)    echo "Linux/unknown-arch" ;;
      esac ;;
    cffaedfe*|cefaedfe*|cafebabe*|bebafeca*) echo "Darwin/Mach-O" ;;
    4d5a*)                                   echo "Windows/PE" ;;
    *)                                       echo "unrecognized" ;;
  esac
}

# What the droplet can load, derived from the platform we asked for.
case "$PLATFORM" in
  linux/amd64|linux/amd64/*) WANT_KIND="Linux/x86-64" ;;
  linux/arm64|linux/arm64/*) WANT_KIND="Linux/aarch64" ;;
  *)                         WANT_KIND="" ;;
esac

NATIVE_BINS="$( (cd "$VERIFY_DIR" && find . \( -name '*.node' -o -name '*.dylib' -o -name '*.dll' -o -name '*.so' -o -name '*.so.*' \) ) | sed 's|^\./||' | LC_ALL=C sort )"

if [ -z "$NATIVE_BINS" ]; then
  note "     no native modules in the artifact (pure JS release)"
elif [ -z "$WANT_KIND" ]; then
  warn "unknown --platform '$PLATFORM' — cannot assert the native module arch. Verify by hand:
$(printf '%s\n' "$NATIVE_BINS" | sed 's/^/       /')"
else
  BAD_ARCH=""
  BAD_LIBC=""
  N_OK=0
  while IFS= read -r rel; do
    [ -n "$rel" ] || continue
    kind="$(bin_kind "$VERIFY_DIR/$rel")"
    if [ "$kind" != "$WANT_KIND" ]; then
      BAD_ARCH="$BAD_ARCH$rel — $kind"$'\n'
      continue
    fi
    # glibc, not musl. The droplet is Ubuntu; a musl-linked .node dies at
    # require() with "Error loading shared library ld-musl-x86_64.so.1".
    # Two independent tells: the interpreter string inside the binary, and
    # the platform package name npm resolved (…-linuxmusl-…).
    if LC_ALL=C grep -aq 'ld-musl' "$VERIFY_DIR/$rel" 2>/dev/null \
       || printf '%s' "$rel" | grep -q 'linuxmusl'; then
      BAD_LIBC="$BAD_LIBC$rel"$'\n'
      continue
    fi
    N_OK=$((N_OK + 1))
  done <<< "$NATIVE_BINS"

  if [ -n "$BAD_ARCH" ]; then
    die "artifact carries native modules the droplet cannot load (expected $WANT_KIND):
$(printf '%s' "$BAD_ARCH" | sed 's/^/       /')
     The container build produced the wrong platform — check --platform and that
     buildx really emulated $PLATFORM (docker buildx ls)."
  fi
  if [ -n "$BAD_LIBC" ]; then
    die "artifact carries musl-linked native modules; the droplet is glibc (Ubuntu):
$(printf '%s' "$BAD_LIBC" | sed 's/^/       /')
     devops/Dockerfile.build-artifact must stay on a glibc base image
     (node:24-bookworm-slim), never alpine."
  fi
  ok "native modules: $N_OK × $WANT_KIND glibc"
  note "$(printf '%s\n' "$NATIVE_BINS" | sed 's/^/       /')"
fi

ART_SIZE="$(du -h "$ART_TGZ" | cut -f1 | tr -d ' ')"
ok "artifact $ART_SIZE"

rm -rf "$VERIFY_DIR"; VERIFY_DIR=""

if [ "$BUILD_ONLY" = "yes" ]; then
  cat <<BUILDONLY

$(ok "artifact built and verified (--build-only, nothing deployed)")

  path      $ART_TGZ
  size      $ART_SIZE
  platform  $PLATFORM

  Inspect:  tar -tzf $ART_TGZ | head
  Deploy:   ./devops/deploy-for-pm2-build-docker.sh -h <host> -i <ssh-key> -d <domain>
BUILDONLY
  exit 0
fi

# --- upload + extract into the inactive slot (root: owns /var/www/<domain>) ---
log "uploading artifact → $SSH_USER@$HOST:$REMOTE_TGZ"
remote_copy "$ART_TGZ" "$REMOTE_TGZ"
TGZ_UPLOADED="yes"

remote_script artifact-extract.sh \
  "REMOTE_DIR='$REMOTE_DIR' APP_USER='$APP_USER' ARTIFACT='$REMOTE_TGZ'"
TGZ_UPLOADED="no"   # the fragment removes it
ok "slot staged"

# --- migrations (from here, through an ssh tunnel) ---
# Order matches the sibling flows: build ok → migrate → flip. A failed migration
# aborts before the flip, so the live slot keeps serving.
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
  TUNNEL_CTL="$(mktemp -d "${TMPDIR:-/tmp}/backflip-tunnel-XXXXXX")/tunnel.sock"
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
  rm -rf "$(dirname "$TUNNEL_CTL")"
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

$(ok "deploy complete (built in a $PLATFORM container)")

  host       $SSH_USER@$HOST
  dir        $REMOTE_DIR
  live slot  $LIVE_SLOT ($REMOTE_DIR/current)
  artifact   $ART_TGZ ($ART_SIZE)
  migrations $([ "$SKIP_MIGRATIONS" = "yes" ] && echo skipped || echo applied)

  Logs:     ssh -i $SSH_KEY -p $SSH_PORT $SSH_USER@$HOST "sudo -H -u $APP_USER bash -c 'cd; . \\\$HOME/.nvm/nvm.sh; pm2 logs $APP_NAME'"
  Status:   ssh -i $SSH_KEY -p $SSH_PORT $SSH_USER@$HOST "sudo -H -u $APP_USER bash -c 'cd; . \\\$HOME/.nvm/nvm.sh; pm2 status'; readlink $REMOTE_DIR/current; systemctl status nginx --no-pager | head -5"
  Rollback: ./devops/rollback-for-pm2.sh -h $HOST -i $SSH_KEY -d $DOMAIN -n $APP_NAME --app-port $APP_PORT

  Site: https://$DOMAIN
DONE
