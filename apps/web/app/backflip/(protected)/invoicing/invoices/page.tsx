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
} from "../_lib/types"

/**
 * /backflip/invoicing/invoices — the shared invoice ledger. Every signed-in user reads
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

  const [partyRows, entryRows, customerRows, seriesRows, configRows] =
    await Promise.all([
    db.select().from(invoiceParties),
    db.select().from(invoiceEntries).orderBy(invoiceEntries.position),
    db
      .select()
      .from(customers)
      .orderBy(asc(customers.companyName)),
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
      series={seriesRows.map((row) => ({
        ...row,
        // A series with no brand of its own prints the platform brand
        // (`L2-INVOICE-32`); resolving here means the invoice snapshots the
        // brand it actually shows.
        brandName: row.brandName || (configRows[0]?.brandName ?? ""),
        brandSubName: row.brandSubName || (configRows[0]?.brandSubName ?? ""),
      }))}
      savedCustomers={customerRows.map((row) => ({
        companyName: row.companyName,
        companyRegNo: row.companyRegNo,
        companyVatNo: row.companyVatNo,
        name: row.name,
        role: row.role,
        addressLine1: row.addressLine1,
        addressLine2: row.addressLine2,
        addressLine3: row.addressLine3,
        addressLine4: row.addressLine4,
        billingBankAccountIban: row.billingBankAccountIban,
        billingBankAccountBic: row.billingBankAccountBic,
        billingBankAccountNo: row.billingBankAccountNo,
        billingBankAccountSortCode: row.billingBankAccountSortCode,
      }))}
      canManageSettings={canManageInvoiceSettings(sessionUser.role)}
    />
  )
}
