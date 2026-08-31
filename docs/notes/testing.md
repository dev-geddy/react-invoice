# Notes (L3) — testing

> L3 = how / volatile. AI-maintained, no approval. Cites L2 by ID.

## File map
- `apps/web/vitest.config.ts` — unit runner config (`L2-TEST-01`). Node env; `@` alias mirrors tsconfig `@/*`.
- `apps/web/playwright.config.ts` — e2e config (`L2-TEST-02`, `L2-TEST-05`). Chromium only, `workers: 1`.
- `apps/web/e2e/env.ts` — test DB names/URLs, port 3170, fixture accounts.
- `apps/web/e2e/global-setup.ts` — DB create/migrate/truncate/seed (`L2-TEST-03/04`).
- `apps/web/e2e/auth.spec.ts` — 5 happy paths: unauth redirect, owner login, wrong password, teammate blocked from settings, sign-out.
- `apps/web/e2e/admin-chrome.spec.ts` — 1 case: contracted sidebar rail is icon-only (labels hidden, brand tile + footer avatar geometrically inside the 3.5rem rail). Geometry, not snapshot — the failure mode is an icon clipped to negative `x`, which a visibility assertion alone misses.
- `apps/web/e2e/screenshots.spec.ts` — screenshot step (`L2-TEST-09`): public homepage + admin home/integrations/users/account/docs (owner login) → `.screenshots/*.png`, all 1200×720. The docs case shoots twice: landing (index summary) and a cascade state (`L1-ARCH-05` → `L2-UI-01`), which doubles as the smoke test that the explorer's filtering wires up (`L2-UI-20`). Own Playwright project; default `test:e2e` runs `--project=chromium` which ignores it.
  - The committed docs asset `docs/assets/admin-integrations.png` is **1200×600**, not the project's 1200×720 — it predates this spec. Refreshing it: capture with a throwaway spec that calls `page.setViewportSize({ width: 1200, height: 600 })`, hide the Next dev indicator (`nextjs-portal{display:none}` — it is a local artifact and the previous asset had it baked in), then re-encode with sharp `png({ palette: true })`; flat UI quantises losslessly to the eye and the file drops ~60%.
- `apps/web/e2e/tsconfig.json` — Playwright TS loader can't resolve `extends` from `@workspace/typescript-config`; passed via `--tsconfig` in the `test:e2e` script.
- Unit suites colocated in `app/_lib/auth/*.test.ts` — detail in `/docs/notes/auth.md` § Unit tests.

## Run
- Unit: `corepack yarn workspace web test` (fast, no DB).
- E2e: `docker compose up -d` first, then `corepack yarn workspace web test:e2e`.
- Screenshots: `corepack yarn workspace web test:e2e:screenshots` (same DB/server prereqs).

## Gotchas
- `webServer` calls the `next` binary directly — the dotenv-cli `dev` script would load root `.env` and dotenv never overrides preset vars, but bypassing it entirely keeps dev credentials out (`L2-TEST-02`).
- `NEXT_DIST_DIR=.next-e2e`: honored by two lines in `next.config.ts`; without it the e2e server corrupts a running 3070 dev server's `.next`. `.next-e2e` ignored in git/eslint/prettier.
- Login page shadcn `CardTitle` renders a `div`, not a heading — assert on the "Sign in" button instead.
- Never read `ConnectorCopyField` values positionally (`page.locator("code").nth(n)`). The manual-client reveal dialog grew a "Remote MCP server URL" row above the credentials, which silently shifted every index — `createManualClientViaUI` then handed back the MCP URL as the client id and 3 connector tests failed at `/api/oauth/authorize` with an unknown client. `revealedValue(page, label)` anchors on the field's own `aria-label="Copy {label}"` button instead (`L2-MCP-50`, `L2-MCP-52`).
- Setup truncates + reseeds, never drops `backflip_test` — a reused dev server keeps live pool connections (`reuseExistingServer: !CI`).
- `postgres` superuser rights: compose `backflip` user owns the cluster, so `create database` from globalSetup just works.
