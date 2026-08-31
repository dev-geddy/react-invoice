---
name: digitalocean-devops
description: >
  Covers provisioning a DigitalOcean droplet and deploying this app to it
  (local script, GitHub Actions, Drone CI), migrations included. Load ONLY
  when the user explicitly asks about deployment, devops, the droplet,
  DigitalOcean, or CI deploys. Also on: "deploy", "deployment", "droplet",
  "digitalocean", "provision server", "devops".
---

# digitalocean-devops

How this repo provisions and deploys to a DigitalOcean droplet. Terse. Do not
load for general dev tasks — see `dev-workflow` for that.

## Layout
Two droplet flavors; matching setup + deploy script pairs.
- `devops/setup-droplet-for-pm2.sh` — provision, pm2 flavor (preferred): nvm Node 24 + corepack yarn 4, pm2, nginx + certbot TLS (`-d <domain>` required, `-m <email>` recommended). No Docker.
- `devops/setup-droplet-for-docker.sh` — provision, docker flavor: apt Node 24, pm2, native Caddy, Docker for db.
- `devops/setup-droplet-db-native.sh` — db for pm2 flavor: native Postgres 17 (PGDG), loopback, creates role+db, prints `DATABASE_URL`.
- `devops/setup-droplet-db-docker.sh` — db alternative: Docker engine only; db container starts on first deploy.
- `devops/deploy-for-pm2.sh` / `devops/deploy-for-docker.sh` — deploy/redeploy entrypoints (same flags). Blue/green: release lands in the inactive slot (`blue/`|`green/` under `/var/www/<domain>`), `current` symlink flips only after assembly — failures leave the live slot serving. `shared/` = persistent instance data, never touched by deploys.
- `devops/deploy-for-pm2-build-locally.sh` — fast deploy: builds on the operator machine, ships a tar artifact, extracts to the inactive slot, migrations via SSH tunnel (db loopback-only). Same flags. Falls back to deploy-for-pm2.sh if native binaries detected in artifact.
- `devops/rollback-for-pm2.sh -h -i -d [-n --app-port]` — flip `current` to the previous slot + pm2 restart (code only, no migration revert; refuses on empty slot).
- Scripts are thin orchestrators over `devops/lib/remote/*.sh` fragments (standalone bash, piped via `remote_script`); shared base/hardening/node/db/health fragments.
- `devops/lib/common.sh` — shared helpers sourced by all scripts.
- `devops/compose.prod.yml` — db-only compose (Postgres, loopback `127.0.0.1:5432`).
- `devops/pm2/start.sh`, `devops/pm2/ecosystem.config.cjs` — pm2 entry/config for the app process (`backflip`).
- `devops/Caddyfile` — Caddy template (`__DOMAIN__`); deploy-for-docker.sh renders it to `/etc/caddy/Caddyfile`.
- `devops/nginx/backflip.conf` — nginx site template (`__DOMAIN__`); setup-droplet-for-pm2.sh renders it; certbot injects TLS.
- `devops/env/*.example` — env templates (source for first deploy's `.env`/`.env.local`).
- Docs: root `devops.md` (index) → `devops/docs/{droplet-setup,deploy-local,deploy-github-actions,deploy-drone}.md` (one per build setup).
- CI: `.github/workflows/deploy.yml` (`workflow_dispatch`), `.drone.yml` pipeline `deploy` (**push to master**, or promote to re-run an older master build) — both call `deploy-for-pm2-build-locally.sh` on a glibc runner (matches the droplet's pm2 flavor; alpine would ship musl binaries). `.drone.yml` also has pipeline `ci` (push + PR: install → typecheck → lint), which runs beside `deploy` on master without gating it. Push to master is the routine deploy; the local script is break-glass.

## Key commands
- Provision pm2 flavor (once): `./devops/setup-droplet-for-pm2.sh -h <host> -i <ssh-key> -d <domain> -m <email>` then a db script.
- Provision docker flavor (once): `./devops/setup-droplet-for-docker.sh -h <host> -i <ssh-key>`.
- Deploy: `./devops/deploy-for-pm2.sh|deploy-for-docker.sh -h <host> -i <ssh-key> [--env <f> --env-local <f>] [--skip-migrations]`.
  - First deploy: pass `--env`/`--env-local`, filled from `devops/env/*.example`.
  - Later deploys: omit them — droplet env is never overwritten.
  - Flow: rsync → `yarn install` → db ready (native `pg_isready` or compose up + health wait) → `yarn workspace web build` (standalone) → drizzle migrate on host → copy to timestamped release dir + flip `current` symlink → `pm2 startOrRestart` → proxy (docker flavor: render + reload Caddy; pm2 flavor: nginx untouched) → health check.
- Both setups harden the droplet: ssh key-only, fail2ban, unattended-upgrades.
- pm2-flavor droplet, non-interactive ssh: `. .nvm/nvm.sh` before `pm2`/`corepack` commands.

## Conventions (preserve when extending)
- All deploy logic lives in `devops/*.sh`. CI files (`deploy.yml`, `.drone.yml`) are thin wrappers that call a deploy script — never duplicate logic in CI YAML.
- New CI provider = new thin wrapper script + new short doc in `devops/docs/`, linked from `devops.md`.
- Docs stay short and actionable.
- Droplet runtime env = `/var/www/<domain>/.env` + `.env.local`.
- Droplet runtime = pm2 process `backflip` serving `/var/www/<domain>/current` (Next standalone). Releases pruned to last 3.
- Compose (db only) is always invoked as `docker compose --project-directory . -f devops/compose.prod.yml`, run from `/var/www/<domain>`.

## Before changing anything
Read `devops.md` + the relevant `devops/docs/*.md` first. Domain contract:
`docs/contracts/devops.md` (L2). Follow `docs-sync` for any doc updates.
