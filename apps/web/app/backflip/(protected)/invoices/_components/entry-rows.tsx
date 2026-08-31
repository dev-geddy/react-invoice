"use client"

import { RiAddBoxLine, RiDeleteBinLine } from "@remixicon/react"

import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"

import { recalcEntry } from "../_lib/calc"
import type { InvoiceEntry } from "../_lib/types"

/**
 * Line items. Editing qty or rate recomputes the line total; editing the total
 * back-solves the rate (`recalcEntry`), so an operator can work from either
 * end of the arithmetic.
 *
 * @spec L2-INVOICE-10
 */
export function EntryRows({
  entries,
  disabled,
  onChange,
  onAdd,
  onRemove,
}: {
  entries: InvoiceEntry[]
  disabled: boolean
  onChange: (index: number, entry: InvoiceEntry) => void
  onAdd: () => void
  onRemove: (index: number) => void
}) {
  function update(index: number, entry: InvoiceEntry, field: string, value: string) {
    if (field === "qty" || field === "rate" || field === "total") {
      onChange(index, recalcEntry(entry, field, value))
    } else {
      onChange(index, { ...entry, [field]: value })
    }
  }

  return (
    <div className="@container flex flex-col gap-2">
      {/* The header only lines up while the row is on one line — below that
          width the row wraps and each field carries its own aria-label. */}
      <div className="hidden gap-2 px-1 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase @2xl:flex">
        <span className="w-[120px] flex-none">Date</span>
        <span className="flex-1">Description</span>
        <span className="w-[56px] flex-none">Qty</span>
        <span className="w-[56px] flex-none">Unit</span>
        <span className="w-[72px] flex-none">Rate</span>
        <span className="w-[84px] flex-none">Total</span>
        <span className="w-8 flex-none" />
      </div>

      {entries.map((entry, index) => (
        <div
          key={index}
          className="flex flex-wrap items-center gap-2 border-b pb-2 last:border-b-0 @2xl:flex-nowrap @2xl:border-b-0 @2xl:pb-0"
        >
          <Input
            aria-label="Date provided"
            type="date"
            className="w-[120px] flex-none"
            value={entry.dateProvided}
            disabled={disabled}
            onChange={(e) => update(index, entry, "dateProvided", e.target.value)}
          />
          <Input
            aria-label="Description"
            placeholder="Description"
            className="min-w-[120px] flex-1 basis-[160px]"
            value={entry.description}
            disabled={disabled}
            onChange={(e) => update(index, entry, "description", e.target.value)}
          />
          <Input
            aria-label="Quantity"
            placeholder="Qty"
            inputMode="decimal"
            className="w-[56px] flex-none"
            value={entry.qty}
            disabled={disabled}
            onChange={(e) => update(index, entry, "qty", e.target.value)}
          />
          <Input
            aria-label="Unit"
            placeholder="Unit"
            className="w-[56px] flex-none"
            value={entry.qtyType}
            disabled={disabled}
            onChange={(e) => update(index, entry, "qtyType", e.target.value)}
          />
          <Input
            aria-label="Rate"
            placeholder="Rate"
            inputMode="decimal"
            className="w-[72px] flex-none"
            value={entry.rate}
            disabled={disabled}
            onChange={(e) => update(index, entry, "rate", e.target.value)}
          />
          <Input
            aria-label="Line total"
            placeholder="Total"
            inputMode="decimal"
            className="w-[84px] flex-none"
            value={entry.total}
            disabled={disabled}
            onChange={(e) => update(index, entry, "total", e.target.value)}
          />
          <Button
            variant="ghost"
            size="icon"
            className="size-8 flex-none text-muted-foreground hover:text-destructive"
            aria-label={`Remove line ${index + 1}`}
            disabled={disabled}
            onClick={() => onRemove(index)}
          >
            <RiDeleteBinLine className="size-4" />
          </Button>
        </div>
      ))}

      <div>
        <Button variant="outline" size="sm" disabled={disabled} onClick={onAdd}>
          <RiAddBoxLine className="size-4" />
          Add line
        </Button>
      </div>
    </div>
  )
}
