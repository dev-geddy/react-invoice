import { notFound } from "next/navigation"

import { requireCapability } from "@/app/_lib/auth/guard"
import { canManageInvoiceSettings } from "@/app/_lib/auth/permissions"
import { InvoiceWorkspace } from "../_components/invoice-workspace"
import { loadEditorContext, loadInvoice } from "../_lib/queries"

/**
 * /backflip/invoicing/invoices/[id] — one invoice. Every signed-in user may read
 * it; whether they may write it back is decided per invoice (`canManage`).
 *
 * @spec L2-INVOICE-33
 */
export default async function InvoicePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const sessionUser = await requireCapability("invoices")
  const { id } = await params

  const [invoice, context] = await Promise.all([
    loadInvoice(id, sessionUser),
    loadEditorContext(),
  ])
  if (!invoice) notFound()

  return (
    <InvoiceWorkspace
      invoice={invoice}
      initialDraft={{
        meta: invoice.meta,
        provider: invoice.provider,
        customer: invoice.customer,
        entries: invoice.entries,
      }}
      series={context.series}
      savedCustomers={context.savedCustomers}
      numbersBySeries={context.numbersBySeries}
      canManageSettings={canManageInvoiceSettings(sessionUser.role)}
    />
  )
}
