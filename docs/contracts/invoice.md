# Contract (L2) — invoice

> L2 = contract / what. AI proposes, human approves. Cite ≥1 L1.
> Style: terse. One fact per line.

> **Implements L1:** `L1-ARCH-01`, `L1-ARCH-04`, `L1-ARCH-07`, `L1-STACK-09`
> **Depends on L2:** `auth` (session + capabilities), `db` (schema, migrations), `ui` (component set)

## Owns
The invoicing surface: the shared invoice ledger under `/backflip/invoices`, its
data model (`invoice`, `invoice_party`, `invoice_entry`), its arithmetic, and the
printable invoice document. Ported from the legacy CRA app kept for reference in
`.legacy-ref-project/` (localStorage, MUI) — the behaviour is carried over, none
of its code is.

Explicitly **not** owned: payment collection, dunning, tax reporting, PDF
generation server-side (printing is the browser's), multi-currency conversion.

## Interfaces
- `L2-INVOICE-04` _(iface)_ — `_lib/calc.ts` — pure, client-safe invoice arithmetic: `num`, `round2`, `money`, `recalcEntry`, `chargesVat`, `getTotals`, `invoiceRef`, `currencyIso`, `invoiceTitle`, `today`, `formatDate`, `nextNumber`. Single source of truth for totals across form, preview and title.
- `L2-INVOICE-06` _(iface)_ — `_lib/validation.ts` → `invoiceDraftSchema` — zod shape for the save action: ISO dates, decimal strings (blank → `"0"`), field length caps, ≤200 lines.
- `L2-INVOICE-07` _(iface)_ — server actions (`_actions.ts`): `saveInvoice(draft)` (create or update, one transaction), `setInvoiceLock(id, locked)`, `deleteInvoice(id)`. All return `{ ok, message }`; `saveInvoice` also returns the invoice `id`.
- `L2-INVOICE-08` _(iface)_ — Route `/backflip/invoices` — three-column master/detail: ledger list, editor, live preview. One server load carries the whole ledger (the client needs it for customer prefill and series numbering).

## Schemas
- `L2-INVOICE-01` — `invoice` table: `id`, `ownerId` (fk → `user`, **restrict**), `invoiceDate` (date), `series`, `number`, `currency`, `vatRate` (numeric 5,2), `brandName`, `brandSubName`, `locked`, `createdAt`, `updatedAt`. See `L2-DB-29`.
- `L2-INVOICE-02` — `invoice_party` table: one row per (`invoiceId`, `kind`) with `kind` ∈ `provider | customer` — company/representative/address/billing fields. Unique on (`invoiceId`, `kind`). See `L2-DB-30`.
- `L2-INVOICE-03` — `invoice_entry` table: `invoiceId` (cascade), `position`, `dateProvided`, `description`, `qty`, `qtyType`, `rate`, `total`. See `L2-DB-31`.

## Invariants
- `L2-INVOICE-05` — Read is shared, write is owned: every user holding the `invoices` capability (all three roles) reads every invoice; `saveInvoice` / `setInvoiceLock` / `deleteInvoice` require `canManageInvoice` — the creator, or a platform `owner`/`admin`. Server-enforced, not merely UI-hidden.
- `L2-INVOICE-13` — A `locked` invoice refuses edits and deletion until it is unlocked. Locking/unlocking is itself a manage-level action.
- `L2-INVOICE-14` — VAT is charged only when the provider carries a VAT registration number **and** the rate is above zero; otherwise VAT is 0 everywhere, payable included. (The reference app printed VAT 0 yet added it to the payable total; that inconsistency is not carried over.)
- `L2-INVOICE-15` — Money and quantities are `numeric` in the database and strings in transit; parsing happens only inside `calc.ts`. No float columns, no float accumulation across surfaces.
- `L2-INVOICE-16` — Child rows are rewritten wholesale on save (delete + insert inside the transaction): the form owns the whole document.

## Errors
- `L2-INVOICE-17` — Editing a locked invoice → "Unlock the invoice before editing it." Editing someone else's → "This invoice belongs to someone else." Both are returned states, never thrown to the client.

## Acceptance
- `L2-INVOICE-18` — Creating an invoice with 2 × 100 at 21% VAT and a VAT-registered provider totals 200 net / 42 VAT / 242 payable, and the invoice appears in every user's ledger.
- `L2-INVOICE-19` — A teammate opening an invoice they did not create sees it read-only; the save action refuses the write even when called directly.
- `L2-INVOICE-20` — Printing the detail view prints the invoice document alone (no admin chrome), named after `invoiceTitle`.

## UI
- `L2-INVOICE-09` — Editor: provider and customer field sets side by side (13 fields each, grouped company / representative / address / billing), then lines, then invoice meta (date, series, number + generator, currency, VAT rate, branding), then the running totals.
- `L2-INVOICE-10` — Lines: qty or rate edits recompute the line total; a total edit back-solves the rate.
- `L2-INVOICE-11` — Preview is the print artifact: a print stylesheet hides everything but `#invoice-print-root`, A4 with 14 mm margins; `document.title` is set to `invoiceTitle(draft)` so a print-to-PDF is named after the invoice.
- `L2-INVOICE-12` — Customer prefill: distinct customers across the ledger (company name + address line 1 present), most recently invoiced first.
- `L2-INVOICE-21` — Numbering: the generator takes the highest number within the same series, adds one, and keeps the widest zero-padding in use; an empty series starts at `0001`. A new draft carries provider details, series, currency, VAT rate and branding over from the most recent invoice.

## Constrained L3
- `/docs/notes/invoice.md`

---
IDs: `L2-INVOICE-<NN>`. Permanent, never renumber.
Change: propose diff + affected-L3 → stop → await human.
