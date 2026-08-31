# Legacy reference — original react-invoice (CRA)

This directory is the **original app**, kept for reference only: Create React App +
MUI + redux-saga, storing invoices in `localStorage`.

It is **not** part of the build. Nothing here is compiled, linted, tested or
deployed — the workspaces are `apps/*` and `packages/*`.

Its behaviour lives on in the platform app at `/backflip/invoices`:

| Legacy | Now |
| --- | --- |
| `src/redux/invoice/*` (localStorage sagas) | `app/backflip/(protected)/invoices/_actions.ts` + Postgres |
| `src/utils/invoice.js` | `invoices/_lib/calc.ts` (with tests) |
| `src/components/InvoiceForm`, `InvoiceParty`, `InvoiceEntries`, `InvoiceMeta` | `invoices/_components/invoice-editor.tsx` + `party-fields.tsx` + `entry-rows.tsx` |
| `src/components/Invoice/*` + `Invoice.css` | `invoices/_components/invoice-preview.tsx` |
| `src/components/StoredInvoicesList` | `invoices/_components/invoice-list.tsx` |
| `src/components/PrefillCustomer` | `invoices/_components/prefill-customer-dialog.tsx` |
| `src/invoiceConfig.js` (defaults from `.env`) | carried over from the last invoice (`L2-INVOICE-21`) |
| `src/translations/*` (en-UK / lt-LT) | not ported — the admin surface is English-only for now |

See `docs/contracts/invoice.md` for the contract and `docs/notes/invoice.md` for
the implementation notes.
