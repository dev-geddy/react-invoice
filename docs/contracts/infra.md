# Contract (L2) — infra

> L2 = contract / what. AI proposes, human approves. Cite ≥1 L1.
> Style: terse. One fact per line.

> **Implements L1:** `L1-ARCH-06`, `L1-STACK-07`, `L1-STACK-08`
> **Depends on L2:** none

## Owns
Local dev infrastructure: Docker Compose services (web, postgres, one-shot migrate/seed), profiles, ports, env/credentials.

## Interfaces
- `L2-INF-01` — `docker compose --profile web up -d --build` → `backflip-db` + one-shot `backflip-db-migrate` (drizzle migrations, must complete first) + `backflip-web` on host **3071** → container 3070. (`docker-compose.yml`)
- `L2-INF-02` — `docker compose up -d` (no profile) → `backflip-db` only — the default; preferred dev: db in Docker, app run natively.
- `L2-INF-14` — `docker compose --profile seed run --rm db-seed` → one-shot `backflip-db-seed` (`init-owner`); creds from `.env.init` (env_file, optional) or `-e ADMIN_EMAIL -e ADMIN_PASSWORD`. Runs after migrate.
- `L2-INF-03` — App local dev port **3070** (`corepack yarn dev`); local prod `corepack yarn workspace web start` also 3070.
- `L2-INF-04` — App Docker image — Next standalone build (`output: "standalone"`), runner ships only the bundle, `node apps/web/server.js` on container 3070. Stage `deps` (workspace + node_modules, no build) is the migrate/seed tool image. (`apps/web/Dockerfile`, context = repo root)

## Schemas
- `L2-INF-05` — Postgres service: image `postgres:17-alpine`, container `backflip-db`, host port bound to loopback `127.0.0.1:${POSTGRES_PORT:-5544}` → 5432, volume `backflip_pgdata`, healthcheck `pg_isready`. Loopback bind keeps the dev db (default password) off the network even if this file runs on a non-local host.
- `L2-INF-15` — Fixed container names: `backflip-db`, `backflip-web`, `backflip-db-migrate`, `backflip-db-seed`.
- `L2-INF-06` — `DATABASE_URL` — app→db connection. Local app: `localhost:${POSTGRES_PORT}`. In-container app: `db:5432` (compose env overrides `.env`).
- `L2-INF-07` — Env vars: `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `POSTGRES_PORT`, `DATABASE_URL`. Defined in `.env` (copy of `.env.example`).

- `L2-INF-17` — `MCP_ENABLED` app env var (root `.env`/`.env.local`, same load path as `L2-INF-07`): a **forced-off override only**, not the enabler. Unset (the default) → the database flag `connector_config.enabled` decides, toggled by an owner in the admin UI; `"false"` → the connector is hard off whatever the database says, for incident response when the admin UI can't be trusted. While off, every connector route (`/api/mcp`, `/api/oauth/*`, both well-known documents, `/backflip/connect`) 404s in both local dev and docker profiles. Owned by the `mcp` domain (`L2-MCP-25`, `L2-MCP-37`).

## Invariants
- `L2-INF-08` — Postgres host port kept off default 5432 to avoid clashing with other local pg. Configurable via `POSTGRES_PORT`.
- `L2-INF-09` — No secrets committed. `.env` gitignored; only `.env.example` tracked (`!.env.example` in `.gitignore`).
- `L2-INF-10` — One credential source: `.env` seeds the db container AND is read by the local app. No divergent copies.
- `L2-INF-16` — The app image's `runner` stage runs as the non-root built-in `node` user (`USER node`) — the standalone server writes nothing at runtime, so it runs read-only, limiting the blast radius of an app/dependency RCE. (`apps/web/Dockerfile`)

## Errors
- `L2-INF-11` — Host port in use (e.g. 5544 or 3071 taken) → compose bind error. Change `POSTGRES_PORT` in `.env` / free the port.

## Acceptance
- `L2-INF-12` — `docker compose up -d db` + `corepack yarn dev` → app on 3070 reaches db on `localhost:${POSTGRES_PORT}`.
- `L2-INF-13` — `docker compose --profile web up -d --build` → migrations applied, app on 3071 (`AUTH_URL` overridden to `http://localhost:3071`), db healthy, app reaches db at `db:5432`. Native 3070 dev keeps working against the same db.

## Constrained L3
- `/docs/notes/infra.md`

---
IDs: `L2-INF-<NN>`. Permanent, never renumber.
Change: propose diff + affected-L3 → stop → await human.
