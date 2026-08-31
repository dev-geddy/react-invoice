import { requireCapability } from "@/app/_lib/auth/guard"
import { canManageInvoiceSettings } from "@/app/_lib/auth/permissions"
import { InvoiceWorkspace } from "../_components/invoice-workspace"
import { loadEditorContext, loadNewInvoiceDraft } from "../_lib/queries"

/**
 * /backflip/invoicing/invoices/new — a draft that has never been saved. Provider
 * details, currency and VAT carry over from the most recent invoice; the series
 * and its next free number come from the configured series.
 *
 * @spec L2-INVOICE-33
 */
export default async function NewInvoicePage() {
  const sessionUser = await requireCapability("invoices")

  const context = await loadEditorContext()
  const draft = await loadNewInvoiceDraft(context)

  return (
    <InvoiceWorkspace
      invoice={null}
      initialDraft={draft}
      series={context.series}
      savedCustomers={context.savedCustomers}
      numbersBySeries={context.numbersBySeries}
      canManageSettings={canManageInvoiceSettings(sessionUser.role)}
    />
  )
}
