"use client"

import { RiAddBoxLine, RiDeleteBinLine } from "@remixicon/react"

import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"

import { recalcEntry } from "../../_lib/calc"
import type { InvoiceEntry } from "../../_lib/types"

/**
 * Line items. Editing qty or rate recomputes the line total; editing the total
 * back-solves the rate (`recalcEntry`), so an operator can work from either
 * end of the arithmetic.
 *
 * @spec L2-INVOICE-10
 */
/**
 * One width per column, shared by the header and the inputs — the two must use
 * the *same* flex basis or the header drifts out of alignment once flex
 * distributes the leftover space.
 */
const COL = {
  date: "w-[124px] flex-none",
  description: "min-w-[100px] flex-1 basis-[120px]",
  qty: "w-[52px] flex-none",
  unit: "w-[48px] flex-none",
  rate: "w-[68px] flex-none",
  total: "w-[80px] flex-none",
  remove: "size-8 flex-none",
}

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
      <div className="hidden gap-2 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase @lg:flex">
        <span className={COL.date}>Date</span>
        <span className={COL.description}>Description</span>
        <span className={COL.qty}>Qty</span>
        <span className={COL.unit}>Unit</span>
        <span className={COL.rate}>Rate</span>
        <span className={COL.total}>Total</span>
        <span className={COL.remove} />
      </div>

      {entries.map((entry, index) => (
        <div
          key={index}
          className="flex flex-wrap items-center gap-2 border-b pb-2 last:border-b-0 @lg:flex-nowrap @lg:border-b-0 @lg:pb-0"
        >
          <Input
            aria-label="Date provided"
            type="date"
            className={COL.date}
            value={entry.dateProvided}
            disabled={disabled}
            onChange={(e) => update(index, entry, "dateProvided", e.target.value)}
          />
          <Input
            aria-label="Description"
            placeholder="Description"
            className={COL.description}
            value={entry.description}
            disabled={disabled}
            onChange={(e) => update(index, entry, "description", e.target.value)}
          />
          <Input
            aria-label="Quantity"
            placeholder="Qty"
            inputMode="decimal"
            className={COL.qty}
            value={entry.qty}
            disabled={disabled}
            onChange={(e) => update(index, entry, "qty", e.target.value)}
          />
          <Input
            aria-label="Unit"
            placeholder="Unit"
            className={COL.unit}
            value={entry.qtyType}
            disabled={disabled}
            onChange={(e) => update(index, entry, "qtyType", e.target.value)}
          />
          <Input
            aria-label="Rate"
            placeholder="Rate"
            inputMode="decimal"
            className={COL.rate}
            value={entry.rate}
            disabled={disabled}
            onChange={(e) => update(index, entry, "rate", e.target.value)}
          />
          <Input
            aria-label="Line total"
            placeholder="Total"
            inputMode="decimal"
            className={COL.total}
            value={entry.total}
            disabled={disabled}
            onChange={(e) => update(index, entry, "total", e.target.value)}
          />
          <Button
            variant="ghost"
            size="icon"
            className={`${COL.remove} text-muted-foreground hover:text-destructive`}
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
