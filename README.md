# React Invoice

**v3.0.0** — invoicing behind a login. A shared ledger every signed-in user can
read, each invoice recording who raised it, with a live preview that *is* the
printed document.

v1–v2 were a Create React App single-pager that kept invoices in `localStorage`.
v3 is the same job rebuilt on a full-stack platform foundation: Postgres, real
accounts and roles, an admin shell, and a shared UI system.

Stack: Next.js 16 · React 19 · Tailwind v4 · shadcn/ui · Drizzle + Postgres · Auth.js · Turborepo · yarn 4.

## Invoicing
- **Shared ledger** — `/backflip/invoicing/invoices`. Every user sees every invoice; the creator (or an owner/admin) may edit, lock or delete it.
- **Editor + live preview** — provider and customer as cards opening a four-column detail dialog, line items whose qty/rate/total recompute each other, series-aware numbering, VAT.
- **Print** — the preview *is* the document: print (or save to PDF) prints the invoice alone, named after it.
- **Customers** — `/backflip/invoicing/customers`. An address book that feeds the invoice form's prefill; companies invoiced but not saved are offered for one-click adoption.
- **Series & currency** — `/backflip/invoicing/settings`. Each series owns its numbering prefix, default currency and branding, with a platform brand as fallback. Invoices snapshot all three, so editing a series never rewrites an issued invoice.

Contract: [`docs/contracts/invoice.md`](./docs/contracts/invoice.md) · notes: [`docs/notes/invoice.md`](./docs/notes/invoice.md).
The v2 CRA/MUI/localStorage app is kept for reference in `.legacy-ref-project/` — reference only, not built or deployed.

![React Invoice admin console — Integrations, with AI providers and email configured per workspace](./docs/assets/admin-integrations.png)

> **Self-hosted.** You run this yourself and supply your own secrets. The values in `.env.example` are local-dev defaults only — generate real secrets before deploying anywhere (see [Security](#security)).

## How it works
Set up once — clone, [provision a droplet](./devops.md), first deploy — then every feature runs the same loop: describe it, let Claude Code build to spec, review the PR, deploy.

![From one-time setup (clone → provision droplet → first deploy) to the per-feature loop: you describe, Claude Code builds to spec, pull request review and merge, deploy live in prod](./docs/assets/setup-to-ship.png)

## Prerequisites
- **Docker Desktop** (running) — for Postgres
- **Node ≥ 20** with **corepack** (pins `yarn@4.17.1` — always run `corepack yarn …`)

## Run it locally

**1. Create env files (first time only).** Copy the templates:
```bash
cp .env.example .env
cp .env.init.example .env.init      # one-off owner seed — see step 2
```
Create **`.env.local`** (runtime Auth.js secrets) with:
```
AUTH_SECRET=replace-with-openssl-rand-base64-33
AUTH_TRUST_HOST=true
```
Generate a real secret with `openssl rand -base64 33`. Edit **`.env.init`** with your
`ADMIN_EMAIL` / `ADMIN_PASSWORD` — it's read only by `init-owner`, never by the app,
and can be deleted once the owner is seeded.

**2. Install, set up the database, run:**
```bash
corepack yarn install
docker compose up -d         # start Postgres (react-invoice-db) only
corepack yarn db:migrate     # create tables
corepack yarn init-owner     # seed admin from .env.init
corepack yarn dev            # app → http://localhost:3080
```

## Log in
- Sign in at **http://localhost:3080/backflip/login** with your `ADMIN_EMAIL` / `ADMIN_PASSWORD`.
- **After editing env:**
  - changed `ADMIN_*` in `.env.init` → rerun `corepack yarn init-owner`
  - changed `AUTH_*` (incl. Google) in `.env.local` → **restart `yarn dev`** (env loads at startup)
- Google login is optional — add `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` (redirect URI `http://localhost:3080/api/auth/callback/google`); works only for already-registered emails.

## Tests
```bash
corepack yarn workspace web test        # unit (Vitest) — fast, no database needed
corepack yarn workspace web test:e2e    # e2e (Playwright) — needs `docker compose up -d`
```
E2e boots its own app on port `3180` against a dedicated `react_invoice_test` database —
your dev server and dev data are untouched. First run on a machine also needs the
browser once: `corepack yarn workspace web exec playwright install chromium`.
Optional: `corepack yarn workspace web test:e2e:screenshots` captures key pages
into `.screenshots/` (gitignored).

## Production: seed the owner once, then delete the secret
The owner seed is a **one-off kickoff step**. Run it a single time against the prod
database, then delete the credentials file:

```bash
cp .env.init.example .env.init   # then edit: real ADMIN_EMAIL + a strong ADMIN_PASSWORD
corepack yarn init-owner         # creates the owner row — idempotent, safe to re-run
rm .env.init                     # remove the secret once you can sign in
```

Deleting `.env.init` is all that's needed — the `ADMIN_PASSWORD` lives only there.
The seed script isn't imported by the app, isn't in the build, and does nothing
without `.env.init` (it throws on a missing `ADMIN_EMAIL`), so it's harmless to leave
in place. Re-seed anytime by recreating `.env.init` and rerunning `init-owner`.

> Optional cleanup: to drop the tooling entirely, `git rm .env.init.example
> packages/db/src/seed/owner.ts`, remove the `init-owner` entry from `package.json`
> + `packages/db/package.json`, and prune the `L2-DB-04/13/15` doc lines. Pure
> hygiene — restore from git history to seed another owner later.

## Good to know
- **Ports**: app `3080`, Postgres `5545` (change `POSTGRES_PORT` in `.env` if it clashes).
- **Secrets**: set a real `ENCRYPTION_KEY` in `.env` (`openssl rand -base64 32`) — it encrypts stored secrets (AI provider keys).
- **DB changes**: edit `packages/db/src/schema.ts` → `corepack yarn db:generate` → `db:migrate`.
- **Admin dashboard UI** is built from shadcn blocks — browse and lift components/layouts from **https://ui.shadcn.com/blocks** (this project uses `login-03`, `dashboard-01`, `sidebar-08`).
- **Full Docker** (app + db): `docker compose --profile web up -d --build` → migrations run, app on `3081`. Owner seed: `docker compose --profile seed run --rm db-seed`.
- More commands + conventions: `.claude/skills/dev-workflow`.

## Deployment
Deploy to a DigitalOcean droplet — from your machine, GitHub Actions, or Drone CI.
See [devops.md](./devops.md).

## Security
Before deploying, generate real secrets — never reuse the `.env.example` defaults:
- `AUTH_SECRET` → `openssl rand -base64 33`
- `ENCRYPTION_KEY` → `openssl rand -base64 32`
- a strong `ADMIN_PASSWORD` and unique database credentials.

To report a vulnerability, see [`SECURITY.md`](./SECURITY.md).

## License
[MIT](./LICENSE) © dev-geddy
