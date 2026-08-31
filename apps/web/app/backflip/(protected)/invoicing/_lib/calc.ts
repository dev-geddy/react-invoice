import type { InvoiceDraft, InvoiceEntry, InvoiceParty } from "./types"

/**
 * Invoice arithmetic and naming. Pure + client-safe: the form, the preview and
 * the server action all read totals from here, so a line total never depends on
 * which surface rendered it.
 *
 * Every value arrives as a string (form input / `numeric` column). `num()` is
 * the single coercion point: blank and unparseable read as 0 rather than NaN,
 * which is what the reference app's `parseFloat` chain produced on empty
 * fields.
 *
 * @spec L2-INVOICE-04
 */

export function num(value: string | number | null | undefined): number {
  const n = typeof value === "number" ? value : Number.parseFloat(value ?? "")
  return Number.isFinite(n) ? n : 0
}

/** Round to 2 decimals, away from binary float dust (0.615 → 0.62). */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

export function money(n: number): string {
  return round2(n).toFixed(2)
}

/**
 * Recompute the line after one of its numeric fields changed, mirroring the
 * reference app: qty and rate drive the total; editing the total back-solves
 * the rate (so an operator can type the agreed amount and keep the quantity).
 */
export function recalcEntry(
  entry: InvoiceEntry,
  field: "qty" | "rate" | "total",
  value: string
): InvoiceEntry {
  const next = { ...entry, [field]: value }

  switch (field) {
    case "qty":
      return { ...next, total: money(num(value) * num(entry.rate)) }
    case "rate":
      return { ...next, total: money(num(value) * num(entry.qty)) }
    case "total": {
      const qty = num(entry.qty)
      return { ...next, rate: qty === 0 ? entry.rate : money(num(value) / qty) }
    }
  }
}

/** VAT is charged only when the issuing company is VAT registered. */
export function chargesVat(provider: InvoiceParty, vatRate: string): boolean {
  return provider.companyVatNo.trim().length > 0 && num(vatRate) > 0
}

export type InvoiceTotals = {
  /** Sum of the line totals — also the VAT basis. */
  net: number
  vatAmount: number
  /** Net + VAT: what the customer pays. */
  gross: number
}

/**
 * Invoice totals. Unlike the reference app — which printed "VAT 0.00" yet still
 * added VAT to the payable line for a non-VAT-registered provider — VAT is
 * either charged everywhere or nowhere.
 */
export function getTotals(
  entries: InvoiceEntry[],
  provider: InvoiceParty,
  vatRate: string
): InvoiceTotals {
  const net = round2(entries.reduce((sum, e) => sum + num(e.total), 0))
  const vatAmount = chargesVat(provider, vatRate)
    ? round2((net * num(vatRate)) / 100)
    : 0

  return { net, vatAmount, gross: round2(net + vatAmount) }
}

/** `INV0007`, or `0007` when no series is set. */
export function invoiceRef(series: string, number: string): string {
  return `${series}${number}`.trim() || "—"
}

const CURRENCY_ISO: Record<string, string> = {
  "£": "GBP",
  "€": "EUR",
  $: "USD",
  "Fr.": "CHF",
}

export function currencyIso(currency: string): string {
  return CURRENCY_ISO[currency.trim()] ?? currency.trim().toUpperCase()
}

/**
 * Document title for an invoice — carried over from the reference app because
 * browsers use it as the default filename when the preview is printed to PDF.
 * `2026_08_31 - INV0007 - EUR1200.00 VAT incl. - Acme Ltd, Jane Doe`
 */
export function invoiceTitle(draft: InvoiceDraft): string {
  const { meta, provider, customer, entries } = draft
  const date = meta.invoiceDate.replaceAll("-", "_")
  const { gross } = getTotals(entries, provider, meta.vatRate)
  const vatLabel = chargesVat(provider, meta.vatRate) ? "VAT incl." : "NON-VAT"
  const billed = [customer.companyName, customer.name].filter(Boolean).join(", ")

  return [
    date,
    invoiceRef(meta.series, meta.number),
    `${currencyIso(meta.currency)}${money(gross)} ${vatLabel}`,
    billed || "unnamed customer",
  ].join(" - ")
}

/** Today as `yyyy-mm-dd` in the viewer's own timezone (not UTC). */
export function today(): string {
  const now = new Date()
  const offset = now.getTimezoneOffset() * 60_000
  return new Date(now.getTime() - offset).toISOString().slice(0, 10)
}

/** `2026-08-31` → `31/08/2026`, the format the printed invoice uses. */
export function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-")
  return y && m && d ? `${d}/${m}/${y}` : iso
}

/**
 * Next free number within a series: one past the highest existing number,
 * zero-padded to the widest number already in use (`0007` → `0008`). An empty
 * series starts at `0001`.
 */
export function nextNumber(existing: string[]): string {
  const numbers = existing
    .map((n) => n.trim())
    .filter((n) => /^\d+$/.test(n))
  if (numbers.length === 0) return "0001"

  const width = Math.max(...numbers.map((n) => n.length))
  const highest = Math.max(...numbers.map((n) => Number.parseInt(n, 10)))

  return String(highest + 1).padStart(width, "0")
}
