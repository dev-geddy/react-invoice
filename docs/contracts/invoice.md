# Contract (L2) — invoice

> L2 = contract / what. AI proposes, human approves. Cite ≥1 L1.
> Style: terse. One fact per line.

> **Implements L1:** `L1-ARCH-01`, `L1-ARCH-04`, `L1-ARCH-07`, `L1-STACK-09`
> **Depends on L2:** `auth` (session + capabilities), `db` (schema, migrations), `ui` (component set)

## Owns
The invoicing surface: the shared invoice ledger under `/backflip/invoicing/invoices`, its
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
- `L2-INVOICE-30` — Routes live under one `invoicing` section, mirrored by an "Invoicing" sidebar group: `/backflip/invoicing/invoices`, `/backflip/invoicing/customers`, `/backflip/invoicing/settings`. Shared party UI (`_components`) and invoice logic (`_lib`) sit at the section root. Sidebar highlighting is longest-prefix, so a nested route lights its own entry.
- `L2-INVOICE-29` _(iface)_ — Route `/backflip/invoicing/customers` — the customer address book over the `customer` table (capability `invoices`): search, add/edit through the party dialog, remove, and one-click adoption of companies that so far exist only on invoices. Feeds the invoice form's prefill (saved customers first, then invoice history). Invoices keep their own snapshot, so edits here never rewrite an issued invoice.
- `L2-INVOICE-24` _(iface)_ — Route `/backflip/invoicing/settings` — series, default currency and branding management ("Series & currency" in the nav) (capability `invoices.settings`). Actions `saveInvoiceSeries` / `deleteInvoiceSeries` in `settings/_actions.ts`; deletion is refused while invoices carry the code.
- `L2-INVOICE-08` _(iface)_ — Route `/backflip/invoicing/invoices` — the ledger list: per-series headline cards, the cumulative-sales chart, then every invoice as a row linking to its own page.
- `L2-INVOICE-33` _(iface)_ — Editing is its own route: `/backflip/invoicing/invoices/new` (unsaved draft, seeded from the most recent invoice) and `/backflip/invoicing/invoices/[id]` (one invoice). Both render the same two-pane workspace — form plus live preview, no list. Saving a new invoice replaces the URL with the created invoice's; deleting returns to the ledger. Server reads are shared in `_lib/queries.ts`, so the list loads rows only and the editor loads one invoice plus its reference data.
- `L2-INVOICE-36` _(iface)_ — The financial year is configurable in Series & currency (Tax year block): opening month + day (day capped at 28 so the date exists in every month), stored on `invoice_config`, defaulting to the UK tax year (6 April). The ledger totals and the cumulative chart report against it; the block shows the resulting range.
- `L2-INVOICE-34` _(iface)_ — Ledger overview: one compact card per series (tax-year total, all-time total, invoice counts, drafts, last invoice) above a line chart of cumulative payable per series across the current UK tax year (6 April – 5 April), one line per series. Derivations are pure (`_lib/ledger-stats.ts`, unit-tested).

## Schemas
- `L2-INVOICE-01` — `invoice` table: `id`, `ownerId` (fk → `user`, **restrict**), `invoiceDate` (date), `series`, `number`, `currency`, `vatRate` (numeric 5,2), `brandName`, `brandSubName`, `locked`, `createdAt`, `updatedAt`. See `L2-DB-29`.
- `L2-INVOICE-02` — `invoice_party` table: one row per (`invoiceId`, `kind`) with `kind` ∈ `provider | customer` — company/representative/address/billing fields. Unique on (`invoiceId`, `kind`). See `L2-DB-30`.
- `L2-INVOICE-22` — `invoice_series` table: `id`, `code` (unique — the numbering prefix), `currency`, `brandName`, `brandSubName`, `createdAt`, `updatedAt`. See `L2-DB-33`. An invoice **snapshots** the code and both brand parts when saved, so editing or deleting a series never rewrites issued invoices.
- `L2-INVOICE-03` — `invoice_entry` table: `invoiceId` (cascade), `position`, `dateProvided`, `description`, `qty`, `qtyType`, `rate`, `total`. See `L2-DB-31`.

