# Contract (L2) — devops

> L2 = contract / what. AI proposes, human approves. Cite ≥1 L1.
> Style: terse. One fact per line.

> **Implements L1:** `L1-ARCH-06`, `L1-STACK-07`, `L1-STACK-08`, `L1-STACK-09`
> **Depends on L2:** `infra` (shares the Next standalone build per `L2-INF-04`), `db` (migrations)

## Owns
Production deployment: DigitalOcean droplet provisioning, deploy pipeline (local + CI), prod runtime (pm2 + db compose), TLS.

## Interfaces
- `L2-DEVOPS-01` — Droplet provisioning, two flavors + db scripts, all idempotent: `setup-droplet-for-pm2.sh -h <host> -i <ssh-key> -d <domain> [-m email] [-n app-name] [--app-port p]` (nvm Node 24 + corepack yarn 4, pm2, nginx + certbot TLS, no Docker); `setup-droplet-for-docker.sh -h -i -d <domain>` (apt Node 24, pm2, native Caddy, Docker for db); `setup-droplet-db-native.sh [--db-name] [--db-user] [--db-password]` (Postgres 17 PGDG, loopback, role+db, prints DATABASE_URL); `setup-droplet-db-docker.sh` (Docker engine for db-only compose). Both setup flavors include swap, ufw 22/80/443, ssh hardening key-only + fail2ban + unattended-upgrades, app dirs incl. persistent `shared/`. Entrypoints are thin orchestrators over `devops/lib/remote/*.sh` fragments.
- `L2-DEVOPS-02` — `deploy-for-pm2.sh` / `deploy-for-docker.sh -h <host> -i <ssh-key> -d <domain> [-n app-name] [--app-port p] [--env f] [--env-local f] [--skip-migrations]` — rsync → install → db ready (pm2 flavor: native `pg_isready` | compose health; docker flavor: compose health) → build → migrate → assemble into inactive slot → `current` flip → pm2 restart → proxy (docker: Caddy render+reload; pm2: nginx untouched, setup owns it) → health check. Works identically from local and CI.
- `L2-DEVOPS-08` — GitHub Actions deploy: `.github/workflows/deploy.yml`, `workflow_dispatch`, thin wrapper → `deploy-for-pm2-build-locally.sh` (`L2-DEVOPS-20`): the `ubuntu-latest` runner (glibc, matches the droplet) installs deps (Node 24 + corepack, yarn cache) + builds, ships the artifact, runs migrations via the ssh tunnel. Secrets: `DEPLOY_HOST`, `DEPLOY_DOMAIN`, `DEPLOY_SSH_KEY`, optional `DEPLOY_ENV`, `DEPLOY_ENV_LOCAL`.
- `L2-DEVOPS-09` — Drone deploy: `.drone.yml` pipeline `deploy`, trigger `push`|`promote` on branch `master` (push to master deploys automatically; promote re-deploys an older master build), thin wrapper → `deploy-for-pm2-build-locally.sh` (`L2-DEVOPS-20`): the runner (`node:24-bookworm-slim`, glibc to match the droplet) installs deps + builds, ships the artifact, runs migrations via the ssh tunnel. Secrets: `deploy_host`, `deploy_domain`, `deploy_ssh_key`, optional `deploy_env`, `deploy_env_local`.
- `L2-DEVOPS-25` — Drone CI checks: `.drone.yml` pipeline `ci`, trigger `push` + `pull_request`, `node:24-bookworm-slim` — `corepack yarn install --immutable` → `typecheck` → `lint`. No secrets, no droplet access. Runs beside `L2-DEVOPS-09` on master rather than gating it; `deploy` typechecks internally before building or shipping.
- `L2-DEVOPS-19` — `rollback-for-pm2.sh -h <host> -i <ssh-key> -d <domain> [-n app-name] [--app-port p]` — flips `current` to the previous slot + pm2 restart + health check. Code-only (migrations not reverted); refuses when the other slot is empty.
- `L2-DEVOPS-20` — `deploy-for-pm2-build-locally.sh` — same flags/contract as `L2-DEVOPS-02` (pm2 flavor), but build runs on the operator machine: local typecheck+build → tar artifact upload → extract into inactive slot → migrations from the operator machine via SSH tunnel (db loopback-only) → flip → pm2 → health. Aborts on non-portable native binaries in the artifact (fallback: `deploy-for-pm2.sh`).
- `L2-DEVOPS-27` — `deploy-for-pm2-build-docker.sh` — same flags, upload/migrate/flip/health path and blue-green semantics as `L2-DEVOPS-20`, plus `--platform <p>` (default `linux/amd64`) and `--build-only`; the build runs in a glibc Node 24 container (`devops/Dockerfile.build-artifact` + sidecar `.dockerignore`, exported with `docker buildx --output type=local`) so the artifact's traced native modules are the droplet's, not the operator OS's. Typecheck stays native (container build sets `NEXT_SKIP_TYPECHECK=1`). Aborts unless every native binary in the artifact is ELF for `--platform`'s arch AND glibc-linked (inverts `L2-DEVOPS-20`'s guard, which only tolerates the operator's own binaries). `--build-only` builds, verifies and prints the artifact and contacts no remote host. Correctness-first alternative to `L2-DEVOPS-20`, not a speed one — see `/docs/notes/devops.md` for measured numbers.

