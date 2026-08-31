"use client"

import { RiAddBoxLine, RiFileList3Line, RiLockLine } from "@remixicon/react"

import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { cn } from "@workspace/ui/lib/utils"

import { formatDate, getTotals, invoiceRef, money } from "../_lib/calc"
import type { Invoice } from "../_lib/types"

/**
 * Ledger column: every invoice on the platform, newest first, with a search
 * over customer, reference and owner.
 *
 * @spec L2-INVOICE-08
 */
export function InvoiceList({
  invoices,
  selectedId,
  query,
  onQueryChange,
  onSelect,
  onNew,
}: {
  invoices: Invoice[]
  selectedId: string | null
  query: string
  onQueryChange: (value: string) => void
  onSelect: (id: string) => void
  onNew: () => void
}) {
  return (
    <div className="flex min-h-0 flex-col">
      <div className="flex flex-col gap-2.5 border-b p-3">
        <Button size="sm" onClick={onNew}>
          <RiAddBoxLine className="size-4" />
          New invoice
        </Button>
        <Input
          value={query}
          placeholder="Search invoices"
          aria-label="Search invoices"
          onChange={(e) => onQueryChange(e.target.value)}
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {invoices.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">
            No invoices yet. Create the first one.
          </p>
        ) : null}

        <ul>
          {invoices.map((invoice) => {
            const { gross } = getTotals(
              invoice.entries,
              invoice.provider,
              invoice.meta.vatRate
            )
            const active = invoice.id === selectedId

            return (
              <li key={invoice.id}>
                <button
                  type="button"
                  onClick={() => onSelect(invoice.id)}
                  className={cn(
                    "flex w-full items-start gap-2.5 border-b px-3 py-2.5 text-left hover:bg-accent/50",
                    active && "bg-accent"
                  )}
                >
                  <RiFileList3Line className="mt-0.5 size-4 flex-none text-muted-foreground" />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5 text-[13px] font-medium">
                      {invoiceRef(invoice.meta.series, invoice.meta.number)}
                      {invoice.locked ? (
                        <RiLockLine
                          className="size-3.5 text-muted-foreground"
                          aria-label="Locked"
                        />
                      ) : null}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {formatDate(invoice.meta.invoiceDate)} ·{" "}
                      {invoice.customer.companyName || "No customer"}
                    </span>
                    <span className="block truncate text-[11px] text-muted-foreground/80">
                      {invoice.meta.currency}
                      {money(gross)} · {invoice.ownerName || invoice.ownerEmail}
                    </span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
