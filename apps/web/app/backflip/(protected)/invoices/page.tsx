import {
  db,
  invoiceEntries,
  invoiceParties,
  invoiceSeries,
  invoices,
  users,
} from "@workspace/db"
import { asc, desc, eq } from "drizzle-orm"

import { requireCapability } from "@/app/_lib/auth/guard"
import {
  canManageInvoice,
  canManageInvoiceSettings,
} from "@/app/_lib/auth/permissions"
import { InvoicesView } from "./_components/invoices-view"
import {
  EMPTY_PARTY,
  type Invoice,
  type InvoiceEntry,
  type InvoiceParty,
} from "./_lib/types"

/**
 * /backflip/invoices — the shared invoice ledger. Every signed-in user reads
 * every invoice (`invoices` capability); `canManage` marks per row whether this
 * user may also write it back (creator, or a platform operator).
 *
 * One page load carries the whole ledger: the client shell needs past invoices
 * anyway, to prefill customers and to work out the next number in a series.
 *
 * @spec L2-INVOICE-08
 */
export default async function InvoicesPage() {
  const sessionUser = await requireCapability("invoices")

  const rows = await db
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
    .orderBy(desc(invoices.createdAt))

  const [partyRows, entryRows, seriesRows] = await Promise.all([
    db.select().from(invoiceParties),
    db.select().from(invoiceEntries).orderBy(invoiceEntries.position),
    db
      .select({
        code: invoiceSeries.code,
        brandName: invoiceSeries.brandName,
        brandSubName: invoiceSeries.brandSubName,
      })
      .from(invoiceSeries)
      .orderBy(asc(invoiceSeries.code)),
  ])

  const partiesByInvoice = new Map<
    string,
    Partial<Record<"provider" | "customer", InvoiceParty>>
  >()
  for (const p of partyRows) {
    const bucket = partiesByInvoice.get(p.invoiceId) ?? {}
    bucket[p.kind] = {
      companyName: p.companyName,
      companyRegNo: p.companyRegNo,
      companyVatNo: p.companyVatNo,
      name: p.name,
      role: p.role,
      addressLine1: p.addressLine1,
      addressLine2: p.addressLine2,
      addressLine3: p.addressLine3,
      addressLine4: p.addressLine4,
      billingBankAccountIban: p.billingBankAccountIban,
      billingBankAccountBic: p.billingBankAccountBic,
      billingBankAccountNo: p.billingBankAccountNo,
      billingBankAccountSortCode: p.billingBankAccountSortCode,
    }
    partiesByInvoice.set(p.invoiceId, bucket)
  }

  const entriesByInvoice = new Map<string, InvoiceEntry[]>()
  for (const e of entryRows) {
    const list = entriesByInvoice.get(e.invoiceId) ?? []
    list.push({
      dateProvided: e.dateProvided,
      description: e.description,
      qty: e.qty,
      qtyType: e.qtyType,
      rate: e.rate,
      total: e.total,
    })
    entriesByInvoice.set(e.invoiceId, list)
  }

  const ledger: Invoice[] = rows.map((row) => ({
    id: row.id,
    locked: row.locked,
    ownerId: row.ownerId,
    ownerName: row.ownerName,
    ownerEmail: row.ownerEmail,
    createdAt: row.createdAt.toISOString(),
    canManage: canManageInvoice(
      sessionUser.role,
      row.ownerId,
      sessionUser.id
    ),
    meta: {
      invoiceDate: row.invoiceDate,
      series: row.series,
      number: row.number,
      currency: row.currency,
      vatRate: row.vatRate,
      brandName: row.brandName,
      brandSubName: row.brandSubName,
    },
    provider: partiesByInvoice.get(row.id)?.provider ?? EMPTY_PARTY,
    customer: partiesByInvoice.get(row.id)?.customer ?? EMPTY_PARTY,
    entries: entriesByInvoice.get(row.id) ?? [],
  }))

  return (
    <InvoicesView
      invoices={ledger}
      series={seriesRows}
      canManageSettings={canManageInvoiceSettings(sessionUser.role)}
    />
  )
}
