"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"

import { toast } from "sonner"

import { cn } from "@workspace/ui/lib/utils"

import { deleteInvoice, saveInvoice, setInvoiceLock } from "../_actions"
import { invoiceTitle, nextNumber } from "../../_lib/calc"
import type {
  Invoice,
  InvoiceDraft,
  InvoiceEntry,
  InvoiceMeta,
  InvoiceParty,
  InvoiceSeriesOption,
} from "../../_lib/types"
import { InvoiceEditor } from "./invoice-editor"
import { InvoicePreview } from "./invoice-preview"
import { PrefillCustomerDialog } from "./prefill-customer-dialog"

export const LEDGER_PATH = "/backflip/invoicing/invoices"

/**
 * One invoice: form on the left, live preview on the right. Used by both the
 * new-invoice page and an existing invoice's page — the ledger list is its own
 * route now, so this surface only ever holds one document.
 *
 * @spec L2-INVOICE-33
 */
export function InvoiceWorkspace({
  invoice,
  initialDraft,
  series,
  savedCustomers,
  numbersBySeries,
  canManageSettings,
}: {
  /** `null` while the draft has never been saved. */
  invoice: Invoice | null
  initialDraft: InvoiceDraft
  series: InvoiceSeriesOption[]
  savedCustomers: InvoiceParty[]
  numbersBySeries: Record<string, string[]>
  canManageSettings: boolean
}) {
  const router = useRouter()
  const [draft, setDraft] = useState<InvoiceDraft>(initialDraft)
  const [prefillOpen, setPrefillOpen] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(true)
  const [saving, startSave] = useTransition()

  // Browsers name a printed PDF after the document title (L2-INVOICE-11).
  useEffect(() => {
    const previous = document.title
    document.title = invoiceTitle(draft)
    return () => {
      document.title = previous
    }
  }, [draft])

  /**
   * Prefill candidates: the saved address book first, then any customer that
   * only exists on a past invoice.
   */
  const prefillCustomers = useMemo(() => {
    const seen = new Set<string>()
    const out: InvoiceParty[] = []
    for (const customer of savedCustomers) {
      const key = customer.companyName.trim().toLowerCase()
      if (!key || seen.has(key)) continue
      seen.add(key)
      out.push(customer)
    }
    return out
  }, [savedCustomers])

  function updateMeta(field: keyof InvoiceMeta, value: string) {
    setDraft((d) => ({ ...d, meta: { ...d.meta, [field]: value } }))
  }

  /**
   * Picking a series stamps its branding and default currency onto the draft;
   * the invoice keeps its own copy, so later edits to the series definition
   * leave issued invoices untouched.
   */
  function selectSeries(code: string) {
    const picked = series.find((option) => option.code === code)
    setDraft((d) => ({
      ...d,
      meta: {
        ...d.meta,
        series: code,
        currency: picked?.currency ?? d.meta.currency,
        brandName: picked?.brandName ?? d.meta.brandName,
        brandSubName: picked?.brandSubName ?? d.meta.brandSubName,
      },
    }))
  }

  function updateParty(
    kind: "provider" | "customer",
    field: keyof InvoiceParty,
    value: string
  ) {
    setDraft((d) => ({ ...d, [kind]: { ...d[kind], [field]: value } }))
  }

  function updateEntries(entries: InvoiceEntry[]) {
    setDraft((d) => ({ ...d, entries }))
  }

  function generateNumber() {
    const code = draft.meta.series.trim()
    const used = (numbersBySeries[code] ?? []).filter(
      (number) => invoice == null || number !== invoice.meta.number
    )
    updateMeta("number", nextNumber(used))
  }

  function handleSave() {
    startSave(async () => {
      const res = await saveInvoice({ id: invoice?.id, ...draft })
      if (!res.ok) {
        toast.error(res.message)
        return
      }
      toast.success(res.message)
      // A new invoice gets its own address; an existing one just reloads.
      if (invoice) router.refresh()
      else router.replace(`${LEDGER_PATH}/${res.id}`)
    })
  }

  function handleToggleLock() {
    if (!invoice) return
    startSave(async () => {
      const res = await setInvoiceLock(invoice.id, !invoice.locked)
      if (res.ok) toast.success(res.message)
      else toast.error(res.message)
      router.refresh()
    })
  }

  function handleDelete() {
    if (!invoice) return
    startSave(async () => {
      const res = await deleteInvoice(invoice.id)
      if (!res.ok) {
        toast.error(res.message)
        return
      }
      toast.success(res.message)
      router.push(LEDGER_PATH)
    })
  }

  return (
    <div className="flex h-[calc(100svh-var(--header-height,3.5rem))] min-h-0 bg-card">
      {/* Form and preview share the row evenly; hiding the preview hands the
          whole width to the form. */}
      <div
        className={cn(
          "flex min-h-0 min-w-0 flex-1 flex-col",
          previewOpen && "xl:basis-0"
        )}
      >
        <InvoiceEditor
          draft={draft}
          invoice={invoice}
          series={series}
          canManageSettings={canManageSettings}
          saving={saving}
          onMetaChange={updateMeta}
          onSeriesChange={selectSeries}
          onPartyChange={updateParty}
          onEntriesChange={updateEntries}
          onSave={handleSave}
          onToggleLock={handleToggleLock}
          onDelete={handleDelete}
          onPrefillCustomer={() => setPrefillOpen(true)}
          onGenerateNumber={generateNumber}
          onPrint={() => window.print()}
          previewOpen={previewOpen}
          onTogglePreview={() => setPreviewOpen((open) => !open)}
        />
      </div>

      <div
        className={cn(
          "hidden min-h-0 flex-1 basis-0 overflow-y-auto border-l p-6",
          "min-w-[380px]",
          // Darker, vignetted canvas so the sheet reads as paper resting on a
          // surface rather than as another panel of the admin chrome.
          "bg-[radial-gradient(ellipse_at_50%_30%,var(--muted)_0%,color-mix(in_oklab,var(--muted)_80%,black)_55%,color-mix(in_oklab,var(--muted)_58%,black)_100%)]",
          previewOpen && "xl:block"
        )}
      >
        {/* `my-auto` inside a min-h-full column centres a short invoice and
            stops centring once the document outgrows the rail — margin centring
            never crops the top edge the way `items-center` does. */}
        <div className="flex min-h-full flex-col">
          <div className="my-auto w-full">
            <InvoicePreview draft={draft} />
          </div>
        </div>
      </div>

      <PrefillCustomerDialog
        open={prefillOpen}
        customers={prefillCustomers}
        onOpenChange={setPrefillOpen}
        onPick={(customer) => {
          setDraft((d) => ({ ...d, customer }))
          setPrefillOpen(false)
        }}
      />
    </div>
  )
}
