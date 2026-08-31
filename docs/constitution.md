# Constitution (L1) — Backflip

> L1 = invariants / why. Human-only changes. Cites nothing up. Governs L2 below.
> Style: terse. One fact per line.
> Source intent: `/docs/kickoff/phase1.md`.

## Purpose
Foundation platform. Baseline setup + features so builders bootstrap projects fast.
Tailored for AI-assisted dev — non-technical builders extend it via established guidelines.

## Domain model
- **Platform** — the shared foundation (stack, conventions, UI system, docs discipline).
- **Admin** — operator surface under `/backflip/*`. Auth-gated.
- **Public** — end-user facing surface. Open.
- **Admin user** — authenticates via Google. Holds a session.
- **UI system** — shared component library + theme, consumed by all surfaces.

## Boundaries
- `L1-ARCH-01` — Two surfaces: Public (open) and Admin (`/backflip/*`, gated). Distinct rendering strategies.
- `L1-ARCH-02` — Public pages: mostly SSR.
- `L1-ARCH-03` — Admin pages: driven by API endpoints (client fetch + loaders), not direct SSR data. [NEEDS HUMAN CONFIRMATION]
- `L1-ARCH-04` — Admin scope owns its auth boundary. Unauthenticated → redirect to admin login.
- `L1-ARCH-05` — Shared UI lives in `packages/ui`; apps consume, never fork components. [NEEDS HUMAN CONFIRMATION]
- `L1-ARCH-06` — Monorepo: `apps/*` (deployables) + `packages/*` (shared libs/config).
- `L1-ARCH-07` — Non-route code (components, hooks, utils, contexts, etc.) lives in underscore-prefixed dirs: `_components`, `_hooks`, `_utils`, `_contexts`, `_lib`, … Underscore = Next.js private folder, opted out of routing.
- `L1-ARCH-08` — Colocate by scope proximity. App-wide → `app/_components/…`. Layout-scoped → in that layout's dir. Page-scoped → in that page's dir. Cross-app/shared → `packages/*` (per `L1-ARCH-05`).

## Constraints (non-negotiable)
- `L1-CON-01` — Admin auth supports two methods: credentials (email + password) and Google login. Google sign-in is allowed only for emails already registered on the platform.
- `L1-CON-02` — `/backflip/*` requires a valid session; only the admin login route is public within scope.
- `L1-CON-03` — Foundation ships baseline + guidelines; features stay generic/extensible, not project-specific. [NEEDS HUMAN CONFIRMATION]
- `L1-CON-04` — Three-level doc system maintained with every code change (see project CLAUDE.md).
- `L1-CON-05` — Credentials (email + password) login may be disabled per-deployment for Google-only sign-in. The toggle is honored only when Google is configured, so at least one sign-in method always remains. Refines `L1-CON-01` (both methods are still supported; a deployment may turn one off).
- `L1-CON-06` — Connector access is read-only and opt-in (owner-enabled, default off); it grants no capability the connected user's role does not already hold.

## Stack + rationale
- `L1-STACK-01` — Next.js 16 (App Router) — unified SSR/RSC + API routes for both surfaces.
- `L1-STACK-02` — TypeScript 5 — type safety across the foundation.
- `L1-STACK-03` — React 19.2 — current, RSC support.
- `L1-STACK-04` — Turborepo + yarn 4 (corepack) — monorepo builds; corepack pins yarn@4.17.1 (see [[backflip-yarn-corepack]]).
- `L1-STACK-05` — shadcn/ui, `base-mira` style, neutral base, remixicon — themed component system from monorepo preset.
- `L1-STACK-06` — Tailwind CSS v4 — styling, CSS variables theming.
- `L1-STACK-07` — PostgreSQL — primary datastore. Runs in Docker for local dev.
- `L1-STACK-08` — Docker Compose — local infra. DB always dockerized; app runs local (preferred dev) or containerized.
- `L1-STACK-09` — Drizzle ORM + drizzle-kit — type-safe schema, queries, migrations over Postgres. Lives in shared `packages/db` (`@workspace/db`).
- `L1-STACK-10` — Auth.js v5 (next-auth) — authentication (Credentials + Google), Drizzle adapter, JWT sessions.
- `L1-STACK-11` — Vercel AI SDK (`ai` + `@ai-sdk/*`) — provider-agnostic AI integration (Anthropic default, OpenAI, Google). Config-driven provider/model.
- `L1-STACK-12` — Model Context Protocol SDK (`@modelcontextprotocol/server`) — remote MCP connector surface, Streamable HTTP, OAuth 2.1 protected.

## Governed domains (L2)
- `auth` → `/docs/contracts/auth.md`
- `ui` → `/docs/contracts/ui.md`
- `infra` → `/docs/contracts/infra.md`
- `db` → `/docs/contracts/db.md`
- `ai` → `/docs/contracts/ai.md`
- `email` → `/docs/contracts/email.md`
- `devops` → `/docs/contracts/devops.md`
- `mcp` → `/docs/contracts/mcp.md`

---
IDs: `L1-<CAT>-<NN>`. Permanent, never renumber. Retire with `[DEPRECATED]`, never delete.
