---
name: docs-sync
description: >
  Keep three-level docs (L1 Constitution / L2 Contracts / L3 Notes) in sync with
  code on every dev action. Load WHENEVER you write, edit, refactor, delete, or
  move code, add a dependency, or change an interface/schema/config. Also on:
  "update docs", "keep docs in sync", "docs-sync", "spec drift", "contract
  drift", "bootstrap docs". Enforces read-before-write, live L3 updates,
  halt-on-L2/L1-change.
---

# docs-sync

Living docs. Read before code. **Maintain with code.** Doc update = part of the change, not after.
Every dev action touches docs: new code → new/updated docs. No code lands with stale docs.

## Write style (all docs)
Terse. Fragments OK. Drop articles/filler. One fact per line. No prose paragraphs. Code/IDs exact. Short beats complete.

## Levels

| L | Name | Answers | Volatility | Writer | Path |
|---|------|---------|-----------|--------|------|
| **L1** | Constitution | Why — invariants, domain, boundaries, stack rationale | Rare | Human only | `/docs/constitution.md` |
| **L2** | Contracts | What — interfaces, schemas, invariants, errors, deps | Per feature | AI proposes, human approves | `/docs/contracts/<domain>.md` |
| **L3** | Notes | How — file maps, algorithms, deviations, TODOs, ADRs | Every commit | AI, free | `/docs/notes/<domain>.md` |

## Rules
- Cite upward only: L3→L2→L1. Never reverse.
- Stable IDs: `L1-ARCH-04`, `L2-AUTH-12`. Cite by ID, not heading/line.
- Every L2 cites ≥1 L1. Orphan L2 = scope creep → flag human.
- Conflict order: L1 > L2 > L3. Code≠L2 → code wrong. L2≠L1 → L2 wrong.
- **Read only what you touch.** Read L1 full + the touched L2 (+ skim its L3). Never read all contracts. This is why domains + IDs exist — keep it that way.

## Code ↔ spec tags (mandatory)
The link between code and its contract is a **greppable `@spec` tag**, not prose.
- Every feature's **owning module** carries a `@spec L2-…[, L2-…]` JSDoc line listing the IDs it implements. Owning module = the action file / route handler / lib module / primary component that holds the logic.
- **One tag per feature.** Thin wrappers (pages/components that only call a tagged module) do NOT repeat it — keeps tags high-signal.
- Format: `@spec L2-AUTH-27, L2-AUTH-30` on its own line inside the module's top (or primary export's) JSDoc.
- Navigate both ways: `grep "@spec L2-AUTH-27"` (spec→code); grep the ID in `/docs/contracts` (code→spec). No need to read a whole contract.
- Adding/moving a feature → add/update its `@spec`. Removing → remove it.
- **Non-TS owners** (yaml, Dockerfile, css, .env) use the file's native comment syntax with the same token: `# @spec L2-INF-04`, `/* @spec L2-UI-03 */`. **JSON is exempt** (no comments) — `package.json` / `components.json` etc. map via L3 file map only.
- **Don't force a tag** on library-wide sets (e.g. every `packages/ui` component for one ID) or on pure invariant/error/acceptance IDs — tag the module that owns the interface/logic; the rest are reachable from there + L3.

## Contract shape
- Small L2: the flat template (Owns / Interfaces / Schemas / Invariants / Errors / Acceptance).
- **Large L2 may group by concern** instead: `## <concern>` sections (see `auth.md`), each item kind-tagged _(iface | schema | inv | err | accept)_. Concern headers reorganize freely; **IDs stay permanent, never renumber** regardless of grouping.
- Split a domain into new domains only when a human decides; prefer concern-grouping first (no ID churn).

## Start of task
Check `/docs/constitution.md`.
- Missing → **Bootstrap** first (or ask to skip).
- Present → **Per-change**.

## Per-change

**Before code**
- Read L1 full.
- Read touched L2.
- Skim touched L3.
- Change not allowed by L2? → STOP → see "L2 change".

**During/after code**
- Update L3 live, no approval. File maps, notes, TODOs, deviations.
- ADR entry for non-obvious decision (`references/adr-template.md`).
- L3 cites the L2 IDs it satisfies.
- **`@spec` tag** on the owning module of any feature added/moved (see "Code ↔ spec tags").
- **New feature in existing domain** → update that L2 (propose, see Halt) + write L3.
- **New bounded context/domain** → draft new L2 contract (`references/l2-contract-template.md`, cite L1) + new L3 notes + add domain to L1 "Governed domains". L2 = propose+approve; L3 = free.
- **Deleted/moved code** → prune or update matching L2/L3. Dead docs = drift.

**Code placement (project convention — enforce on every change)**
- Non-route code (components, hooks, utils, contexts, …) → underscore-prefixed dirs: `_components`, `_hooks`, `_utils`, `_contexts`, `_lib`, … Underscore = Next.js private folder (no routing).
- Colocate by scope proximity: app-wide → `app/_components/…`; layout-scoped → in that layout dir; page-scoped → in that page dir; cross-app/shared → `packages/*`.
- Invariants: `L1-ARCH-07`, `L1-ARCH-08`. Misplaced code = drift → move it.

**Definition of done**
Code change not done until: L3 updated, new/changed L2 proposed, `@spec` tag on the owning module, code placed per convention, no stale doc left.

**Halt — never silent**
- Need L2 change (interface/schema/invariant/dep/error)? → don't edit mid-flow. Emit L2 diff + affected-L3 list → STOP → await human.
- Need L1 change? → never edit. Ask, with rationale.
- Code contradicts L2? → fix CODE to match L2. Don't rewrite L2.

**Drift check** (on request / batch end)
- L3≠code → regenerate L3.
- L3 keeps contradicting L2 → stale contract → propose L2 change.
- Orphan L2, broken ID refs, L2↔L2 cycles → flag.
- Feature code with no `@spec` tag, or a tag citing a retired/nonexistent ID → fix.
- Output: `references/drift-report.md`.

## Evolution rule
Promote up = human decision. Demote/regenerate down = automatic.

## Bootstrap (no docs)
1. Scan code: entry points, modules, deps, READMEs.
2. Draft `constitution.md` from `references/l1-constitution-template.md`. Mark inferred clauses `[NEEDS HUMAN CONFIRMATION]`. Assign L1 IDs.
3. Draft one L2 per bounded context (`references/l2-contract-template.md`), cite L1 IDs.
4. Draft L3 per domain, code as-is, include known deviations.
5. Present tree to human. Inferred L1/L2 not approved till confirmed.

## Templates
`references/l1-constitution-template.md`, `l2-contract-template.md`, `adr-template.md`, `drift-report.md`
