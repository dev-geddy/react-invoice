# Notes (L3) — invoice

> L3 = how / volatile. Regenerated from code. Cites L2 by ID.

## Layout
Under `apps/web/app/backflip/(protected)/invoicing/` (`L1-ARCH-07/08`), one directory per nav item plus shared code at the section root:

- `_lib/` — `calc.ts` (+ tests), `types.ts`, `validation.ts`: shared by invoices, customers and settings.
- `_components/` — `party-card.tsx`, `party-dialog.tsx`, `party-fields.tsx`: the party UI both the invoice form and the address book use.
- `invoices/`, `customers/`, `settings/` — the three routes.

Invoice surface:

- `page.tsx` — RSC loader. One `select` for invoices + owner (join on `user`), plus one for all parties and one for all entries, assembled in memory into `Invoice[]`. Marks `canManage` per row via `canManageInvoice`. Satisfies `L2-INVOICE-08`.
- `_actions.ts` — `saveInvoice`, `setInvoiceLock`, `deleteInvoice`. `saveInvoice` runs one transaction: `select … for update` on the invoice (ownership + lock check), update-or-insert the header, then delete + reinsert parties and entries. Guard failures inside the transaction throw a private `ActionError`, caught at the boundary and returned as `{ ok: false }`. Satisfies `L2-INVOICE-07`, `L2-INVOICE-16`, `L2-INVOICE-17`.
- `_lib/calc.ts` (+ `calc.test.ts`, 16 cases) — the arithmetic, `L2-INVOICE-04`.
- `_lib/validation.ts` — `invoiceDraftSchema`, `L2-INVOICE-06`.
- `_lib/types.ts` — `Invoice`, `InvoiceDraft`, `InvoiceParty`, `InvoiceEntry`, `EMPTY_PARTY`.
- `_components/invoices-view.tsx` — shell. `InvoicesView` holds selection + search; `InvoiceWorkspace` (keyed on the selected id, so switching rows remounts rather than patching state in an effect) holds the draft, the save/lock/delete transitions and the prefill dialog.
- `_components/invoice-editor.tsx`, `entry-rows.tsx` — the form, `L2-INVOICE-09/10`.
- `_components/party-card.tsx` + `party-dialog.tsx` + `party-fields.tsx` — provider/customer as a summary card opening a dialog over the same field set (`L2-INVOICE-28`). Both dialogs mount only while open, so the shared field ids/labels never collide. The dialog overrides the base `sm:max-w-sm` cap with `sm:max-w-4xl` — the override must carry the same breakpoint variant, or tailwind-merge keeps both and the narrow one wins.
- `_components/invoice-preview.tsx` — the printed document + its print stylesheet, `L2-INVOICE-11`.
- `_components/invoice-list.tsx`, `prefill-customer-dialog.tsx` — ledger column and customer prefill, `L2-INVOICE-12`.

## Decisions worth remembering
- Parties live in their own table rather than 26 prefixed columns on `invoice`: it keeps one field set for both sides and makes "customers I have invoiced before" a plain select. Costs one extra query per page load, which the single-load design already absorbs.
- The whole ledger ships to the client on load. Customer prefill and series numbering both need history, and the ledger is small by nature (one company's invoices). Revisit with pagination if a deployment ever passes a few thousand rows.
- Draft state is deliberately *not* synced from props in an effect — the workspace is keyed on the selected invoice id. That is also why saving a new invoice (`null` → id) shows the saved copy: the key changes and the workspace remounts.
- `numeric` columns arrive as strings; the form edits strings; only `calc.ts` parses. Line totals are stored, not recomputed on read, because the operator may override a total (which back-solves the rate).
- VAT: the reference app printed VAT 0 for a non-VAT-registered provider yet still added VAT to the payable total. Fixed here (`L2-INVOICE-14`) — the tests pin both directions.

## Customers
- `customers/page.tsx` + `_components/customers-view.tsx` + `_actions.ts` — the address book. Cards reuse `PartyCard`; editing reuses `PartyDialog` with `onDone`/`doneLabel`, so add and edit go through the same four-column form the invoice uses.
- Usage counts and the "invoiced but not saved" chips both come from `invoice_party` rows of kind `customer`, matched case-insensitively on company name (there is no FK — the invoice holds a snapshot).
- Prefill on the invoice form merges the address book with ledger history, saved entries first.

## Series + settings
- `settings/page.tsx` + `_components/series-settings.tsx` + `settings/_actions.ts` — the series list, its inline editor and the two brand-name parts. Reached from the "Invoice settings" button in the editor toolbar (owner/admin only); no sidebar entry of its own.
- Codes that invoices already carry but that nobody configured (invoices raised before series existed) are listed as one-click "add" chips with their invoice count.
- Deletion is refused while any invoice carries the code, and the settings page shows the per-series invoice count so the disabled remove button explains itself.
- The platform brand lives in `invoice_config` (singleton, upsert on `kind`). Series brand inputs show it as their placeholder, and `invoices/page.tsx` resolves `series.brandName || config.brandName` before the form ever sees it — so the snapshot on the invoice is the brand that was printed.
- Currency is a series **default**, stamped onto the draft on selection and still editable on the invoice (`L2-INVOICE-31`) — locking it would break mixed-currency ledgers, while per-currency numbering is expressible as one series per currency.
- The invoice keeps its own `series`/`currency`/`brandName`/`brandSubName` columns. Renaming a series therefore leaves existing invoices printing what they were issued under — deliberate, and the reason there is no FK between `invoice` and `invoice_series`.

## Print
`window.print()` on the detail view. The stylesheet hides every element (`visibility: hidden`) and re-shows `#invoice-print-root` and its subtree, absolutely positioned at the page origin, with nested `overflow` forced visible — the admin shell scrolls in nested containers that would otherwise clip the document to one viewport. `document.title` is swapped to `invoiceTitle(draft)` while the workspace is mounted, so "save as PDF" proposes the invoice's own name.

## Legacy reference
`.legacy-ref-project/` holds the original CRA + MUI + redux-saga app (localStorage-backed) that this surface replaces. It is reference material only — not built, not linted, not deployed. Field labels, groupings, the recalculation rules and the printed layout were taken from it.

## Layout
- The admin shell does not bound its children's height, so `invoices-view` sets `h-[calc(100svh-var(--header-height))]` itself; without it the whole page scrolls and the preview cannot centre in its rail.
- The form scroll container carries `px-5 pb-5` only — a padded scrollport leaves a transparent strip that `sticky top-0` column headers cannot cover, so the top padding lives on a spacer inside instead.
- A new draft shows an amber "not saved" banner above the title (`L2-INVOICE-27`); the ledger list carries stored invoices only.
- Provider/customer cards sit side by side; their fields moved into dialogs when the form column was capped at 500px — 13 inputs per side did not survive that width.

## Gotchas
- `getByLabel("Rate")` matches "VAT rate %" too; the e2e suite uses `{ exact: true }` for the short numeric labels.
- e2e fills party details through the cards: `getByRole("button", { name: "Edit customer details" })` → fields → "Done".
- base-ui's `Select` puts the `id` on its hidden native input, so `getByLabel("Series")` finds that input, not the control. Target the trigger with `getByRole("combobox", { name: "Series" })`.
- e2e `global-setup` truncates `invoice_series` alongside the auth tables — series survive the user truncate otherwise (no FK to `user`) and leak between runs.
- Deleting a user with invoices is refused by the FK (`on delete restrict`) — intentional, an invoice is a financial record. Reassign or delete their invoices first.
