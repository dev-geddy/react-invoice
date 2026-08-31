# Contract (L2) — <domain>

> L2 = contract / what. AI proposes, human approves. Cite ≥1 L1.
> Style: terse. One fact per line.

> **Implements L1:** `L1-ARCH-02`, `L1-CON-01`
> **Depends on L2:** `<domain>` (acyclic) | none

## Owns
<what this context owns. 1 line>

> Flat template below fits small/medium contracts. If it outgrows it, group by
> `## <concern>` sections instead (kind-tag each item _(iface|schema|inv|err|accept)_);
> IDs stay permanent. Code cites these IDs via `@spec` JSDoc tags (see the skill).

## Interfaces
- `L2-<DOM>-01` — <signature — desc>
- `L2-<DOM>-02` — <...>

## Schemas
- `L2-<DOM>-03` — <shape, field types, required/optional>

## Invariants
- `L2-<DOM>-04` — <always-true rule>

## Errors
- `L2-<DOM>-05` — <conditions, codes, retry/idempotency>

## Acceptance
- `L2-<DOM>-06` — <testable done-condition>

## Constrained L3
- `/docs/notes/<domain>.md`

---
IDs: `L2-<DOM>-<NN>`. Permanent, never renumber.
Change: propose diff + affected-L3 → stop → await human.
