"use client"

import { RiMagicLine } from "@remixicon/react"

import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"

import type { InvoiceParty } from "../_lib/types"
import { PartyFields } from "./party-fields"

/**
 * The full party form, in a dialog. `onPrefill` is passed for the customer
 * side only — the same shortcut the card header carries, within reach of the
 * fields it fills.
 *
 * @spec L2-INVOICE-28
 */
export function PartyDialog({
  open,
  party,
  label,
  idPrefix,
  disabled,
  onOpenChange,
  onChange,
  onPrefill,
}: {
  open: boolean
  party: InvoiceParty
  label: string
  idPrefix: string
  disabled: boolean
  onOpenChange: (open: boolean) => void
  onChange: (field: keyof InvoiceParty, value: string) => void
  onPrefill?: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{label} details</DialogTitle>
          <DialogDescription>
            {disabled
              ? "This invoice is read-only, so these details can't be changed."
              : "Company, representative, address and billing details printed on the invoice."}
          </DialogDescription>
        </DialogHeader>

        {onPrefill ? (
          <div>
            <Button
              variant="outline"
              size="sm"
              disabled={disabled}
              onClick={onPrefill}
            >
              <RiMagicLine className="size-4" />
              Prefill from an earlier invoice
            </Button>
          </div>
        ) : null}

        <PartyFields
          party={party}
          idPrefix={idPrefix}
          disabled={disabled}
          onChange={onChange}
        />

        <DialogFooter>
          <Button size="sm" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
