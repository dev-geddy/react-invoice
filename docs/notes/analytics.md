# Notes (L3) — analytics

> L3 = how / volatile. AI writes free. Cites L2 IDs up. Matches code as-is.
> L2 is **not yet approved** — see `/docs/contracts/analytics.md.PROPOSED`.

## File map
- `packages/db/src/schema.ts` — `analyticsConfig` table (`analytics_config`), single row per `kind` (`google_analytics` today), same shape-pattern as `emailConfig`. `measurementId` plaintext (public id, not a secret). Satisfies `L2-ANALYTICS-01`.
- `packages/db/migrations/0005_clear_mattie_franklin.sql` — drizzle-kit generated `CREATE TABLE analytics_config`.
- `packages/db/migrations/0006_seed_analytics_config.sql` — hand-written custom migration (`drizzle-kit generate --custom`), seeds the singleton row + default banner copy, `ON CONFLICT ("kind") DO NOTHING`. Fixed literal uuid for the seed id (the pk has no DB-level default — `$defaultFn` is app-side only). Satisfies `L2-ANALYTICS-01`, `L2-ANALYTICS-08`.
- `packages/db/migrations/0008_reword_cookie_banner.sql` — custom migration; rewrites the banner copy seeded by 0006. Guarded `WHERE "cookieBannerText" = <the 0006 literal>`, so an operator-edited banner is never clobbered (`L2-ANALYTICS-08`) and a re-run matches nothing. 0006 is left untouched — applied migrations are immutable; a fresh DB runs 0006 then 0008 and lands on the new copy.
- `settings/_actions.ts` → `saveAnalyticsConfig` — auth + `canAccessSettings` gate → uppercase/validate id → upsert on `kind` → `revalidatePath("/backflip/settings")`. Mirrors `saveEmailConfig` minus encryption. Satisfies `L2-ANALYTICS-02`, `L2-ANALYTICS-12`, `L2-ANALYTICS-14/15`.
- `settings/_components/analytics-integration.tsx` — client detail pane; `useActionState(saveAnalyticsConfig)`; exports the `AnalyticsConfig` view-model type (page.tsx imports it type-only). Banner switch is controlled state so the copy field and the explainer react live. Satisfies `L2-ANALYTICS-05`.
- `settings/_components/integrations-view.tsx` — `Selection` widened to `"ai" | "email" | "analytics"`; third `ListRow` (GA tile, subtitle = the measurement id when set, else "Not configured"); detail switch became a chain.
- `settings/_components/integrations-rail.tsx` — added `analytics` ABOUT entry (GA4 docs); the second card swaps "Keys encrypted at rest" for "Nothing secret here" on the analytics pane, since there is no key.
- `settings/page.tsx` — loads the `analytics_config` row, maps to the view model (defaults: banner enabled, empty strings), passes to `IntegrationsView`. Satisfies `L2-ANALYTICS-05`.
- `apps/web/app/api/public/analytics-config/route.ts` — the public read path. Explicit column select so the row's `id`/`updatedAt` can't leak. `force-dynamic` (no DB at build time) + ~5 min `Cache-Control`. try/catch → analytics-off. Satisfies `L2-ANALYTICS-03`, `L2-ANALYTICS-16`.
- `apps/web/app/_components/analytics-gate.tsx` — client; the decision module. Fetch config → read consent → derive `allowed` → inject gtag.js. Satisfies `L2-ANALYTICS-04`, `L2-ANALYTICS-06`, `L2-ANALYTICS-07`, `L2-ANALYTICS-13`.
- `apps/web/app/_components/cookie-banner.tsx` — client; presentational only (`role="region"`, `aria-label="Cookie consent"`, fixed bottom, `z-50`, Card-ish bar, `Button` outline/primary). No storage or GA knowledge.
- `apps/web/app/_components/site-footer.tsx` — now renders `<AnalyticsGate />`.

