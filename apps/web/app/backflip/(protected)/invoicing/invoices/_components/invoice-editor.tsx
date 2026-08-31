"use client"

import { useState } from "react"

import Link from "next/link"

import {
  RiDeleteBinLine,
  RiLayoutRightLine,
  RiLockLine,
  RiLockUnlockLine,
  RiMagicLine,
  RiPrinterLine,
  RiSaveLine,
  RiDraftLine,
  RiSettings3Line,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { Separator } from "@workspace/ui/components/separator"

import { PageHeading, SectionLabel } from "../../../_components/page-heading"
import { getTotals, invoiceRef, money } from "../../_lib/calc"
import type {
  Invoice,
  InvoiceDraft,
  InvoiceEntry,
  InvoiceMeta,
  InvoiceParty,
  InvoiceSeriesOption,
} from "../../_lib/types"
import { EntryRows } from "./entry-rows"
import { PartyCard } from "../../_components/party-card"
import { PartyDialog } from "../../_components/party-dialog"

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
  series,
  canManageSettings,
  saving,
  onMetaChange,
  onSeriesChange,
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
  series: InvoiceSeriesOption[]
  canManageSettings: boolean
  saving: boolean
  onMetaChange: (field: keyof InvoiceMeta, value: string) => void
  onSeriesChange: (code: string) => void
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
  const [openParty, setOpenParty] = useState<"provider" | "customer" | null>(
    null
  )

  const locked = invoice?.locked ?? false
  const readOnly = locked || (invoice != null && !invoice.canManage)
  const disabled = readOnly || saving
  // The saved series may no longer be configured; keep it selectable so the
  // form never silently reassigns an issued invoice.
  const seriesCodes = Array.from(
    new Set(
      [...series.map((s) => s.code), draft.meta.series].filter(
        (code) => code.length > 0
      )
    )
  )
  const { net, vatAmount, gross } = getTotals(
    draft.entries,
    draft.provider,
    draft.meta.vatRate
  )

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-card px-5 pb-5">
      {/* The top padding belongs to the content, not the scroll container: a
          padded scrollport leaves a transparent strip that `sticky top-0`
          headers cannot cover, and rows scroll through it. */}
      <div className="pt-5" />

      {/* An unsaved draft is nowhere in the ledger yet, so it says so here
          rather than occupying a phantom row in the list. */}
      {invoice == null ? (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-400 bg-amber-50 px-3 py-2 dark:border-amber-700 dark:bg-amber-950/40">
          <RiDraftLine className="mt-0.5 size-4 flex-none text-amber-700 dark:text-amber-300" />
          <p className="text-xs text-amber-800 dark:text-amber-300">
            <strong className="font-semibold">New invoice — not saved.</strong>{" "}
            It joins the ledger once you create it.
          </p>
        </div>
      ) : null}

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
          {canManageSettings ? (
            <Button
              variant="outline"
              size="sm"
              render={<Link href="/backflip/invoicing/settings" />}
            >
              <RiSettings3Line className="size-4" />
              Series & currency
            </Button>
          ) : null}
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
          <Field className="w-[150px]">
            <FieldLabel
              htmlFor="series"
              className="text-xs text-muted-foreground"
            >
              Series
            </FieldLabel>
            {/* A series the operator has since removed still appears here, so
                an issued invoice keeps reading as what it was raised under. */}
            <Select
              value={draft.meta.series}
              disabled={disabled || seriesCodes.length === 0}
              onValueChange={(value) => onSeriesChange(value ?? "")}
            >
              <SelectTrigger
                id="series"
                aria-label="Series"
                className="w-full"
              >
                <SelectValue placeholder="No series yet" />
              </SelectTrigger>
              <SelectContent>
                {seriesCodes.map((code) => (
                  <SelectItem key={code} value={code}>
                    {code}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
          Currency comes from the series and can be changed per invoice. VAT is
          charged only when the provider has a VAT registration number and the
          rate is above zero.
        </p>
      </section>

      <Separator className="my-6" />

      {/* Provider and customer are summary cards side by side; the 13 fields
          each open in a dialog, so the narrow form column stays readable. */}
      <div className="mt-5 grid grid-cols-2 gap-4">
        <section className="flex min-w-0 flex-col gap-2">
          <div className="flex h-9 items-center justify-between gap-2">
            <SectionLabel>Provider</SectionLabel>
          </div>
          <PartyCard
            party={draft.provider}
            label="Provider"
            readOnly={readOnly}
            onOpen={() => setOpenParty("provider")}
          />
        </section>

        <section className="flex min-w-0 flex-col gap-2">
          <div className="flex h-9 items-center justify-between gap-2">
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
          <PartyCard
            party={draft.customer}
            label="Customer"
            readOnly={readOnly}
            onOpen={() => setOpenParty("customer")}
          />
        </section>
      </div>

      <PartyDialog
        open={openParty === "provider"}
        party={draft.provider}
        label="Provider"
        idPrefix="provider"
        disabled={disabled}
        onOpenChange={(next) => setOpenParty(next ? "provider" : null)}
        onChange={(field, value) => onPartyChange("provider", field, value)}
      />
      <PartyDialog
        open={openParty === "customer"}
        party={draft.customer}
        label="Customer"
        idPrefix="customer"
        disabled={disabled}
        onOpenChange={(next) => setOpenParty(next ? "customer" : null)}
        onChange={(field, value) => onPartyChange("customer", field, value)}
        onPrefill={onPrefillCustomer}
      />

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
