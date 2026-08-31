"use client"

import { useState } from "react"

import Link from "next/link"

import {
  RiArrowLeftLine,
  RiDeleteBinLine,
  RiFilePdf2Line,
  RiLayoutRightLine,
  RiLockLine,
  RiLockUnlockLine,
  RiErrorWarningLine,
  RiMagicLine,
  RiSaveLine,
  RiDraftLine,
  RiSettings3Line,
} from "@remixicon/react"

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@workspace/ui/components/tooltip"
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
  dirty,
  onMetaChange,
  onSeriesChange,
  onPartyChange,
  onEntriesChange,
  onSave,
  onToggleLock,
  onDelete,
  onPrefillCustomer,
  onGenerateNumber,
  onDownloadPdf,
  downloadingPdf,
  previewOpen,
  onTogglePreview,
}: {
  draft: InvoiceDraft
  invoice: Invoice | null
  series: InvoiceSeriesOption[]
  canManageSettings: boolean
  saving: boolean
  /** The draft differs from what the server last stored. */
  dirty: boolean
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
  onDownloadPdf: () => void
  downloadingPdf: boolean
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

      {/* Leaving and destroying the invoice are both "exits" — they share the
          row above the title, at opposite ends, well away from Save. */}
      <div className="mb-3 flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          className="-ml-2"
          render={<Link href="/backflip/invoicing/invoices" />}
        >
          <RiArrowLeftLine className="size-4" />
          Invoices
        </Button>
        {invoice && invoice.canManage && !locked ? (
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={() => setConfirmDelete(true)}
          >
            <RiDeleteBinLine className="size-4" />
            Delete invoice
          </Button>
        ) : null}
      </div>

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
      ) : dirty ? (
        /* A saved invoice whose form has moved on: the ledger, the PDF and the
           print output still carry the stored version until Save runs. */
        <div
          role="status"
          className="mb-4 flex items-start gap-2 rounded-lg border border-amber-400 bg-amber-50 px-3 py-2 dark:border-amber-700 dark:bg-amber-950/40"
        >
          <RiErrorWarningLine className="mt-0.5 size-4 flex-none text-amber-700 dark:text-amber-300" />
          <p className="text-xs text-amber-800 dark:text-amber-300">
            <strong className="font-semibold">Unsaved changes.</strong> This
            invoice differs from the saved version — save to keep the edits.
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
              {/* Icon-only, and the wand says nothing on its own — the
                  tooltip names the action for pointer users, the aria-label
                  for everyone else. */}
              <Tooltip>
                <TooltipTrigger
                  render={
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
                  }
                />
                <TooltipContent>
                  Fill in the next free number in this series
                </TooltipContent>
              </Tooltip>
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
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={disabled}
                    onClick={onPrefillCustomer}
                  >
                    <RiMagicLine className="size-4" />
                    Prefill
                  </Button>
                }
              />
              <TooltipContent>
                Copy a customer's details from the address book or an earlier
                invoice
              </TooltipContent>
            </Tooltip>
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

      {/* Net and VAT read left to right; the payable total is the answer, so it
          sits at the trailing edge where the eye lands last. */}
      <dl className="flex flex-wrap items-end gap-8 text-sm">
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
        <div className="ml-auto text-right">
          <dt className="text-xs text-muted-foreground">Total payable</dt>
          <dd className="text-base font-semibold tabular-nums">
            {draft.meta.currency}
            {money(gross)}
          </dd>
        </div>
      </dl>

      {/* The same save/lock actions as the toolbar, repeated where the form
          ends — a long invoice puts the header well out of reach. */}
      <div className="mt-4 flex flex-wrap items-center gap-2 border-t pt-4">
        <Button size="sm" disabled={disabled} onClick={onSave}>
          <RiSaveLine className="size-4" />
          {saving ? "Saving…" : invoice ? "Save" : "Create invoice"}
        </Button>
        {invoice && invoice.canManage ? (
          <Button
            variant="outline"
            size="sm"
            disabled={saving}
            onClick={onToggleLock}
          >
            {locked ? (
              <RiLockUnlockLine className="size-4" />
            ) : (
              <RiLockLine className="size-4" />
            )}
            {locked ? "Unlock" : "Lock"}
          </Button>
        ) : null}
        {locked ? (
          <span className="text-xs text-muted-foreground">
            Locked — unlock to make changes.
          </span>
        ) : null}
        {/* Writing actions sit together on the leading edge; the download is
            the one action that leaves the app, so it sits opposite them. Print
            keeps to the preview rail, where the paper is. */}
        <Button
          variant="outline"
          size="sm"
          className="ml-auto"
          disabled={downloadingPdf}
          onClick={onDownloadPdf}
        >
          <RiFilePdf2Line className="size-4" />
          {downloadingPdf ? "Preparing…" : "Download PDF"}
        </Button>
      </div>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete invoice {invoiceRef(draft.meta.series, draft.meta.number)}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Deleting removes the invoice from the shared ledger for everyone,
              along with its provider and customer details and all{" "}
              {draft.entries.length}{" "}
              {draft.entries.length === 1 ? "line" : "lines"} — a payable total
              of {draft.meta.currency}
              {money(gross)}. Its number stays free for reuse in the{" "}
              {draft.meta.series || "same"} series. This cannot be undone.
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
