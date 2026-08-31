"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"

import { RiFilePdf2Line, RiPrinterLine } from "@remixicon/react"
import { toast } from "sonner"

import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"

import { deleteInvoice, saveInvoice, setInvoiceLock } from "../_actions"
import { invoiceTitle, nextNumber, pdfFilename } from "../../_lib/calc"
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
  const [downloadingPdf, setDownloadingPdf] = useState(false)

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

  /**
   * Downloads the invoice as a PDF. The *draft* is posted rather than an id, so
   * the file matches the preview on screen even before the invoice is saved;
   * the server renders it and never stores anything (`L2-INVOICE-39`).
   */
  async function handleDownloadPdf() {
    if (downloadingPdf) return
    setDownloadingPdf(true)
    try {
      const res = await fetch("/api/backflip/invoices/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      })
      if (!res.ok) throw new Error("pdf")

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = pdfFilename(draft)
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    } catch {
      toast.error("Could not generate the PDF.")
    } finally {
      setDownloadingPdf(false)
    }
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
          onDownloadPdf={handleDownloadPdf}
          downloadingPdf={downloadingPdf}
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
            {/* The same two actions above and below the sheet: whichever end of
                a long invoice the reader is at, the buttons are in reach
                without going back to the form's toolbar. */}
            <PreviewActions
              onPrint={() => window.print()}
              onDownloadPdf={handleDownloadPdf}
              downloadingPdf={downloadingPdf}
              className="mb-4"
            />
            <InvoicePreview draft={draft} />
            <PreviewActions
              onPrint={() => window.print()}
              onDownloadPdf={handleDownloadPdf}
              downloadingPdf={downloadingPdf}
              className="mt-4"
            />
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

/**
 * Both floating buttons carry the same lighting. On the light canvas an inset
 * white glow lifts them off the vignette; in dark mode they sit a shade lighter
 * than the surface and take an inset dark shadow instead, since a white glow
 * there would read as a blown-out edge.
 */
const FLOATING = cn(
  "backdrop-blur-sm",
  "bg-background/75 hover:bg-background",
  "shadow-[inset_0_1px_0_rgb(255_255_255/0.95),inset_0_0_12px_rgb(255_255_255/0.7),0_1px_2px_rgb(0_0_0/0.12)]",
  "dark:bg-foreground/15 dark:hover:bg-foreground/25",
  "dark:shadow-[inset_0_1px_0_rgb(255_255_255/0.08),inset_0_0_12px_rgb(0_0_0/0.55),0_1px_2px_rgb(0_0_0/0.45)]"
)

/**
 * Print / download, floating on the preview canvas. Deliberately translucent
 * rather than solid chrome — they sit on the vignette beside the paper, not on
 * a panel of their own — and they are hidden from the printed page by the
 * preview's own print rules (only the portalled document survives).
 */
function PreviewActions({
  onPrint,
  onDownloadPdf,
  downloadingPdf,
  className,
}: {
  onPrint: () => void
  onDownloadPdf: () => void
  downloadingPdf: boolean
  className?: string
}) {
  return (
    <div className={cn("flex justify-center gap-2", className)}>
      <Button
        variant="secondary"
        size="sm"
        className={FLOATING}
        onClick={onDownloadPdf}
        disabled={downloadingPdf}
      >
        <RiFilePdf2Line className="size-4" />
        {/* `leading-none` on the label: the button centres line boxes, and this
            face's line box is taller below the glyphs than above, so a label
            carrying its full leading sits a fraction low against the icon. */}
        <span className="leading-none">
          {downloadingPdf ? "Preparing…" : "Download PDF"}
        </span>
      </Button>
      <Button
        variant="secondary"
        size="sm"
        className={FLOATING}
        onClick={onPrint}
      >
        <RiPrinterLine className="size-4" />
        <span className="leading-none">Print</span>
      </Button>
    </div>
  )
}
