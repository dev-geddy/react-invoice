"use client"

import { useState, useTransition } from "react"

import { RiAddLine, RiDeleteBinLine } from "@remixicon/react"
import { toast } from "sonner"

import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Separator } from "@workspace/ui/components/separator"

import { PageHeading, SectionLabel } from "../../../_components/page-heading"
import { PartyCard } from "../../_components/party-card"
import { PartyDialog } from "../../_components/party-dialog"
import { EMPTY_PARTY, type InvoiceParty } from "../../_lib/types"
import { deleteCustomer, saveCustomer } from "../_actions"

export type CustomerRow = {
  id: string
  party: InvoiceParty
  invoiceCount: number
}

type Editing = { id?: string; party: InvoiceParty } | null

/** Drop the usage count an adoption candidate carries for display. */
function toParty(candidate: InvoiceParty & { invoiceCount: number }) {
  const party: Record<string, string> = {}
  for (const key of Object.keys(EMPTY_PARTY) as (keyof InvoiceParty)[]) {
    party[key] = candidate[key]
  }
  return party as unknown as InvoiceParty
}

/**
 * The customer address book: saved customers as cards, edited through the same
 * party dialog the invoice form uses, plus one-click adoption of customers that
 * so far exist only inside past invoices.
 *
 * @spec L2-INVOICE-29
 */
export function CustomersView({
  customers,
  unsaved,
}: {
  customers: CustomerRow[]
  unsaved: (InvoiceParty & { invoiceCount: number })[]
}) {
  const [query, setQuery] = useState("")
  const [editing, setEditing] = useState<Editing>(null)
  const [pending, start] = useTransition()

  const q = query.trim().toLowerCase()
  const filtered = q
    ? customers.filter((row) =>
        [row.party.companyName, row.party.name, row.party.addressLine1]
          .join(" ")
          .toLowerCase()
          .includes(q)
      )
    : customers

  function save(party: InvoiceParty, id?: string) {
    start(async () => {
      const res = await saveCustomer({ id, ...party })
      if (res.ok) {
        toast.success(res.message)
        setEditing(null)
      } else {
        toast.error(res.message)
      }
    })
  }

  function remove(id: string) {
    start(async () => {
      const res = await deleteCustomer(id)
      if (res.ok) toast.success(res.message)
      else toast.error(res.message)
    })
  }

  return (
    <div className="mx-auto w-full max-w-5xl p-6">
      <PageHeading
        title="Customers"
        description="The address book invoices are raised against. Invoices keep their own copy, so edits here never change an issued invoice."
        action={
          <Button
            size="sm"
            disabled={pending}
            onClick={() => setEditing({ party: EMPTY_PARTY })}
          >
            <RiAddLine className="size-4" />
            Add customer
          </Button>
        }
      />

      <div className="mt-5 max-w-xs">
        <Input
          value={query}
          placeholder="Search customers"
          aria-label="Search customers"
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <section className="mt-5 flex flex-col gap-3">
        <SectionLabel>
          {customers.length} {customers.length === 1 ? "customer" : "customers"}
        </SectionLabel>

        {filtered.length === 0 ? (
          <p className="rounded-lg border bg-muted/50 px-3 py-2 text-[13px] text-muted-foreground">
            {customers.length === 0
              ? "No customers yet. Add one, or adopt a customer from an earlier invoice below."
              : "No customer matches that search."}
          </p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((row) => (
              <li key={row.id} className="flex flex-col gap-1">
                <PartyCard
                  party={row.party}
                  label="Customer"
                  readOnly={false}
                  onOpen={() => setEditing({ id: row.id, party: row.party })}
                />
                <div className="flex items-center justify-between px-1">
                  <span className="text-xs text-muted-foreground">
                    {row.invoiceCount}{" "}
                    {row.invoiceCount === 1 ? "invoice" : "invoices"}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 text-muted-foreground hover:text-destructive"
                    aria-label={`Remove ${row.party.companyName}`}
                    disabled={pending}
                    onClick={() => remove(row.id)}
                  >
                    <RiDeleteBinLine className="size-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {unsaved.length > 0 ? (
        <>
          <Separator className="my-6" />
          <section className="flex flex-col gap-3">
            <SectionLabel>Invoiced but not saved</SectionLabel>
            <div className="rounded-xl border border-dashed bg-muted/40 p-4">
              <p className="text-xs text-muted-foreground">
                These companies appear on invoices but are not in the address
                book yet. Adding one copies the details from its latest invoice.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {unsaved.map((party) => (
                  <Button
                    key={party.companyName}
                    variant="outline"
                    size="sm"
                    disabled={pending}
                    onClick={() => save(toParty(party))}
                  >
                    <RiAddLine className="size-4" />
                    {party.companyName}
                    <span className="text-muted-foreground">
                      ({party.invoiceCount})
                    </span>
                  </Button>
                ))}
              </div>
            </div>
          </section>
        </>
      ) : null}

      <PartyDialog
        open={editing != null}
        party={editing?.party ?? EMPTY_PARTY}
        label="Customer"
        idPrefix="customer"
        disabled={pending}
        onOpenChange={(open) => {
          if (!open) setEditing(null)
        }}
        onChange={(field, value) =>
          setEditing((current) =>
            current
              ? { ...current, party: { ...current.party, [field]: value } }
              : current
          )
        }
        onDone={() => {
          if (editing) save(editing.party, editing.id)
        }}
        doneLabel={editing?.id ? "Save customer" : "Add customer"}
      />
    </div>
  )
}