## Banner copy (why it reads the way it does)
Default is a conversion problem, not a legal one — the consent gate is strict (`L2-ANALYTICS-06`), so *undecided* visitors are never measured either, and most people never click anything. Measured traffic ≈ accept rate.
- Old seed led with the cost ("We use cookies … via Google Analytics") and gave no reason to say yes.
- Current default asks for the visit, states the benefit, bounds the use ("we only ever look at totals, and never use it for ads"), then names Google Analytics + cookies. Same facts, cost last.
- Claims are about *our* use only. Don't add promises about what Google does with it — an operator can enable Google Signals/ads features and make them false.
- Layout stays symmetric: Decline and Accept, one click each, same bar. EDPB requires reject to be equally easy; it does not require identical styling, so primary Accept + outline Decline stays compliant. Never remove Decline, never bury it behind a second layer.
- Copy is operator-editable at `/backflip/settings`, so retuning needs no deploy. `FALLBACK_TEXT` in `analytics-gate.tsx` mirrors the seed and must be updated with it.

## Why the config is fetched, not server-rendered
Public pages (`/`, `/getting-started`, both guides) build as `○` static. Reading `analytics_config` in those pages — or in the root layout — would flip them to `ƒ`, and the root layout is shared with `/backflip`, so it would drag the whole app dynamic.

Chosen: **static pages + client fetch of `/api/public/analytics-config`.** The route is the only dynamic piece; the pages stay prerendered. Verified in the build route table (`L2-ANALYTICS-11`, `L2-ANALYTICS-20`).

Rejected alternatives:
- Server component wrapped in `cache()` inside the root layout — still forces a dynamic render, and pollutes the admin surface.
- Per-page async server component — would flip each public page to `ƒ`.
- Env var instead of DB config — loses the admin-editable banner copy, which is the point.

Cost of the choice: config changes reach visitors within ~5 min (cache window), and the banner appears one paint after hydration rather than in the prerendered HTML. Both acceptable for a consent bar.

## Mount point
`AnalyticsGate` hangs off `SiteFooter` — the only chrome every public page renders and no admin page does (verified: `SiteFooter` is imported by exactly the 4 public pages). Structural enforcement of `L2-ANALYTICS-10`; no path sniffing at runtime. **If a public page is ever added without `SiteFooter`, analytics silently won't run there** — consider a public layout if the surface grows.

## Gotchas hit
- **Disabled textarea submits nothing.** First cut used `disabled={!bannerEnabled}` on the banner-text field; toggling the banner off and saving would have wiped the seeded copy (`FormData` omits disabled fields → `null`). Now `readOnly` + `aria-disabled` + `opacity-50`. See `L2-ANALYTICS-08`.
- **Measurement id is interpolated into a `<script src>`.** Public ≠ untrusted-safe: it's validated server-side against an allow-list charset and `encodeURIComponent`'d client-side.
- Route needs `force-dynamic`, else Next may try to evaluate it during `next build`, where no database is reachable.

## Verification
- `yarn workspace web typecheck` — clean. `@workspace/db typecheck` — clean. `yarn workspace web lint` — 0 errors (15 pre-existing warnings, none in new files).
- `yarn workspace web build` — passes. Route table unchanged for public pages: `○ /`, `○ /getting-started`, `○ /getting-started/setup-on-digitalocean-droplet`, `○ /getting-started/setup-on-digitalocean-droplet-docker-flavour`; new `ƒ /api/public/analytics-config`.
- Migrations applied to a throwaway database in the dev container: `0005` `CREATE TABLE`, `0006` `INSERT 0 1`, re-run `INSERT 0 0` (idempotent). Journal + snapshot `prevId`/`id` chain verified continuous. Throwaway db dropped.

## State
- **Dev database has NOT been migrated** — run `corepack yarn db:migrate` to pick up `0005`/`0006`.
- L2 contract awaiting approval; `@spec` tags in code already reference `L2-ANALYTICS-01..06`.
- `db` contract needs a matching table ID (proposed `L2-DB-23`) and its `L2-DB-14` table list extended — both are L2 edits, left for the human.
- Runtime behaviour not yet exercised in a browser (no measurement id configured).

## TODO
- `gtag('consent', ...)` Consent Mode v2 signals — currently we simply don't load the tag until consent, which is stricter and simpler. Revisit if Google Signals/ads features are ever needed.
- No "revoke consent" affordance once answered (would need a footer link clearing the localStorage key).
- Consider a shared public `layout.tsx` so the gate isn't tied to the footer.
