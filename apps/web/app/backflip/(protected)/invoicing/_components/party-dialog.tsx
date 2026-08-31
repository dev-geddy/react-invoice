"use client"

import { RiMagicLine } from "@remixicon/react"

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@workspace/ui/components/tooltip"

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
  onDone,
  doneLabel = "Done",
}: {
  open: boolean
  party: InvoiceParty
  label: string
  idPrefix: string
  disabled: boolean
  onOpenChange: (open: boolean) => void
  onChange: (field: keyof InvoiceParty, value: string) => void
  onPrefill?: () => void
  /** Called instead of a plain close — the address book saves on confirm. */
  onDone?: () => void
  doneLabel?: string
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent // The base dialog caps at `sm:max-w-sm`; a two-column party form needs the
      // wider ceiling, and the override has to match that breakpoint variant.
      className="max-h-[85vh] overflow-y-auto sm:max-w-4xl">
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
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={disabled}
                    onClick={onPrefill}
                  >
                    <RiMagicLine className="size-4" />
                    Prefill from an earlier invoice
                  </Button>
                }
              />
              <TooltipContent>
                Replaces every field below with the chosen customer's details
              </TooltipContent>
            </Tooltip>
          </div>
        ) : null}

        <PartyFields
          party={party}
          idPrefix={idPrefix}
          disabled={disabled}
          onChange={onChange}
        />

        <DialogFooter>
          <Button
            size="sm"
            disabled={disabled}
            onClick={() => (onDone ? onDone() : onOpenChange(false))}
          >
            {doneLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
