"use client"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"

import type { InvoiceParty } from "../_lib/types"

/**
 * Pick a customer off a previous invoice. The candidate list is the distinct
 * set of customers across the whole ledger — most recently invoiced first,
 * limited to entries with enough detail to be worth copying.
 *
 * @spec L2-INVOICE-12
 */
export function PrefillCustomerDialog({
  open,
  customers,
  onOpenChange,
  onPick,
}: {
  open: boolean
  customers: InvoiceParty[]
  onOpenChange: (open: boolean) => void
  onPick: (customer: InvoiceParty) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Prefill customer</DialogTitle>
          <DialogDescription>
            Customers from earlier invoices that have a company name and an
            address.
          </DialogDescription>
        </DialogHeader>

        {customers.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No earlier customer has enough detail to copy yet.
          </p>
        ) : (
          <ul className="max-h-[50vh] overflow-y-auto">
            {customers.map((customer, index) => (
              <li key={`${customer.companyName}-${index}`}>
                <button
                  type="button"
                  className="w-full border-b px-2 py-2.5 text-left hover:bg-accent/50"
                  onClick={() => onPick(customer)}
                >
                  <span className="block text-[13px] font-medium">
                    {customer.companyName}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {[customer.addressLine1, customer.addressLine2]
                      .filter(Boolean)
                      .join(", ")}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  )
}
