import "server-only"

import {
  customers,
  db,
  invoiceConfig,
  invoiceEntries,
  invoiceParties,
  invoiceSeries,
  invoices,
  users,
} from "@workspace/db"
import { and, asc, desc, eq } from "drizzle-orm"

import { canManageInvoice } from "@/app/_lib/auth/permissions"
import { getTotals, nextNumber, today } from "../../_lib/calc"
import { DEFAULT_TAX_YEAR, type TaxYear } from "./ledger-stats"
import {
  EMPTY_PARTY,
  type Invoice,
  type InvoiceDraft,
  type InvoiceEntry,
  type InvoiceParty,
  type InvoiceSeriesOption,
} from "../../_lib/types"

/**
 * Server reads shared by the three invoice routes: the ledger list, the
 * new-invoice page and one invoice's editor. Splitting the surface into pages
 * means each one loads only what it renders — the list no longer ships every
 * party and line to the client.
 *
 * @spec L2-INVOICE-33
 */

type SessionUser = { id: string; role?: string }

/** One row of the ledger list. */
export type LedgerRow = {
  id: string
  series: string
  number: string
  invoiceDate: string
  currency: string
  vatRate: string
  locked: boolean
  customerName: string
  ownerLabel: string
  /** Payable total — net plus VAT where the provider charges it. */
  gross: number
}

function toParty(row: Record<string, string>): InvoiceParty {
  const party = { ...EMPTY_PARTY }
  for (const key of Object.keys(EMPTY_PARTY) as (keyof InvoiceParty)[]) {
    party[key] = row[key] ?? ""
  }
  return party
}

export async function loadLedger(): Promise<LedgerRow[]> {
  const [rows, partyRows, entryRows] = await Promise.all([
    db
      .select({
        id: invoices.id,
        series: invoices.series,
        number: invoices.number,
        invoiceDate: invoices.invoiceDate,
        currency: invoices.currency,
        vatRate: invoices.vatRate,
        locked: invoices.locked,
        ownerName: users.name,
        ownerEmail: users.email,
      })
      .from(invoices)
      .innerJoin(users, eq(users.id, invoices.ownerId))
      .orderBy(desc(invoices.createdAt)),
    db.select().from(invoiceParties),
    db
      .select({
        invoiceId: invoiceEntries.invoiceId,
        total: invoiceEntries.total,
      })
      .from(invoiceEntries),
  ])

  const partiesByInvoice = new Map<
    string,
    Partial<Record<"provider" | "customer", InvoiceParty>>
  >()
  for (const row of partyRows) {
    const bucket = partiesByInvoice.get(row.invoiceId) ?? {}
    bucket[row.kind] = toParty(row as unknown as Record<string, string>)
    partiesByInvoice.set(row.invoiceId, bucket)
  }

  const entriesByInvoice = new Map<string, InvoiceEntry[]>()
  for (const row of entryRows) {
    const list = entriesByInvoice.get(row.invoiceId) ?? []
    list.push({ ...EMPTY_ENTRY, total: row.total })
    entriesByInvoice.set(row.invoiceId, list)
  }

  return rows.map((row) => {
    const parties = partiesByInvoice.get(row.id)
    const { gross } = getTotals(
      entriesByInvoice.get(row.id) ?? [],
      parties?.provider ?? EMPTY_PARTY,
      row.vatRate
    )

    return {
      id: row.id,
      series: row.series,
      number: row.number,
      invoiceDate: row.invoiceDate,
      currency: row.currency,
      vatRate: row.vatRate,
      locked: row.locked,
      customerName: parties?.customer?.companyName ?? "",
      ownerLabel: row.ownerName || row.ownerEmail,
      gross,
    }
  })
}

/** Only `total` matters for a ledger row's arithmetic. */
const EMPTY_ENTRY: InvoiceEntry = {
  dateProvided: "",
  description: "",
  qty: "0",
  qtyType: "",
  rate: "0",
  total: "0",
}

/** One invoice with its parties and lines, or `null` when it does not exist. */
export async function loadInvoice(
  id: string,
  sessionUser: SessionUser
): Promise<Invoice | null> {
  const [row] = await db
    .select({
      id: invoices.id,
      ownerId: invoices.ownerId,
      ownerName: users.name,
      ownerEmail: users.email,
      invoiceDate: invoices.invoiceDate,
      series: invoices.series,
      number: invoices.number,
      currency: invoices.currency,
      vatRate: invoices.vatRate,
      brandName: invoices.brandName,
      brandSubName: invoices.brandSubName,
      locked: invoices.locked,
      createdAt: invoices.createdAt,
    })
    .from(invoices)
    .innerJoin(users, eq(users.id, invoices.ownerId))
    .where(eq(invoices.id, id))
  if (!row) return null

  const [partyRows, entryRows] = await Promise.all([
    db.select().from(invoiceParties).where(eq(invoiceParties.invoiceId, id)),
    db
      .select()
      .from(invoiceEntries)
      .where(eq(invoiceEntries.invoiceId, id))
      .orderBy(asc(invoiceEntries.position)),
  ])

  const parties: Partial<Record<"provider" | "customer", InvoiceParty>> = {}
  for (const party of partyRows) {
    parties[party.kind] = toParty(party as unknown as Record<string, string>)
  }

  return {
    id: row.id,
    locked: row.locked,
    ownerId: row.ownerId,
    ownerName: row.ownerName,
    ownerEmail: row.ownerEmail,
    createdAt: row.createdAt.toISOString(),
    canManage: canManageInvoice(sessionUser.role, row.ownerId, sessionUser.id),
    meta: {
      invoiceDate: row.invoiceDate,
      series: row.series,
      number: row.number,
      currency: row.currency,
      vatRate: row.vatRate,
      brandName: row.brandName,
      brandSubName: row.brandSubName,
    },
    provider: parties.provider ?? EMPTY_PARTY,
    customer: parties.customer ?? EMPTY_PARTY,
    entries: entryRows.map((entry) => ({
      dateProvided: entry.dateProvided,
      description: entry.description,
      qty: entry.qty,
      qtyType: entry.qtyType,
      rate: entry.rate,
      total: entry.total,
    })),
  }
}

