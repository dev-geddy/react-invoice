"use client"

import { useState } from "react"

import {
  RiDeleteBinLine,
  RiLayoutRightLine,
  RiLockLine,
  RiLockUnlockLine,
  RiMagicLine,
  RiPrinterLine,
  RiSaveLine,
} from "@remixicon/react"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@workspace/ui/components/alert-dialog"
import { Button } from "@workspace/ui/components/button"
import { Field, FieldLabel } from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import { Separator } from "@workspace/ui/components/separator"

import { PageHeading, SectionLabel } from "../../_components/page-heading"
import { getTotals, invoiceRef, money } from "../_lib/calc"
import type {
  Invoice,
  InvoiceDraft,
  InvoiceEntry,
  InvoiceMeta,
  InvoiceParty,
} from "../_lib/types"
import { EntryRows } from "./entry-rows"
import { PartyFields } from "./party-fields"

/**
 * The invoice form: provider and customer side by side, then the lines, then
 * the invoice meta — the reference app's order, rebuilt on the admin design
 * system. A locked invoice renders read-only until it is unlocked.
 *
 * @spec L2-INVOICE-09
 */
export function InvoiceEditor({
  draft,
  invoice,
  saving,
  onMetaChange,
  onPartyChange,
  onEntriesChange,
  onSave,
  onToggleLock,
  onDelete,
  onPrefillCustomer,
  onGenerateNumber,
  onPrint,
  previewOpen,
  onTogglePreview,
}: {
  draft: InvoiceDraft
  invoice: Invoice | null
  saving: boolean
  onMetaChange: (field: keyof InvoiceMeta, value: string) => void
  onPartyChange: (
    kind: "provider" | "customer",
    field: keyof InvoiceParty,
    value: string
  ) => void
  onEntriesChange: (entries: InvoiceEntry[]) => void
  onSave: () => void
  onToggleLock: () => void
  onDelete: () => void
  onPrefillCustomer: () => void
  onGenerateNumber: () => void
  onPrint: () => void
  previewOpen: boolean
  onTogglePreview: () => void
}) {
  const [confirmDelete, setConfirmDelete] = useState(false)

  const locked = invoice?.locked ?? false
  const readOnly = locked || (invoice != null && !invoice.canManage)
  const disabled = readOnly || saving
  const { net, vatAmount, gross } = getTotals(
    draft.entries,
    draft.provider,
    draft.meta.vatRate
  )

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-card p-5">
      <PageHeading
        title={
          invoice
            ? `Invoice ${invoiceRef(draft.meta.series, draft.meta.number)}`
            : "New invoice"
        }
        description={
          invoice
            ? `Created by ${invoice.ownerName || invoice.ownerEmail}${
                locked ? " · locked" : ""
              }`
            : "Provider details and numbering carry over from the last invoice."
        }
      />

      {/* Actions live on their own row: five buttons plus a long invoice
          title do not fit one line once the preview rail is open. */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
          {/* Preview is a rail on wide screens only, so is its toggle. */}
          <Button
            variant="outline"
            size="sm"
            className="hidden xl:inline-flex"
            aria-pressed={previewOpen}
            onClick={onTogglePreview}
          >
            <RiLayoutRightLine className="size-4" />
            {previewOpen ? "Hide preview" : "Show preview"}
          </Button>
          <Button variant="outline" size="sm" onClick={onPrint}>
            <RiPrinterLine className="size-4" />
            Print
          </Button>
          {invoice && invoice.canManage ? (
            <Button variant="outline" size="sm" onClick={onToggleLock}>
              {locked ? (
                <RiLockUnlockLine className="size-4" />
              ) : (
                <RiLockLine className="size-4" />
              )}
              {locked ? "Unlock" : "Lock"}
            </Button>
          ) : null}
          {invoice && invoice.canManage && !locked ? (
            <Button
              variant="outline"
              size="sm"
              className="text-destructive"
              onClick={() => setConfirmDelete(true)}
            >
              <RiDeleteBinLine className="size-4" />
              Delete
            </Button>
          ) : null}
          <Button size="sm" disabled={disabled} onClick={onSave}>
            <RiSaveLine className="size-4" />
            {saving ? "Saving…" : invoice ? "Save" : "Create invoice"}
          </Button>
      </div>

      {readOnly ? (
        <p className="mt-3 rounded-lg border bg-muted/60 px-3 py-2 text-[13px] text-muted-foreground">
          {locked
            ? "This invoice is locked. Unlock it to make changes."
            : "This invoice belongs to another user, so it is read-only for you."}
        </p>
      ) : null}

      <section className="mt-6 flex flex-col gap-3">
        <SectionLabel>Invoice meta</SectionLabel>
        <div className="flex flex-wrap gap-3">
          <Field className="w-[150px]">
            <FieldLabel htmlFor="invoiceDate" className="text-xs text-muted-foreground">
              Invoice date
            </FieldLabel>
            <Input
              id="invoiceDate"
              type="date"
              value={draft.meta.invoiceDate}
              disabled={disabled}
              onChange={(e) => onMetaChange("invoiceDate", e.target.value)}
            />
          </Field>
          <Field className="w-[110px]">
            <FieldLabel htmlFor="series" className="text-xs text-muted-foreground">
              Series
            </FieldLabel>
            <Input
              id="series"
              value={draft.meta.series}
              disabled={disabled}
              onChange={(e) => onMetaChange("series", e.target.value)}
            />
          </Field>
          <Field className="w-[130px]">
            <FieldLabel htmlFor="number" className="text-xs text-muted-foreground">
              Number
            </FieldLabel>
            <div className="flex items-center gap-1">
              <Input
                id="number"
                value={draft.meta.number}
                disabled={disabled}
                onChange={(e) => onMetaChange("number", e.target.value)}
              />
              <Button
                variant="ghost"
                size="icon"
                className="size-8 flex-none"
                aria-label="Generate next number in this series"
                disabled={disabled}
                onClick={onGenerateNumber}
              >
                <RiMagicLine className="size-4" />
              </Button>
            </div>
          </Field>
          <Field className="w-[100px]">
            <FieldLabel htmlFor="currency" className="text-xs text-muted-foreground">
              Currency
            </FieldLabel>
            <Input
              id="currency"
              value={draft.meta.currency}
              disabled={disabled}
              onChange={(e) => onMetaChange("currency", e.target.value)}
            />
          </Field>
          <Field className="w-[110px]">
            <FieldLabel htmlFor="vatRate" className="text-xs text-muted-foreground">
              VAT rate %
            </FieldLabel>
            <Input
              id="vatRate"
              inputMode="decimal"
              value={draft.meta.vatRate}
              disabled={disabled}
              onChange={(e) => onMetaChange("vatRate", e.target.value)}
            />
          </Field>
        </div>
        <p className="text-xs text-muted-foreground">
          VAT is charged only when the provider has a VAT registration number
          and the rate is above zero.
        </p>

        <div className="flex flex-wrap gap-3">
          <Field className="w-[220px]">
            <FieldLabel htmlFor="brandName" className="text-xs text-muted-foreground">
              Brand name part 1
            </FieldLabel>
            <Input
              id="brandName"
              value={draft.meta.brandName}
              disabled={disabled}
              onChange={(e) => onMetaChange("brandName", e.target.value)}
            />
          </Field>
          <Field className="w-[220px]">
            <FieldLabel htmlFor="brandSubName" className="text-xs text-muted-foreground">
              Brand name part 2
            </FieldLabel>
            <Input
              id="brandSubName"
              value={draft.meta.brandSubName}
              disabled={disabled}
              onChange={(e) => onMetaChange("brandSubName", e.target.value)}
            />
          </Field>
        </div>
      </section>
      <Separator className="my-6" />

      {/* Provider and customer always sit side by side, the way the reference
          app laid them out; the columns are capped narrow so the pair fits
          even when the preview rail is open. */}
      <div className="mt-5">
        <div className="grid grid-cols-2 gap-4">
        <section className="flex min-w-0 max-w-[14rem] flex-col gap-3">
          {/* Both headers are one fixed-height row — the customer side carries
              a button, and without a matching row the two field columns would
              start at different heights. */}
          <div className="sticky top-0 z-10 flex h-8 items-center justify-between gap-2 bg-card">
            <SectionLabel>Provider</SectionLabel>
          </div>
          <PartyFields
            party={draft.provider}
            idPrefix="provider"
            disabled={disabled}
            onChange={(field, value) =>
              onPartyChange("provider", field, value)
            }
          />
        </section>

        <section className="flex min-w-0 max-w-[14rem] flex-col gap-3">
          <div className="sticky top-0 z-10 flex h-8 items-center justify-between gap-2 bg-card">
            <SectionLabel>Customer</SectionLabel>
            <Button
              variant="ghost"
              size="sm"
              disabled={disabled}
              onClick={onPrefillCustomer}
            >
              <RiMagicLine className="size-4" />
              Prefill
            </Button>
          </div>
          <PartyFields
            party={draft.customer}
            idPrefix="customer"
            disabled={disabled}
            onChange={(field, value) =>
              onPartyChange("customer", field, value)
            }
          />
        </section>
        </div>
      </div>

      <Separator className="my-6" />

      <section className="flex flex-col gap-3">
        <SectionLabel>Works completed / services provided</SectionLabel>
        <EntryRows
          entries={draft.entries}
          disabled={disabled}
          onChange={(index, entry) => {
            const next = [...draft.entries]
            next[index] = entry
            onEntriesChange(next)
          }}
          onAdd={() =>
            onEntriesChange([
              ...draft.entries,
              {
                dateProvided:
                  draft.entries.at(-1)?.dateProvided ?? draft.meta.invoiceDate,
                description: "",
                qty: "1",
                qtyType: draft.entries.at(-1)?.qtyType ?? "h",
                rate: "0",
                total: "0",
              },
            ])
          }
          onRemove={(index) =>
            onEntriesChange(draft.entries.filter((_, i) => i !== index))
          }
        />
      </section>


      <Separator className="my-6" />

      <dl className="flex flex-wrap gap-8 text-sm">
        <div>
          <dt className="text-xs text-muted-foreground">Net</dt>
          <dd className="tabular-nums">
            {draft.meta.currency}
            {money(net)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">VAT</dt>
          <dd className="tabular-nums">
            {draft.meta.currency}
            {money(vatAmount)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Total payable</dt>
          <dd className="font-semibold tabular-nums">
            {draft.meta.currency}
            {money(gross)}
          </dd>
        </div>
      </dl>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete invoice {invoiceRef(draft.meta.series, draft.meta.number)}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This removes the invoice, its parties and all its lines. It can’t
              be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault()
                setConfirmDelete(false)
                onDelete()
              }}
            >
              Delete invoice
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
