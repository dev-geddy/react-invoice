"use client"

import { RiEditLine } from "@remixicon/react"

import { cn } from "@workspace/ui/lib/utils"

import type { InvoiceParty } from "../_lib/types"

/**
 * A party as a summary card. The 13 fields live in a dialog (`PartyDialog`) —
 * the form column is narrow, and provider/customer details are set once and
 * then mostly read.
 *
 * @spec L2-INVOICE-28
 */
export function PartyCard({
  party,
  label,
  readOnly,
  onOpen,
}: {
  party: InvoiceParty
  label: string
  readOnly: boolean
  onOpen: () => void
}) {
  const address = [
    party.addressLine1,
    party.addressLine2,
    party.addressLine3,
    party.addressLine4,
  ]
    .filter(Boolean)
    .join(", ")
  const contact = [party.name, party.role].filter(Boolean).join(" — ")
  const empty = !party.companyName && !contact && !address

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`${readOnly ? "View" : "Edit"} ${label.toLowerCase()} details`}
      className={cn(
        "group w-full rounded-xl border bg-card p-3 text-left transition-colors",
        "hover:border-ring/60 hover:bg-accent/40",
        "focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:outline-none"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          {empty ? (
            <div className="text-[13px] font-medium text-muted-foreground">
              Add {label.toLowerCase()} details
            </div>
          ) : (
            <div className="text-[13px] font-semibold">
              {party.companyName || contact || "Unnamed"}
            </div>
          )}
        </div>
        <RiEditLine className="size-4 flex-none text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
      </div>

      {empty ? null : (
        <dl className="mt-1.5 flex flex-col gap-0.5 text-xs text-muted-foreground">
          {party.companyRegNo ? <dd>Reg. {party.companyRegNo}</dd> : null}
          {party.companyVatNo ? <dd>VAT {party.companyVatNo}</dd> : null}
          {contact && party.companyName ? <dd>{contact}</dd> : null}
          {address ? <dd className="line-clamp-2">{address}</dd> : null}
          {party.billingBankAccountIban ? (
            <dd className="truncate">IBAN {party.billingBankAccountIban}</dd>
          ) : null}
        </dl>
      )}
    </button>
  )
}
