# Contract (L2) — testing

> L2 = contract / what. AI proposes, human approves. Cite ≥1 L1.
> Style: terse. One fact per line.

> **Implements L1:** `L1-ARCH-06`, `L1-STACK-02`, `L1-CON-01`, `L1-CON-02`
> **Depends on L2:** `auth` (invariants under test), `infra` (docker postgres), `db` (migrations, user schema)

## Owns
Automated tests for the web app: unit tooling (Vitest), e2e tooling (Playwright), test-database isolation, essential auth suites.

## Interfaces
- `L2-TEST-01` — `corepack yarn workspace web test` → Vitest, node env, colocated `**/*.test.{ts,tsx}` (excludes `e2e/**`). Config `apps/web/vitest.config.ts` (`@` alias = app root). Turbo task `test`.
- `L2-TEST-02` — `corepack yarn workspace web test:e2e` → Playwright chromium, specs in `apps/web/e2e/`. `webServer` invokes `next dev -p 3170` directly (bypasses dotenv-cli) with explicit env: test `DATABASE_URL`, fixed `AUTH_SECRET`, `NEXT_DIST_DIR=.next-e2e`, no `AUTH_GOOGLE_*` (credentials-only). Config `apps/web/playwright.config.ts`.
- `L2-TEST-03` — e2e `globalSetup` (`apps/web/e2e/global-setup.ts`): create `backflip_test` on `localhost:${POSTGRES_PORT:-5544}` if missing, run drizzle migrations, truncate auth tables, reseed fixtures `owner@e2e.test` (owner) + `teammate@e2e.test` (teammate) with bcrypt hashes. Never drops the DB (live pools under `reuseExistingServer`).

- `L2-TEST-09` — `corepack yarn workspace web test:e2e:screenshots` → separate Playwright project ("screenshots", viewport 1200×720), never part of the default e2e run. Captures public homepage, admin home, integrations, members, account into gitignored `.screenshots/` at repo root — the single source for page screenshots; one resolution for all. Spec `apps/web/e2e/screenshots.spec.ts`.

## Invariants
- `L2-TEST-04` — e2e never reads or mutates the dev `backflip` database; suite runs only against `backflip_test`.
- `L2-TEST-05` — e2e dev server never shares `.next` with the 3070 dev server: builds into `.next-e2e` via `NEXT_DIST_DIR` (honored in `next.config.ts`).
- `L2-TEST-06` — Scope = essential paths, not coverage. Unit suites freeze auth invariants unreachable e2e — Google `signIn` gate, `tokenVersion` revocation, credentials `authorize`, auth-mode flags, token helpers, capability matrix (`L2-AUTH-05/09/10/11/14/21/29/31/33/34/36/37`). E2e covers `L2-AUTH-13/16/17/24` + sign-out. Tests exercise real exported modules — no logic copies in tests.

## Errors
- `L2-TEST-07` — `backflip-db` container down → e2e globalSetup fails at connect. Fix: `docker compose up -d`.

## Acceptance
- `L2-TEST-08` — With `backflip-db` up: unit suite green, e2e suite green, dev `backflip` database row set unchanged after the run.

## Constrained L3
- `/docs/notes/testing.md`

---
IDs: `L2-TEST-<NN>`. Permanent, never renumber.
Change: propose diff + affected-L3 → stop → await human.
