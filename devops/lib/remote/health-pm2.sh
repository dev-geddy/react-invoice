#!/usr/bin/env bash
# @spec L2-DEVOPS-18
# Remote fragment, runs as the app user: print this instance's pm2 status
# ("online", "stopped", "missing", …). Name-scoped, so other instances sharing
# the pm2 daemon don't affect the result.
# Env: APP_NAME, NEEDS_NVM (yes|no).
set -uo pipefail

cd "$HOME"   # sudo keeps the invoking cwd; an inaccessible cwd makes node spawns fail EACCES

if [ "${NEEDS_NVM:-no}" = "yes" ]; then
  export NVM_DIR="$HOME/.nvm"
  # shellcheck disable=SC1091
  [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
fi

pm2 jlist 2>/dev/null | node -e "
let raw = ''
process.stdin.on('data', (d) => (raw += d)).on('end', () => {
  const app = JSON.parse(raw || '[]').find((a) => a.name === process.env.APP_NAME)
  process.stdout.write(app ? String(app.pm2_env.status) : 'missing')
})
"
