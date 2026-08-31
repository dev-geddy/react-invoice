# Notes (L3) — db

> L3 = how / volatile. AI writes free. Cites L2 IDs up. Matches code as-is.

## File map
- `packages/db/package.json` — `@workspace/db`. Deps: drizzle-orm, pg, bcryptjs. Dev: drizzle-kit, tsx, dotenv, @types/pg. Scripts satisfy `L2-DB-03`.
- `packages/db/src/schema.ts` — Drizzle schema. `user_role` enum (`owner|admin|teammate`) + `user` (incl. `tokenVersion`)/`account`/`session`/`verificationToken`; `ai_provider` enum + `ai_config`; `email_config`; `user_token_type` enum (`password_reset|email_change`) + `user_token`. Satisfies `L2-DB-05`, `L2-DB-06`, `L2-DB-07`, `L2-DB-17`, `L2-DB-18`, `L2-DB-20`, `L2-DB-22`.
- `packages/db/src/client.ts` — `db = drizzle(process.env.DATABASE_URL!, { schema })` (node-postgres). Satisfies `L2-DB-01`.
- `packages/db/src/index.ts` — barrel: `export * from schema` + `db`. Satisfies `L2-DB-02`, `L2-DB-09`.
- `packages/db/src/load-env.ts` — loads root `.env` + `.env.local` (root = 3 up from src). Imported by drizzle.config. NOTE: the owner seed loads its own env inline (`.env` + `.env.init`), not `.env.local`.
- `packages/db/src/seed/owner.ts` — `init-owner`. Self-contained: loads `.env` + `.env.init` via `dotenv` at the top (root = 4 up from src/seed), deliberately out of `.env.local` so `ADMIN_*` never reaches the running app. `db`/`users` are dynamically `import()`ed inside `main()` so `config()` runs before the db client reads `DATABASE_URL` at eval time. Reads `ADMIN_EMAIL` (required) + `ADMIN_PASSWORD` (optional). With a password → bcrypt(12) hash; without → `passwordHash` null (Google-only owner). Upsert on email, role `owner`; on re-run without a password, the existing hash is preserved (not overwritten). Satisfies `L2-DB-04`.
- `packages/db/drizzle.config.ts` — dialect postgresql, schema `src/schema.ts`, out `migrations/`. Imports `load-env`.
- `packages/db/src/crypto.ts` — `encryptSecret`/`decryptSecret` (AES-256-GCM, key = sha256(`ENCRYPTION_KEY`)) + `generateToken()` (32-byte base64url) / `hashToken(raw)` (sha256 hex) for one-time link tokens. Satisfies `L2-DB-16`, `L2-DB-19`.
- `packages/db/src/index.ts` — also re-exports `generateToken`/`hashToken` alongside encrypt/decrypt.
- `packages/db/src/schema.ts` (cont.) — connector/OAuth tables: `oauth_client` (incl. `origin`, `createdByUserId`, `allowLoopbackPorts`), `oauth_auth_code`, `oauth_token`, plus `connector_dcr_mode` enum + `connector_config` (`@spec L2-DB-28, L2-MCP-48`). Satisfies `L2-DB-25`, `L2-DB-26`, `L2-DB-27`, `L2-DB-28`.
- `packages/db/migrations/` — `0000` baseline, `0001` email_config, `0002` role rename `member`→`teammate`, `0003` `user_token` table, `0004` `user.tokenVersion` column, `0005`+`0006` analytics_config, `0007` speech_config, `0008` reworded cookie-banner copy, `0009` oauth client/code/token tables + `oauth_token_type` enum, `0010` `connector_config` + `oauth_client` manual-client columns, `0011` `connector_config.enabled`, + `meta/`. Satisfies `L2-DB-08`.

## Role rename (migration 0002)
- `user_role` value `member` → `teammate`. drizzle-kit generated a drop/recreate (`SET DATA TYPE text` → `DROP TYPE` → recreate → recast); hand-replaced with `ALTER TYPE ... RENAME VALUE 'member' TO 'teammate'` + `ALTER COLUMN role SET DEFAULT 'teammate'`. Rename preserves rows + the default binding and reaches the same end state as the `0002` snapshot (drop/recreate would reject any existing `member` row on the recast). Not yet applied here (no DB in the web session); apply with `db:migrate` when a DB is up.

## Gotcha — type-change migrations
- `drizzle-kit generate` emits column type changes as bare `SET DATA TYPE` with no `USING` cast. For incompatible casts (e.g. text→integer) Postgres rejects the SQL, and `drizzle-kit migrate` fails *quietly* (prints "applying…", no success line, journal not advanced — looks like a no-op). Fix: hand-edit the generated SQL to add `USING <col>::<type>`, or `db:push` in dev. (This is what broke the old `0001`; the baseline was squashed to avoid it.)

## Notes / deviations
- tsconfig overrides base to `module ESNext` + `moduleResolution Bundler` (pkg is consumed by Next bundler + run by tsx; avoids NodeNext `.js` extension churn).
- Column names kept Auth.js-exact (camelCase, quoted in pg): `passwordHash`, `emailVerified`, `providerAccountId`, etc. Query with double-quotes in raw SQL.
- `account.expires_at` typed `integer` (required by `@auth/drizzle-adapter` types).
- `session`/`verificationToken` tables unused under JWT strategy; kept for adapter completeness.
- Env: `DATABASE_URL` (localhost:5544) in `.env`; one-off admin seed creds in `.env.init` (loaded inline by the seed script, never the app). `.env.init.example` is the committed template. All `.env*` gitignored except the `*.example` files.

## user_token table (migration 0003)
- Purpose-scoped one-time tokens for self-service flows: `password_reset`, `email_change` (holds pending `newEmail`). Store only `tokenHash` (sha256 of the raw token); raw lives only in the emailed link. `expiresAt` + `consumedAt` enforce single-use, time-boxed validity. Cascade-deletes with the user. Consumed by `apps/web/app/_lib/auth/tokens.ts`.
- **Not yet applied here** (no DB in the web session) — apply `0003_unique_bill_hollister.sql` + `0004_low_hulk.sql` with `db:migrate` when a DB is up (also `0002` per above).

## State
- Owner seeded: `gigedas@gmail.com`, role `owner`. Migrations applied to docker db (through `0001`; `0002`/`0003` pending in this session — no DB).
- No app code consumes `@workspace/db` yet — auth wiring is the next phase.

## TODO
- Auth.js DrizzleAdapter + Credentials/Google (auth domain) consumes these tables next.