/** The configured financial year, or the UK default when nothing is saved. */
export async function loadTaxYear(): Promise<TaxYear> {
  const [config] = await db
    .select({
      month: invoiceConfig.taxYearStartMonth,
      day: invoiceConfig.taxYearStartDay,
    })
    .from(invoiceConfig)
    .where(eq(invoiceConfig.kind, "invoice"))

  return config ?? DEFAULT_TAX_YEAR
}

/** Everything the editor needs besides the invoice itself. */
export type EditorContext = {
  series: InvoiceSeriesOption[]
  savedCustomers: InvoiceParty[]
  /** Existing numbers per series code, for the next-number generator. */
  numbersBySeries: Record<string, string[]>
}

export async function loadEditorContext(): Promise<EditorContext> {
  const [seriesRows, configRows, customerRows, numberRows] = await Promise.all([
    db
      .select({
        code: invoiceSeries.code,
        currency: invoiceSeries.currency,
        brandName: invoiceSeries.brandName,
        brandSubName: invoiceSeries.brandSubName,
      })
      .from(invoiceSeries)
      .orderBy(asc(invoiceSeries.code)),
    db
      .select({
        brandName: invoiceConfig.brandName,
        brandSubName: invoiceConfig.brandSubName,
      })
      .from(invoiceConfig)
      .where(eq(invoiceConfig.kind, "invoice")),
    db.select().from(customers).orderBy(asc(customers.companyName)),
    db
      .select({ series: invoices.series, number: invoices.number })
      .from(invoices),
  ])

  const numbersBySeries: Record<string, string[]> = {}
  for (const row of numberRows) {
    ;(numbersBySeries[row.series] ??= []).push(row.number)
  }

  return {
    series: seriesRows.map((row) => ({
      ...row,
      // A series with no brand of its own prints the platform brand
      // (`L2-INVOICE-32`), resolved here so the invoice snapshots what it shows.
      brandName: row.brandName || (configRows[0]?.brandName ?? ""),
      brandSubName: row.brandSubName || (configRows[0]?.brandSubName ?? ""),
    })),
    savedCustomers: customerRows.map((row) =>
      toParty(row as unknown as Record<string, string>)
    ),
    numbersBySeries,
  }
}

/**
 * The starting point for a new invoice: provider details, currency and VAT
 * carried over from the most recent invoice, the series taken from it when it
 * still exists, and the next free number in that series.
 */
export async function loadNewInvoiceDraft(
  context: EditorContext
): Promise<InvoiceDraft> {
  const [last] = await db
    .select({
      series: invoices.series,
      currency: invoices.currency,
      vatRate: invoices.vatRate,
      id: invoices.id,
    })
    .from(invoices)
    .orderBy(desc(invoices.createdAt))
    .limit(1)

  const provider = last
    ? await db
        .select()
        .from(invoiceParties)
        .where(
          and(
            eq(invoiceParties.invoiceId, last.id),
            eq(invoiceParties.kind, "provider")
          )
        )
        .then(([row]) =>
          row ? toParty(row as unknown as Record<string, string>) : EMPTY_PARTY
        )
    : EMPTY_PARTY

  const known = context.series.map((option) => option.code)
  const code =
    last && known.includes(last.series)
      ? last.series
      : (context.series[0]?.code ?? last?.series ?? "")
  const picked = context.series.find((option) => option.code === code)

  return {
    meta: {
      invoiceDate: today(),
      series: code,
      number: nextNumber(context.numbersBySeries[code] ?? []),
      currency: picked?.currency ?? last?.currency ?? "€",
      vatRate: last?.vatRate ?? "0",
      brandName: picked?.brandName ?? "",
      brandSubName: picked?.brandSubName ?? "",
    },
    provider,
    customer: EMPTY_PARTY,
    entries: [
      {
        dateProvided: today(),
        description: "",
        qty: "1",
        qtyType: "h",
        rate: "0",
        total: "0",
      },
    ],
  }
}