## Schemas
- `L2-DEVOPS-04` — Prod stack: app on the host via pm2; db per droplet choice — native Postgres 17 (loopback) or Docker (`devops/compose.prod.yml`, db-only, loopback `127.0.0.1:${POSTGRES_PORT:-5432}`; compose invoked `docker compose --project-directory . -f devops/compose.prod.yml` from the app dir).
- `L2-DEVOPS-05` — TLS + proxy → app loopback port, per flavor: pm2 — nginx, `devops/nginx/backflip.conf` template (`__DOMAIN__`/`__PORT__`) rendered at setup to `/etc/nginx/sites-available/<app-name>.conf`, certbot (Let's Encrypt) with auto-renew; docker — native Caddy auto-cert, `devops/Caddyfile` (`__DOMAIN__`) rendered by deploy → `/etc/caddy/Caddyfile` → reload.
- `L2-DEVOPS-06` — Droplet runtime env: `/var/www/<domain>/.env` (incl. `DATABASE_URL` → `127.0.0.1`) + `/var/www/<domain>/.env.local` (same split as local, see `L2-INF-07`). Templates `devops/env/production.env{,.local}.example`. Deploy never overwrites them unless `--env`/`--env-local` passed.
- `L2-DEVOPS-15` — Runtime: pm2 process `<app-name>` (`devops/pm2/ecosystem.config.cjs` → `start.sh`, env-driven `APP_NAME`/`APP_DIR`/`APP_PORT`) serves `/var/www/<domain>/current` (relative symlink → live blue/green slot) on `127.0.0.1:<app-port>`. Blue/green: two slots `blue/`/`green/`; deploy rebuilds only the inactive slot; flip after verification; the other slot is the rollback target. `shared/` (with per-slot `shared -> ../shared` symlink) is persistent instance data — deploys never modify it.
- `L2-DEVOPS-16` — App artifact: Next standalone build (`output: "standalone"`, tracing root = repo root); entry `apps/web/server.js`. Shared with the Docker image (`L2-INF-04`).

## Invariants
- `L2-DEVOPS-03` — Single deploy path: all logic in `devops/*.sh` (shared `devops/lib/common.sh`); CI configs are thin wrappers calling `deploy.sh` — never duplicate deploy logic in CI YAML.
- `L2-DEVOPS-07` — Migrations (`corepack yarn db:migrate`, host → loopback db) run after build, before the release switch.
- `L2-DEVOPS-10` — Only required operator inputs: droplet host + local SSH key path + instance domain. Everything else scripted or in env files.
- `L2-DEVOPS-11` — No secrets in git or CI logs; env files land only on the droplet (0600).
- `L2-DEVOPS-17` — Privilege model: app + pm2 run as locked `backflip` user (no password/ssh); `/var/www/<domain>` owned by it; root does only system work (packages, db, proxy, firewall). Deploy app-phase runs via `sudo -u backflip`.
- `L2-DEVOPS-18` — Multi-instance: instance identity = domain + app name + port (`-d` keys `/var/www/<domain>`; `-n`/`--app-port` default `backflip`/3070 name the pm2 app + nginx site + port); deploys affect only the named instance (pm2 `--only`, name-scoped health check). pm2-flavor feature; docker flavor's Caddy config is single-site.
- `L2-DEVOPS-21` — App sets baseline security response headers on every route via `next.config.ts` `headers()`: `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` (camera/mic/geo/topics off), CSP `frame-ancestors 'none'; base-uri 'self'; object-src 'none'`, and prod-only HSTS (`max-age=63072000; includeSubDomains`, gated on `NODE_ENV==="production"`). A nonce-based `script-src`/`style-src` CSP is a follow-up. The proxy layer (`L2-DEVOPS-05`) may add its own headers on top.
- `L2-DEVOPS-22` — nginx (pm2 flavor) rate-limits the credentials login endpoint at the edge: `limit_req_zone` (10r/m per client IP, `backflip_auth`) defined in the host-wide `conf.d/backflip-http.conf`, applied via `limit_req` on `location = /api/auth/callback/credentials` (→ 429). Scoped to the login callback only (not `/api/auth/session`). Defense-in-depth over the app throttle `L2-AUTH-40`. Zone is shared across instances; `server_tokens off` in the site template. (`devops/nginx/backflip-http.conf`, `devops/nginx/backflip.conf`)
- `L2-DEVOPS-23` — nginx access log scrubs one-time tokens: a `map` + `log_format backflip_scrubbed` (in `conf.d/backflip-http.conf`) redacts the query string of any request URI containing `token=`, so reset/verify links don't land in `access.log`. The site template sets `access_log … backflip_scrubbed`.
- `L2-DEVOPS-24` — Deploy workflow least-privilege: `.github/workflows/deploy.yml` declares `permissions: contents: read` (it only checks out, never calls the API), and every deploy secret is passed via a step `env:` and referenced as `"$VAR"` — never interpolated as `${{ secrets.* }}` into `run:` script text — so a secret with shell metacharacters can't inject commands.

- `L2-DEVOPS-26` — nginx (pm2 flavor) rate-limits the OAuth connector endpoints at the edge: one shared `limit_req_zone` (`backflip_oauth`, 60r/m per client IP, `conf.d/backflip-http.conf`, same zone-definition pattern as the login limiter `L2-DEVOPS-22`) applied to both `POST /api/oauth/token` and `POST /api/oauth/register` in the site template — defense-in-depth over the in-process limiter (`L2-MCP-30`). `/api/mcp` is deliberately NOT edge-rate-limited (it's per-token limited in-app, `L2-MCP-30`) and is proxied with buffering off for Streamable HTTP. The access-log scrub `map` (`L2-DEVOPS-23`) is extended to also redact `code=` in query strings alongside `token=`, so authorization-code redirects don't land raw in `access.log`. Caddy (docker flavor) has no equivalent rate-limit zone — the in-process limiter (`L2-MCP-30`) is the only rate limit there; Caddy does disable response buffering on `/api/mcp*` for the same streaming reason.

## Errors
- `L2-DEVOPS-12` — Deploy with no `.env`/`.env.local` on droplet → dies with hint to templates + `--env` flags.

## Acceptance
- `L2-DEVOPS-13` — Fresh droplet + DNS A record: setup flavor script (+ db script) then deploy `--env … --env-local …` → app served at `https://$DOMAIN`, migrations applied, release in slot `blue`.
- `L2-DEVOPS-14` — Re-running a deploy with no changes is safe (idempotent, no env overwrite); any failure before the `current` flip leaves the live slot serving.

## Constrained L3
- `/docs/notes/devops.md`

---
IDs: `L2-DEVOPS-<NN>`. Permanent, never renumber.
Change: propose diff + affected-L3 → stop → await human.
