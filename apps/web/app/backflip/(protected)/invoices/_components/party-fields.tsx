"use client"

import { Field, FieldLabel } from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"

import { SectionLabel } from "../../_components/page-heading"
import type { InvoiceParty } from "../_lib/types"

/**
 * The provider/customer detail form — the same 13 fields for both sides, in the
 * reference app's grouping (company / representative / address / billing). Each
 * group is its own hairline-separated column inside the dialog, so the whole
 * party is visible at once instead of scrolling past 13 stacked inputs.
 *
 * @spec L2-INVOICE-28
 */

const GROUPS: {
  label: string
  fields: { key: keyof InvoiceParty; label: string }[]
}[] = [
  {
    label: "Company details",
    fields: [
      { key: "companyName", label: "Company name" },
      { key: "companyRegNo", label: "Company reg. no." },
      { key: "companyVatNo", label: "VAT reg. no." },
    ],
  },
  {
    label: "Representative",
    fields: [
      { key: "name", label: "Name" },
      { key: "role", label: "Role" },
    ],
  },
  {
    label: "Address",
    fields: [
      { key: "addressLine1", label: "Address line 1" },
      { key: "addressLine2", label: "Address line 2" },
      { key: "addressLine3", label: "Address line 3" },
      { key: "addressLine4", label: "Address line 4" },
    ],
  },
  {
    label: "Billing",
    fields: [
      { key: "billingBankAccountBic", label: "BIC" },
      { key: "billingBankAccountIban", label: "IBAN" },
      { key: "billingBankAccountNo", label: "Account number" },
      { key: "billingBankAccountSortCode", label: "Sort code" },
    ],
  },
]

export function PartyFields({
  party,
  idPrefix,
  disabled,
  onChange,
}: {
  party: InvoiceParty
  idPrefix: string
  disabled: boolean
  onChange: (field: keyof InvoiceParty, value: string) => void
}) {
  return (
    // One column per group at dialog width, hairline-separated; stacked below.
    <div className="grid gap-y-5 sm:grid-cols-4 sm:gap-y-0 sm:divide-x sm:divide-border">
      {GROUPS.map((group) => (
        <div
          key={group.label}
          className="flex min-w-0 flex-col gap-2 sm:px-4 sm:first:pl-0 sm:last:pr-0"
        >
          <SectionLabel>{group.label}</SectionLabel>
          <div className="flex flex-col gap-2.5">
            {group.fields.map(({ key, label }) => (
              <Field key={key}>
                <FieldLabel
                  htmlFor={`${idPrefix}-${key}`}
                  className="text-xs text-muted-foreground"
                >
                  {label}
                </FieldLabel>
                <Input
                  id={`${idPrefix}-${key}`}
                  value={party[key]}
                  disabled={disabled}
                  onChange={(e) => onChange(key, e.target.value)}
                />
              </Field>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
