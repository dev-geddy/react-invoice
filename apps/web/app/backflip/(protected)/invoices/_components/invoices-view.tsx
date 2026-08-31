"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"

import { toast } from "sonner"

import { deleteInvoice, saveInvoice, setInvoiceLock } from "../_actions"
import { invoiceTitle, nextNumber, today } from "../_lib/calc"
import {
  EMPTY_PARTY,
  type Invoice,
  type InvoiceDraft,
  type InvoiceEntry,
  type InvoiceMeta,
  type InvoiceParty,
} from "../_lib/types"
import { InvoiceEditor } from "./invoice-editor"
import { InvoiceList } from "./invoice-list"
import { InvoicePreview } from "./invoice-preview"
import { PrefillCustomerDialog } from "./prefill-customer-dialog"

/**
 * Invoices shell — ledger list, editor, live preview. The draft lives here so
 * the preview repaints on every keystroke, the way the reference app's
 * side-by-side view did.
 *
 * @spec L2-INVOICE-08
 */
export function InvoicesView({ invoices }: { invoices: Invoice[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [query, setQuery] = useState("")
  // A just-saved invoice is selected before `router.refresh()` has delivered
  // it, so the remounted workspace would find no row to seed from. Carry the
  // submitted draft across that gap.
  const [saved, setSaved] = useState<{
    id: string
    draft: InvoiceDraft
  } | null>(null)

  const selected = invoices.find((i) => i.id === selectedId) ?? null

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return invoices
    return invoices.filter((invoice) =>
      [
        invoice.meta.series + invoice.meta.number,
        invoice.customer.companyName,
        invoice.customer.name,
        invoice.ownerName ?? "",
        invoice.ownerEmail,
      ]
        .join(" ")
        .toLowerCase()
        .includes(q)
    )
  }, [invoices, query])

  return (
    <div className="flex h-full min-h-0 bg-card">
      <div className="hidden min-h-0 w-[300px] flex-none flex-col overflow-hidden border-r bg-background lg:flex">
        <InvoiceList
          invoices={filtered}
          selectedId={selectedId}
          query={query}
          creating={selected == null}
          onQueryChange={setQuery}
          onSelect={setSelectedId}
          onNew={() => setSelectedId(null)}
        />
      </div>

      {/* Keyed on the selection: switching invoices remounts the workspace, so
          the draft is re-seeded from the freshly selected row rather than
          patched in an effect. */}
      <InvoiceWorkspace
        key={selectedId ?? "new"}
        invoices={invoices}
        selected={selected}
        seedDraft={saved?.id === selectedId ? saved.draft : null}
        onSaved={(id, draft) => {
          setSaved({ id, draft })
          setSelectedId(id)
        }}
        onSelect={setSelectedId}
      />
    </div>
  )
}

/** The editing surface for one invoice (or one unsaved draft). */
function InvoiceWorkspace({
  invoices,
  selected,
  seedDraft,
  onSaved,
  onSelect,
}: {
  invoices: Invoice[]
  selected: Invoice | null
  seedDraft: InvoiceDraft | null
  onSaved: (id: string, draft: InvoiceDraft) => void
  onSelect: (id: string | null) => void
}) {
  const router = useRouter()
  const [prefillOpen, setPrefillOpen] = useState(false)
  const [saving, startSave] = useTransition()
  const [draft, setDraft] = useState<InvoiceDraft>(
    () =>
      (selected
        ? {
            meta: selected.meta,
            provider: selected.provider,
            customer: selected.customer,
            entries: selected.entries,
          }
        : seedDraft) ?? blankDraft(invoices)
  )

  // Browsers name a printed PDF after the document title (L2-INVOICE-11).
  useEffect(() => {
    const previous = document.title
    document.title = invoiceTitle(draft)
    return () => {
      document.title = previous
    }
  }, [draft])

  /** Distinct customers across the ledger, most recently invoiced first. */
  const pastCustomers = useMemo(() => {
    const seen = new Set<string>()
    const out: InvoiceParty[] = []
    for (const invoice of invoices) {
      const c = invoice.customer
      const key = c.companyName.trim().toLowerCase()
      if (!key || !c.addressLine1.trim() || seen.has(key)) continue
      seen.add(key)
      out.push(c)
    }
    return out
  }, [invoices])

  function updateMeta(field: keyof InvoiceMeta, value: string) {
    setDraft((d) => ({ ...d, meta: { ...d.meta, [field]: value } }))
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
    const series = draft.meta.series.trim()
    const used = invoices
      .filter((i) => i.meta.series.trim() === series && i.id !== selected?.id)
      .map((i) => i.meta.number)
    updateMeta("number", nextNumber(used))
  }

  function handleSave() {
    startSave(async () => {
      const res = await saveInvoice({ id: selected?.id, ...draft })
      if (res.ok) {
        toast.success(res.message)
        router.refresh()
        onSaved(res.id, draft)
      } else {
        toast.error(res.message)
      }
    })
  }

  function handleToggleLock() {
    if (!selected) return
    startSave(async () => {
      const res = await setInvoiceLock(selected.id, !selected.locked)
      if (res.ok) toast.success(res.message)
      else toast.error(res.message)
      router.refresh()
    })
  }

  function handleDelete() {
    if (!selected) return
    startSave(async () => {
      const res = await deleteInvoice(selected.id)
      if (res.ok) {
        toast.success(res.message)
        router.refresh()
        onSelect(null)
      } else {
        toast.error(res.message)
      }
    })
  }

  return (
    <>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <InvoiceEditor
          draft={draft}
          invoice={selected}
          saving={saving}
          onMetaChange={updateMeta}
          onPartyChange={updateParty}
          onEntriesChange={updateEntries}
          onSave={handleSave}
          onToggleLock={handleToggleLock}
          onDelete={handleDelete}
          onPrefillCustomer={() => setPrefillOpen(true)}
          onGenerateNumber={generateNumber}
          onPrint={() => window.print()}
        />
      </div>

      {/* The document is laid out at its real width (820px) and zoomed down to
          fit the rail; `zoom` reflows, so nothing is clipped. Print resets it
          (see the preview's print stylesheet). */}
      <div className="hidden min-h-0 w-[500px] flex-none overflow-y-auto border-l bg-muted/50 p-4 xl:block">
        <div className="invoice-preview-scale" style={{ zoom: 0.56 }}>
          <InvoicePreview draft={draft} />
        </div>
      </div>

      <PrefillCustomerDialog
        open={prefillOpen}
        customers={pastCustomers}
        onOpenChange={setPrefillOpen}
        onPick={(customer) => {
          setDraft((d) => ({ ...d, customer }))
          setPrefillOpen(false)
        }}
      />
    </>
  )
}

/**
 * A fresh invoice, seeded from the most recent one: provider details, series,
 * currency, VAT rate and branding carry over (they change rarely), the date
 * resets to today and the number advances within the series.
 */
function blankDraft(invoices: Invoice[]): InvoiceDraft {
  const last = invoices[0]
  const series = last?.meta.series ?? ""
  const used = invoices
    .filter((i) => i.meta.series.trim() === series.trim())
    .map((i) => i.meta.number)

  return {
    meta: {
      invoiceDate: today(),
      series,
      number: nextNumber(used),
      currency: last?.meta.currency ?? "€",
      vatRate: last?.meta.vatRate ?? "0",
      brandName: last?.meta.brandName ?? "",
      brandSubName: last?.meta.brandSubName ?? "",
    },
    provider: last?.provider ?? EMPTY_PARTY,
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