## Invariants
- `L2-INVOICE-35` — The ledger chart never converts currencies: each series is plotted in its own, labelled with its symbol in the legend, the tooltip and a standing note. Series identity carries a validated categorical palette plus direct end-of-line labels — the theme's own chart ramp is one hue (right for magnitude, wrong for identity).
- `L2-INVOICE-05` — Read is shared, write is owned: every user holding the `invoices` capability (all three roles) reads every invoice; `saveInvoice` / `setInvoiceLock` / `deleteInvoice` require `canManageInvoice` — the creator, or a platform `owner`/`admin`. Server-enforced, not merely UI-hidden.
- `L2-INVOICE-23` — Raising invoices and configuring them are separate rights: every role holds `invoices`, only owner/admin hold `invoices.settings` (series, branding). Server-enforced by `requireCapability` + `canManageInvoiceSettings`.
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
- `L2-INVOICE-09` — Editor: invoice meta first (date, series, number + generator, currency, VAT rate), then provider and customer, then lines, then the running totals. The form column is capped at 500px so the preview rail keeps the rest of the width.
- `L2-INVOICE-28` — Provider and customer are summary cards side by side (company, reg/VAT, contact, address, IBAN); clicking one opens a dialog holding that side's 13 fields as four hairline-separated columns (company / representative / address / billing), all visible without scrolling. The customer's Prefill shortcut sits both on the card header and inside its dialog.
- `L2-INVOICE-32` — Branding falls back: a series with an empty `brandName`/`brandSubName` prints the platform brand from `invoice_config` (edited in the Brand block of Series & currency). The fallback is resolved server-side, so the invoice snapshots the brand it actually prints. Reading an invoice whose own snapshot is empty — written before any brand existed — resolves the same chain (series, then platform) at load, so the document's logo area is never blank.
- `L2-INVOICE-38` — The printed logo is one uppercase wordmark in two weights: `brandName` light and grey, `brandSubName` solid and black, set flush against each other.
- `L2-INVOICE-31` — A series carries a **default** currency, not a lock: picking the series stamps it on the draft, and the invoice's own currency stays editable. Businesses that bill one currency per sequence model that with one series each; mixed-currency ledgers override per invoice.
- `L2-INVOICE-25` — Series is a select over configured series, never free text; picking one stamps its branding and default currency onto the draft. Brand name parts are edited in invoice settings (`L2-INVOICE-24`), not per invoice. A code that is no longer configured stays selectable on the invoice that used it.
- `L2-INVOICE-27` — An unsaved draft is announced by an amber banner above the editor title, not by a placeholder row in the ledger list: the list shows stored invoices only.
- `L2-INVOICE-26` — Form and preview split the editor row evenly; the preview centres the sheet on a vignetted canvas and scales it to its half (`zoom`, capped at 1:1). A toggle hides the preview and hands the whole width to the form.
- `L2-INVOICE-37` — The editor repeats Save (and Lock/Unlock, where the user may manage the invoice) below the totals: on a long invoice the toolbar is off-screen by the time the form ends.
- `L2-INVOICE-10` — Lines: qty or rate edits recompute the line total; a total edit back-solves the rate.
- `L2-INVOICE-39` _(iface)_ — `POST /api/backflip/invoices/pdf` (capability `invoices`, Node runtime) renders the **posted draft** to an A4 PDF via `@react-pdf/renderer` and returns it as an attachment named by `pdfFilename` (the print title, filesystem-safe). The draft is posted rather than an id, so an unsaved edit downloads what the preview shows; nothing is read or written to the database. The PDF is a second rendering of the same document — same sections and wording as the HTML preview, a different layout engine — kept in step by hand.
- `L2-INVOICE-40` — The printed reference is always `series-number` (`RIE-0010`); either half alone prints alone, and an empty pair prints an em dash.
- `L2-INVOICE-41` — Document actions sit where the document is: Download PDF and Print float on the preview canvas above and below the sheet, and Download PDF also closes the form's bottom row on the trailing edge, opposite Save/Lock. Neither appears in the editor toolbar, and neither reaches paper (the print rules keep only the portalled document).
- `L2-INVOICE-42` — Delete sits on the back-link row, opposite "← Invoices" and far from Save; it is offered only to a user who may manage an unlocked invoice, and always through a confirmation dialog that names the invoice and spells out what goes (the shared ledger row, both parties, every line and the payable total) and what does not (the number, free to reuse in its series).
- `L2-INVOICE-43` — The wand actions carry tooltips as well as labels: the number generator (icon-only) and Prefill on both the customer card and its dialog. The wand alone does not say what it does, and Prefill overwrites fields.
- `L2-INVOICE-11` — Preview is the print artifact: a print stylesheet hides everything but `#invoice-print-root`, A4 with 14 mm margins; `document.title` is set to `invoiceTitle(draft)` so a print-to-PDF is named after the invoice.
- `L2-INVOICE-12` — Customer prefill: saved customers first (`L2-INVOICE-29`), then distinct customers from the ledger that are not saved (company name + address line 1 present), most recently invoiced first.
- `L2-INVOICE-21` — Numbering: the generator takes the highest number within the same series, adds one, and keeps the widest zero-padding in use; an empty series starts at `0001`. A new draft carries provider details, currency and VAT rate over from the most recent invoice, and its series (falling back to the first configured one) with that series' branding.

## Constrained L3
- `/docs/notes/invoice.md`

---
IDs: `L2-INVOICE-<NN>`. Permanent, never renumber.
Change: propose diff + affected-L3 → stop → await human.
