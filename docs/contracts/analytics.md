# Contract (L2) — analytics

> L2 = contract / what. AI proposes, human approves. Cite ≥1 L1.
> Style: terse. One fact per line.

> **Implements L1:** `L1-ARCH-01` (public surface only), `L1-STACK-07` (Postgres config), `L1-STACK-09` (Drizzle schema + migrations)
> **Depends on L2:** `db` (`analytics_config`), `auth` (admin gate), `ui` (Button/Switch/Textarea/Field)

## Owns
Google Analytics (gtag.js) on the **public** surface, its operator config under `/backflip/settings` (backed by `analytics_config`), and the cookie-consent gate that decides whether analytics may run at all.

Explicitly **not** owned: any analytics inside `/backflip/*` (admin is never measured), server-side event tracking, non-Google providers.

## Interfaces
- `L2-ANALYTICS-02` — Server action `saveAnalyticsConfig(prev, formData)` — upserts the single `analytics_config` row on `kind`. `settings`-gated. Normalizes the measurement id to upper case; blank clears it. (`apps/web/app/backflip/(protected)/settings/_actions.ts`)
- `L2-ANALYTICS-03` — Route `GET /api/public/analytics-config` — unauthenticated; returns exactly `{ measurementId: string|null, cookieBannerEnabled: boolean, cookieBannerText: string }` and nothing else from the row. `Cache-Control: public, max-age=60, s-maxage=300, stale-while-revalidate=600`. `runtime = "nodejs"`, `dynamic = "force-dynamic"`. Never 5xx: on DB error it answers analytics-off. (`apps/web/app/api/public/analytics-config/route.ts`)
- `L2-ANALYTICS-04` — Client components `AnalyticsGate` (decides + injects gtag.js) and `CookieBanner` (presentational bottom bar, Accept/Decline). Gate is mounted from `SiteFooter`, the only chrome shared by every public page and no admin page. (`apps/web/app/_components/analytics-gate.tsx`, `cookie-banner.tsx`)
- `L2-ANALYTICS-05` — Route `/backflip/settings` → Google Analytics integration — third master-detail entry; fields: Measurement ID (plain text), Cookie banner `Switch`, banner text `Textarea`. List row reads "connected" iff a measurement id is saved. (`settings/_components/analytics-integration.tsx`, `integrations-view.tsx`, `integrations-rail.tsx`, `page.tsx`)

## Schemas
- `L2-ANALYTICS-01` — `analytics_config` table (single row per `kind`, `kind` unique default `google_analytics`): `id`, `kind`, `measurementId` (nullable text, plaintext), `cookieBannerEnabled` (bool, default `true`), `cookieBannerText` (nullable text), `updatedAt`. Migration `0005` creates it; `0006` seeds the singleton row with the default banner copy, `ON CONFLICT (kind) DO NOTHING` (re-runnable). `db` counterpart: `L2-DB-23`. (`packages/db/src/schema.ts`)
- `L2-ANALYTICS-09` — Consent is stored client-side only: `localStorage["backflip.consent.analytics"]` ∈ `{"granted","denied"}`. Absent = undecided. No consent record is ever written to the database.

## Invariants
- `L2-ANALYTICS-06` — **Consent gate.** With `cookieBannerEnabled`, gtag.js is not injected and no GA request is made until the visitor clicks Accept. Decline loads nothing at all. Banner disabled + id set → GA loads unconditionally. This is the load-bearing invariant of the domain.
- `L2-ANALYTICS-07` — No `measurementId` → nothing renders and nothing loads, **including the banner**. The banner exists only to gate analytics; with nothing to gate there is no banner.
- `L2-ANALYTICS-08` — Banner copy is operator-editable and ships with a migration-seeded default, so a fresh database renders a lawful banner with no admin action. Toggling the banner off must never destroy the saved copy (the field is `readOnly`, never `disabled`, so it keeps round-tripping through the form).
- `L2-ANALYTICS-10` — Public surface only. GA never loads under `/backflip/*` (`L1-ARCH-01`). Enforced structurally by the mount point, not by a runtime path check.
- `L2-ANALYTICS-11` — Public pages stay statically prerendered (`○`). Config therefore reaches the client by fetching `L2-ANALYTICS-03`, never by a server-side DB read in public page or root-layout render.
- `L2-ANALYTICS-12` — `measurementId` is a public identifier, not a secret: stored unencrypted, unmasked in the admin UI, served to every visitor. It is nevertheless validated against `/^(G|GT|AW|UA)-[A-Z0-9]+(-[A-Z0-9]+)?$/` before storage, because it is interpolated into a `<script src>`.
- `L2-ANALYTICS-13` — Once answered, the banner never shows again (persisted choice). Blocked/unavailable `localStorage` degrades to per-page-view consent, never to silent tracking.

## Errors
- `L2-ANALYTICS-14` — Unauthenticated / non-`settings` `saveAnalyticsConfig` → `{ ok: false, message: "Unauthorized" }`, no write.
- `L2-ANALYTICS-15` — Malformed measurement id → `{ ok: false, message: "Measurement ID looks wrong — expected a tag like G-XXXXXXXXXX." }`, no write.
- `L2-ANALYTICS-16` — Config endpoint DB failure → `200` with analytics-off payload + `no-store`. A broken database must not break public chrome.

## Acceptance
- `L2-ANALYTICS-17` — Fresh DB after `db:migrate`: row exists, banner enabled, default copy present in the admin UI, no measurement id → public site shows no banner and loads no GA.
- `L2-ANALYTICS-18` — Save `G-XXXXXXXXXX` with banner on → public page shows the banner; DevTools shows **no** `googletagmanager.com` request until Accept; after Accept the tag loads and the banner is gone on reload; after Decline no request is ever made and the banner stays gone.
- `L2-ANALYTICS-19` — Banner off + id set → gtag.js loads on first paint, no banner.
- `L2-ANALYTICS-20` — `next build` keeps `/`, `/getting-started`, `/getting-started/setup-on-digitalocean-droplet*` marked `○`.

## Constrained L3
- `/docs/notes/analytics.md`

---
IDs: `L2-ANALYTICS-<NN>`. Permanent, never renumber.
Change: propose diff + affected-L3 → stop → await human.
