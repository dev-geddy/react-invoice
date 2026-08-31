import { customers, db, invoiceParties, invoices } from "@workspace/db"
import { asc, eq } from "drizzle-orm"

import { requireCapability } from "@/app/_lib/auth/guard"
import { EMPTY_PARTY, type InvoiceParty } from "../_lib/types"
import { CustomersView } from "./_components/customers-view"

/**
 * /backflip/invoicing/customers — the customer address book. Saved customers
 * feed the invoice form's prefill; customers that only exist inside past
 * invoices are offered for adoption.
 *
 * @spec L2-INVOICE-29
 */
export default async function CustomersPage() {
  await requireCapability("invoices")

  const rows = await db
    .select()
    .from(customers)
    .orderBy(asc(customers.companyName))

  // Customer sides of every invoice, newest invoice first — the source both
  // for usage counts and for the adoption list.
  const invoiced = await db
    .select({
      companyName: invoiceParties.companyName,
      companyRegNo: invoiceParties.companyRegNo,
      companyVatNo: invoiceParties.companyVatNo,
      name: invoiceParties.name,
      role: invoiceParties.role,
      addressLine1: invoiceParties.addressLine1,
      addressLine2: invoiceParties.addressLine2,
      addressLine3: invoiceParties.addressLine3,
      addressLine4: invoiceParties.addressLine4,
      billingBankAccountIban: invoiceParties.billingBankAccountIban,
      billingBankAccountBic: invoiceParties.billingBankAccountBic,
      billingBankAccountNo: invoiceParties.billingBankAccountNo,
      billingBankAccountSortCode: invoiceParties.billingBankAccountSortCode,
      createdAt: invoices.createdAt,
    })
    .from(invoiceParties)
    .innerJoin(invoices, eq(invoices.id, invoiceParties.invoiceId))
    .where(eq(invoiceParties.kind, "customer"))

  const key = (value: string) => value.trim().toLowerCase()

  const invoiceCounts = new Map<string, number>()
  for (const row of invoiced) {
    if (!row.companyName.trim()) continue
    const k = key(row.companyName)
    invoiceCounts.set(k, (invoiceCounts.get(k) ?? 0) + 1)
  }

  const saved = new Set(rows.map((row) => key(row.companyName)))

  // One entry per unknown company, taking the details from its latest invoice.
  const unsavedByKey = new Map<string, InvoiceParty & { invoiceCount: number }>()
  for (const row of [...invoiced].sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
  )) {
    const k = key(row.companyName)
    if (!k || saved.has(k) || unsavedByKey.has(k)) continue
    unsavedByKey.set(k, {
      ...EMPTY_PARTY,
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
      invoiceCount: invoiceCounts.get(k) ?? 0,
    })
  }

  return (
    <CustomersView
      customers={rows.map((row) => ({
        id: row.id,
        party: {
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
        },
        invoiceCount: invoiceCounts.get(key(row.companyName)) ?? 0,
      }))}
      unsaved={[...unsavedByKey.values()]}
    />
  )
}
