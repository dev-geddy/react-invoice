# Contract (L2) — ui

> L2 = contract / what. AI proposes, human approves. Cite ≥1 L1.
> Style: terse. One fact per line.

> **Implements L1:** `L1-ARCH-05`, `L1-STACK-05`, `L1-STACK-06`
> **Depends on L2:** none

## Owns
Shared design system: `packages/ui` component library, theme, and the `/ui-samples` demo.

## Interfaces
- `L2-UI-01` — `@workspace/ui/components/*` — shadcn component set. Apps import from here, never fork.
- `L2-UI-02` — `@workspace/ui/lib/utils` → `cn()` — class merge helper.
- `L2-UI-03` — `@workspace/ui/globals.css` — theme tokens (CSS vars), imported once in root layout.
- `L2-UI-04` — Root layout providers: `ThemeProvider` (next-themes), `TooltipProvider`, `Toaster` (sonner). (`apps/web/app/layout.tsx`)
- `L2-UI-05` — Route `/backflip/ui-samples` — admin-only component gallery (auth-gated, second Platform nav item below Overview); renders every component, `d` toggles dark mode. (`apps/web/app/backflip/(protected)/ui-samples/page.tsx`)
- `L2-UI-18` — Routes `/getting-started` (three-phase index: 01 Discover / 02 Set up / 03 Start building) + `/getting-started/intro` (discovery: what Backflip is, whom for) + **two droplet setup wizards**: `/getting-started/setup-on-digitalocean-droplet` (pm2 flavour) and `/getting-started/setup-on-digitalocean-droplet-docker-flavour` (Docker Postgres + Caddy) + `/getting-started/start-building` (copy-ready coding-agent prompts, prompts only) — all public + static. Both wizards are client-only: operator variables never leave the browser — kept in component state + `sessionStorage` (tab-scoped, per-guide namespace; no password is ever persisted), rendered into copyable `devops/` commands. Shared shell + chrome in `getting-started/_components/`; per-flavour command strings in each guide's `_components/setup-vars.ts`. Mirrors `L2-DEVOPS-01`, `L2-DEVOPS-02`, `L2-DEVOPS-06`; command strings must track those. (`apps/web/app/getting-started/…`)
- `L2-UI-19` — Deployed version marker: monorepo root `package.json` `version`, inlined at build time (`apps/web/next.config.ts` → `env.NEXT_PUBLIC_APP_VERSION`) and rendered by `apps/web/app/_components/app-version.tsx` as `v<version>` in small low-contrast type. Mounted on the public footer and the admin Overview — both surfaces (`L1-ARCH-01`). Build-time value; no runtime override, so it names the build in the live slot.
- `L2-UI-20` — Route `/backflip/docs` — admin docs explorer (capability `dashboard`). Renders the repo's three-level docs (`/docs/constitution.md`, `/docs/contracts/*.md`, `/docs/notes/*.md`) as a domain-chip-filtered L1 | L2 | L3 cascade over a markdown reading pane. Selection filters bidirectionally (pick any level → the other two narrow to what cites it / what it cites); rows carry child counts + drift badges. Header "Docs" link points here (was the GitHub README; README link kept in-page); also a `⌘K` jump target. No sidebar entry. (`apps/web/app/backflip/(protected)/docs/page.tsx`)

## Schemas
- `L2-UI-06` — shadcn config (`packages/ui/components.json`): style `base-mira`, baseColor `neutral`, RSC on, icons `remixicon`, css vars on.
- `L2-UI-07` — Aliases: components/ui → `@workspace/ui/components`, utils → `@workspace/ui/lib/utils`.
- `L2-UI-21` — Docs index built at **build time**, never at runtime: a `server-only` module parses `/docs/**/*.md` (headings, `L[123]-<CAT>-<NN>` IDs, `Implements L1:` / `Depends on L2:` / inline `L2-…` cite edges) and greps `@spec` tags across `apps/*`, `packages/*`, `devops/*` into one serializable index. `yarn workspace web docs:index` writes `docs-index.generated.json`; the workspace `build` script runs it before `next build`. Rationale: the Docker runner ships only `.next/standalone`, so `/docs` is absent at runtime. Dev reads the working tree live.

## Invariants
- `L2-UI-08` — One theme source: `packages/ui`. No per-app component copies.
- `L2-UI-09` — Overlay components (tooltip/toast) require their providers mounted in root layout.
- `L2-UI-10` — Web app transpiles `@workspace/ui` (`next.config.ts transpilePackages`).
- `L2-UI-14` — `Button` infers base-ui `nativeButton` from its `render` element: `<button>` → true, any other element → false. Explicit `nativeButton` overrides. Link-buttons (`render={<a/>}` / `render={<Link/>}`) need no extra prop.
- `L2-UI-15` — Shell containers hosting page content are shrinkable (`min-w-0`), so page content never forces the shell wider than its slot.
- `L2-UI-22` — Docs explorer is read-only. No doc editing or writing from the admin UI.
- `L2-UI-23` — Drift badges are derived on read, never stored: `orphan` = ID no L3 note cites (L1: no L2 implements), `no code` = ID with zero `@spec` references, `needs confirm` = clause carrying `[NEEDS HUMAN CONFIRMATION]`, `broken ref` = cites an ID defined nowhere in `/docs`.

## Errors
- `L2-UI-11` — Component used without required provider → runtime context error. Mount provider in root layout.

## Acceptance
- `L2-UI-12` — `/ui-samples` renders all components without error; dark toggle works.
- `L2-UI-13` — Any app imports a component via `@workspace/ui/components/*` and it themes correctly.
- `L2-UI-16` — No surface produces page-level horizontal scroll at ≥640px.
- `L2-UI-17` — Public + admin surfaces load with zero console errors/warnings.
- `L2-UI-24` — Every ID present in `/docs` appears in the explorer index; broken or unknown ID citations render as badges, never crash the page.

## Constrained L3
- `/docs/notes/ui.md`

---
IDs: `L2-UI-<NN>`. Permanent, never renumber.
Change: propose diff + affected-L3 → stop → await human.
