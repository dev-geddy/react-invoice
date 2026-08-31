# Notes (L3) — invoice

> L3 = how / volatile. Regenerated from code. Cites L2 by ID.

## Layout
All page-scoped, under `apps/web/app/backflip/(protected)/invoices/` (`L1-ARCH-07/08`):

- `page.tsx` — RSC loader. One `select` for invoices + owner (join on `user`), plus one for all parties and one for all entries, assembled in memory into `Invoice[]`. Marks `canManage` per row via `canManageInvoice`. Satisfies `L2-INVOICE-08`.
- `_actions.ts` — `saveInvoice`, `setInvoiceLock`, `deleteInvoice`. `saveInvoice` runs one transaction: `select … for update` on the invoice (ownership + lock check), update-or-insert the header, then delete + reinsert parties and entries. Guard failures inside the transaction throw a private `ActionError`, caught at the boundary and returned as `{ ok: false }`. Satisfies `L2-INVOICE-07`, `L2-INVOICE-16`, `L2-INVOICE-17`.
- `_lib/calc.ts` (+ `calc.test.ts`, 16 cases) — the arithmetic, `L2-INVOICE-04`.
- `_lib/validation.ts` — `invoiceDraftSchema`, `L2-INVOICE-06`.
- `_lib/types.ts` — `Invoice`, `InvoiceDraft`, `InvoiceParty`, `InvoiceEntry`, `EMPTY_PARTY`.
- `_components/invoices-view.tsx` — shell. `InvoicesView` holds selection + search; `InvoiceWorkspace` (keyed on the selected id, so switching rows remounts rather than patching state in an effect) holds the draft, the save/lock/delete transitions and the prefill dialog.
- `_components/invoice-editor.tsx`, `party-fields.tsx`, `entry-rows.tsx` — the form, `L2-INVOICE-09/10`.
- `_components/invoice-preview.tsx` — the printed document + its print stylesheet, `L2-INVOICE-11`.
- `_components/invoice-list.tsx`, `prefill-customer-dialog.tsx` — ledger column and customer prefill, `L2-INVOICE-12`.

## Decisions worth remembering
- Parties live in their own table rather than 26 prefixed columns on `invoice`: it keeps one field set for both sides and makes "customers I have invoiced before" a plain select. Costs one extra query per page load, which the single-load design already absorbs.
- The whole ledger ships to the client on load. Customer prefill and series numbering both need history, and the ledger is small by nature (one company's invoices). Revisit with pagination if a deployment ever passes a few thousand rows.
- Draft state is deliberately *not* synced from props in an effect — the workspace is keyed on the selected invoice id. That is also why saving a new invoice (`null` → id) shows the saved copy: the key changes and the workspace remounts.
- `numeric` columns arrive as strings; the form edits strings; only `calc.ts` parses. Line totals are stored, not recomputed on read, because the operator may override a total (which back-solves the rate).
- VAT: the reference app printed VAT 0 for a non-VAT-registered provider yet still added VAT to the payable total. Fixed here (`L2-INVOICE-14`) — the tests pin both directions.

## Series + settings
- `settings/page.tsx` + `_components/series-settings.tsx` + `settings/_actions.ts` — the series list, its inline editor and the two brand-name parts. Reached from the "Invoice settings" button in the editor toolbar (owner/admin only); no sidebar entry of its own.
- Codes that invoices already carry but that nobody configured (invoices raised before series existed) are listed as one-click "add" chips with their invoice count.
- Deletion is refused while any invoice carries the code, and the settings page shows the per-series invoice count so the disabled remove button explains itself.
- The invoice keeps its own `series`/`brandName`/`brandSubName` columns. Renaming a series therefore leaves existing invoices printing what they were issued under — deliberate, and the reason there is no FK between `invoice` and `invoice_series`.

## Print
`window.print()` on the detail view. The stylesheet hides every element (`visibility: hidden`) and re-shows `#invoice-print-root` and its subtree, absolutely positioned at the page origin, with nested `overflow` forced visible — the admin shell scrolls in nested containers that would otherwise clip the document to one viewport. `document.title` is swapped to `invoiceTitle(draft)` while the workspace is mounted, so "save as PDF" proposes the invoice's own name.

## Legacy reference
`.legacy-ref-project/` holds the original CRA + MUI + redux-saga app (localStorage-backed) that this surface replaces. It is reference material only — not built, not linted, not deployed. Field labels, groupings, the recalculation rules and the printed layout were taken from it.

## Layout
- The admin shell does not bound its children's height, so `invoices-view` sets `h-[calc(100svh-var(--header-height))]` itself; without it the whole page scrolls and the preview cannot centre in its rail.
- The form scroll container carries `px-5 pb-5` only — a padded scrollport leaves a transparent strip that `sticky top-0` column headers cannot cover, so the top padding lives on a spacer inside instead.
- A new draft shows an amber "not saved" banner above the title (`L2-INVOICE-27`); the ledger list carries stored invoices only.
- Provider/customer columns are capped at 14rem and always side by side; the form column is capped at 500px while the preview is open.

## Gotchas
- `getByLabel("Rate")` matches "VAT rate %" too; the e2e suite uses `{ exact: true }` for the short numeric labels.
- base-ui's `Select` puts the `id` on its hidden native input, so `getByLabel("Series")` finds that input, not the control. Target the trigger with `getByRole("combobox", { name: "Series" })`.
- e2e `global-setup` truncates `invoice_series` alongside the auth tables — series survive the user truncate otherwise (no FK to `user`) and leak between runs.
- Deleting a user with invoices is refused by the FK (`on delete restrict`) — intentional, an invoice is a financial record. Reassign or delete their invoices first.
