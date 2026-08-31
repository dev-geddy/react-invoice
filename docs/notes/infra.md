# Notes (L3) — infra

> L3 = how / volatile. AI writes free. Cites L2 IDs up. Matches code as-is.

## File map
- `docker-compose.yml` — services `db` (`react-invoice-db`, no profile → default), `db-migrate` (`react-invoice-db-migrate`, profiles web+seed, one-shot `corepack yarn db:migrate` off Dockerfile `deps` stage), `web` (`react-invoice-web`, profile web, waits for db healthy + migrate completed, `AUTH_URL=http://localhost:3081` override), `db-seed` (`react-invoice-db-seed`, profile seed, one-shot `corepack yarn init-owner`, `.env.init` via optional env_file — never `environment:`, which would override the file with empties). Shared `x-db-url` anchor for the in-network `DATABASE_URL`. Satisfies `L2-INF-01`, `L2-INF-02`, `L2-INF-05`, `L2-INF-14`, `L2-INF-15`. `name: react-invoice`. Volume `react_invoice_pgdata`.
- `apps/web/Dockerfile` — 4-stage (base → deps → build → runner; `deps` = workspace + node_modules for migrate/seed tools), context = repo root. Build stage: `corepack enable`, `yarn install --immutable`, `yarn workspace web build`. Runner ships only the Next standalone bundle, runs `node apps/web/server.js` as the non-root `node` user (`USER node`, read-only at runtime). Satisfies `L2-INF-04`, `L2-INF-16`.
- `.dockerignore` — excludes node_modules, `.next`, `.turbo`, `.git`, `.env*` (keeps `.env.example`).
- `.env.example` — committed template. `.env` — gitignored, local creds. Satisfies `L2-INF-07`, `L2-INF-09`.
- `apps/web/package.json` — `dev` = `next dev -p 3080`, `start` = `next start -p 3080`. Satisfies `L2-INF-03`.
- `.gitignore` — `.env*` then `!.env.example`. Satisfies `L2-INF-09`.
- `README.md` — run instructions (local-app+docker-db; full-docker).

## State
- Preferred dev: app local (3080) + db in Docker — plain `docker compose up -d` starts ONLY `react-invoice-db` (web/seed are behind profiles). Full-docker (app 3081): `docker compose --profile web up -d --build`; both can run at once against the same db.
- A pre-existing stopped `react-invoice-db` container (postgres:16, volume `cv_react-invoice-db-data`, from an older setup) held the fixed name and was removed 2026-07-30; its volume was left untouched.
- App Docker = prod build, no hot reload (local is the dev driver).
- `DATABASE_URL` consumed by `@workspace/db` (app + seed).
- `next start` no longer used in prod paths — prod runs the standalone server (`node apps/web/server.js`), on the droplet via pm2. `corepack yarn workspace web start` still serves (verified) but warns about `output: "standalone"`; kept for quick local checks.

## Env loading (monorepo)
- Three root env files, by lifecycle: `.env` (db/infra, runtime), `.env.local` (Auth.js runtime secrets), `.env.init` (one-off owner seed — `ADMIN_*`). Next runs in `apps/web` so it won't read root env by itself.
- Local dev: `web` `dev` script uses `dotenv-cli` (`dotenv -e ../../.env -e ../../.env.local -- next dev`) to inject root env (needed by edge proxy + node routes). `.env.init` is intentionally NOT loaded here — admin creds stay out of the app env.
- Docker app: compose `env_file: [.env, .env.local]` injects env; `DATABASE_URL` overridden to `db:5432` via `environment:`. `.env.init` intentionally excluded (seed-only).
- `.env.init` is read only by `corepack yarn init-owner` (loaded inline in `packages/db/src/seed/owner.ts`). Committed template: `.env.init.example`.
- Postgres 5545 verified clear (existing pg containers on 5436/5437).

## Ports
- App: local 3080 / docker host 3081 → container 3080.
- Postgres: host `127.0.0.1:${POSTGRES_PORT:-5545}` → container 5432 (loopback-bound, `L2-INF-05`). Default 5545 chosen off 5432 (docker daemon was down at setup — couldn't scan existing images; verify no clash, adjust `POSTGRES_PORT` if needed). Satisfies `L2-INF-08`.

## TODO
- Optional: dev-mode app container with source mount if containerized hot reload is ever wanted.
