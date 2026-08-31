"use client"

import { useState, useTransition } from "react"
import Link from "next/link"

import { RiAddLine, RiArrowLeftLine, RiDeleteBinLine } from "@remixicon/react"
import { toast } from "sonner"

import { Button } from "@workspace/ui/components/button"
import { Field, FieldLabel } from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import { Separator } from "@workspace/ui/components/separator"

import { PageHeading, SectionLabel } from "../../../_components/page-heading"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"

import {
  taxYearEnd,
  taxYearStart,
  type TaxYear,
} from "../../invoices/_lib/ledger-stats"
import {
  deleteInvoiceSeries,
  saveInvoiceBrand,
  saveInvoiceSeries,
  saveInvoiceTaxYear,
} from "../_actions"

export type SeriesRow = {
  id: string
  code: string
  currency: string
  brandName: string
  brandSubName: string
  invoiceCount: number
}

const EMPTY = { code: "", currency: "€", brandName: "", brandSubName: "" }

/**
 * Series list + editor. Each series owns the numbering prefix and the two-part
 * brand name printed on its invoices; an invoice snapshots both when saved, so
 * edits here never rewrite issued documents.
 *
 * @spec L2-INVOICE-22
 */
export type Brand = { brandName: string; brandSubName: string }

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
]

const RANGE_FMT = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
})

export function SeriesSettings({
  series,
  unconfigured,
  brand,
  taxYear,
}: {
  series: SeriesRow[]
  unconfigured: { code: string; invoiceCount: number }[]
  brand: Brand
  taxYear: TaxYear
}) {
  const [brandDraft, setBrandDraft] = useState(brand)
  const [yearDraft, setYearDraft] = useState(taxYear)
  const [draft, setDraft] = useState(EMPTY)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [pending, start] = useTransition()

  function reset() {
    setDraft(EMPTY)
    setEditingId(null)
  }

  function save() {
    start(async () => {
      const res = await saveInvoiceSeries({
        id: editingId ?? undefined,
        ...draft,
      })
      if (res.ok) {
        toast.success(res.message)
        reset()
      } else {
        toast.error(res.message)
      }
    })
  }

  function remove(id: string) {
    start(async () => {
      const res = await deleteInvoiceSeries(id)
      if (res.ok) {
        toast.success(res.message)
        if (editingId === id) reset()
      } else {
        toast.error(res.message)
      }
    })
  }

  return (
    <div className="mx-auto w-full max-w-3xl p-6">
      <Button
        variant="ghost"
        size="sm"
        className="mb-3 -ml-2"
        render={<Link href="/backflip/invoicing/invoices" />}
      >
        <RiArrowLeftLine className="size-4" />
        Invoices
      </Button>

      <PageHeading
        title="Series & currency"
        description="A series decides the numbering prefix, the default currency and the branding printed on the invoices raised under it."
      />

      <section className="mt-6 flex flex-col gap-3">
        <SectionLabel>Brand</SectionLabel>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">
            Printed on every invoice whose series leaves its own brand blank.
            The two parts sit side by side in the header — the second in bold.
          </p>
          <div className="mt-3 flex flex-wrap gap-3">
            <Field className="w-[200px]">
              <FieldLabel
                htmlFor="globalBrandName"
                className="text-xs text-muted-foreground"
              >
                Brand name part 1
              </FieldLabel>
              <Input
                id="globalBrandName"
                value={brandDraft.brandName}
                disabled={pending}
                onChange={(e) =>
                  setBrandDraft({ ...brandDraft, brandName: e.target.value })
                }
              />
            </Field>
            <Field className="w-[200px]">
              <FieldLabel
                htmlFor="globalBrandSubName"
                className="text-xs text-muted-foreground"
              >
                Brand name part 2
              </FieldLabel>
              <Input
                id="globalBrandSubName"
                value={brandDraft.brandSubName}
                disabled={pending}
                onChange={(e) =>
                  setBrandDraft({ ...brandDraft, brandSubName: e.target.value })
                }
              />
            </Field>
          </div>
          <div className="mt-3">
            <Button
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const res = await saveInvoiceBrand(brandDraft)
                  if (res.ok) toast.success(res.message)
                  else toast.error(res.message)
                })
              }
            >
              Save brand
            </Button>
          </div>
        </div>
      </section>

      <Separator className="my-6" />

      <section className="flex flex-col gap-3">
        <SectionLabel>Tax year</SectionLabel>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">
            The financial year the ledger totals and its cumulative-sales chart
            report against. Defaults to the UK tax year, 6 April.
          </p>
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <Field className="w-[170px]">
              <FieldLabel
                htmlFor="taxYearMonth"
                className="text-xs text-muted-foreground"
              >
                Starts in
              </FieldLabel>
              <Select
                value={String(yearDraft.month)}
                disabled={pending}
                onValueChange={(value) =>
                  setYearDraft({ ...yearDraft, month: Number(value ?? 1) })
                }
              >
                <SelectTrigger
                  id="taxYearMonth"
                  aria-label="Tax year start month"
                  className="w-full"
                >
                  {/* The stored value is the month number; show its name. */}
                  <SelectValue>
                    {(value) => MONTHS[Number(value) - 1] ?? ""}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {MONTHS.map((label, index) => (
                    <SelectItem key={label} value={String(index + 1)}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field className="w-[110px]">
              <FieldLabel
                htmlFor="taxYearDay"
                className="text-xs text-muted-foreground"
              >
                On day
              </FieldLabel>
              <Input
                id="taxYearDay"
                inputMode="numeric"
                value={String(yearDraft.day)}
                disabled={pending}
                onChange={(e) =>
                  setYearDraft({
                    ...yearDraft,
                    day: Number(e.target.value.replace(/\D/g, "") || 0),
                  })
                }
              />
            </Field>
            <Button
              variant="outline"
              size="sm"
              className="mb-0.5"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const res = await saveInvoiceTaxYear(yearDraft)
                  if (res.ok) toast.success(res.message)
                  else toast.error(res.message)
                })
              }
            >
              Save tax year
            </Button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Current year:{" "}
            <span className="font-medium text-foreground">
              {RANGE_FMT.format(taxYearStart(new Date(), yearDraft))} –{" "}
              {RANGE_FMT.format(
                taxYearEnd(taxYearStart(new Date(), yearDraft))
              )}
            </span>
            . Day 1–28, so the date exists in every month.
          </p>
        </div>
      </section>

      <Separator className="my-6" />

      <section className="flex flex-col gap-3">
        <SectionLabel>Series</SectionLabel>
        {series.length === 0 ? (
          <p className="rounded-lg border bg-muted/50 px-3 py-2 text-[13px] text-muted-foreground">
            No series yet. Add one below — invoices pick their series from this
            list.
          </p>
        ) : (
          <ul className="rounded-xl border bg-card">
            {series.map((row) => (
              <li
                key={row.id}
                className="flex items-center gap-3 border-b px-4 py-3 last:border-b-0"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-semibold">{row.code}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {[row.brandName, row.brandSubName].filter(Boolean).join("") ||
                      [brand.brandName, brand.brandSubName]
                        .filter(Boolean)
                        .join("") ||
                      "No branding"}{" "}
                    · {row.currency} · {row.invoiceCount}{" "}
                    {row.invoiceCount === 1 ? "invoice" : "invoices"}
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pending}
                  onClick={() => {
                    setEditingId(row.id)
                    setDraft({
                      code: row.code,
                      currency: row.currency,
                      brandName: row.brandName,
                      brandSubName: row.brandSubName,
                    })
                  }}
                >
                  Edit
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 text-muted-foreground hover:text-destructive"
                  aria-label={`Remove series ${row.code}`}
                  disabled={pending || row.invoiceCount > 0}
                  onClick={() => remove(row.id)}
                >
                  <RiDeleteBinLine className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {unconfigured.length > 0 ? (
        <section className="mt-6 flex flex-col gap-3">
          <SectionLabel>Used but not configured</SectionLabel>
          <div className="rounded-xl border border-dashed bg-muted/40 p-4">
            <p className="text-xs text-muted-foreground">
              Invoices already carry these codes — add them to pick them from
              the invoice form and give them branding.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {unconfigured.map((row) => (
                <Button
                  key={row.code}
                  variant="outline"
                  size="sm"
                  disabled={pending}
                  onClick={() =>
                    start(async () => {
                      const res = await saveInvoiceSeries({
                        code: row.code,
                        currency: "€",
                        brandName: "",
                        brandSubName: "",
                      })
                      if (res.ok) toast.success(res.message)
                      else toast.error(res.message)
                    })
                  }
                >
                  <RiAddLine className="size-4" />
                  {row.code}
                  <span className="text-muted-foreground">
                    ({row.invoiceCount})
                  </span>
                </Button>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <Separator className="my-6" />

      <section className="flex flex-col gap-3">
        <SectionLabel>{editingId ? "Edit series" : "Add a series"}</SectionLabel>
        <div className="flex flex-wrap gap-3">
          <Field className="w-[140px]">
            <FieldLabel htmlFor="code" className="text-xs text-muted-foreground">
              Series code
            </FieldLabel>
            <Input
              id="code"
              value={draft.code}
              placeholder="INV"
              disabled={pending}
              onChange={(e) => setDraft({ ...draft, code: e.target.value })}
            />
          </Field>
          <Field className="w-[110px]">
            <FieldLabel
              htmlFor="currency"
              className="text-xs text-muted-foreground"
            >
              Currency
            </FieldLabel>
            <Input
              id="currency"
              value={draft.currency}
              placeholder="€"
              disabled={pending}
              onChange={(e) => setDraft({ ...draft, currency: e.target.value })}
            />
          </Field>
          <Field className="w-[200px]">
            <FieldLabel
              htmlFor="brandName"
              className="text-xs text-muted-foreground"
            >
              Brand name part 1
            </FieldLabel>
            <Input
              id="brandName"
              value={draft.brandName}
              placeholder={brand.brandName || "—"}
              disabled={pending}
              onChange={(e) => setDraft({ ...draft, brandName: e.target.value })}
            />
          </Field>
          <Field className="w-[200px]">
            <FieldLabel
              htmlFor="brandSubName"
              className="text-xs text-muted-foreground"
            >
              Brand name part 2
            </FieldLabel>
            <Input
              id="brandSubName"
              value={draft.brandSubName}
              placeholder={brand.brandSubName || "—"}
              disabled={pending}
              onChange={(e) =>
                setDraft({ ...draft, brandSubName: e.target.value })
              }
            />
          </Field>
        </div>
        <p className="text-xs text-muted-foreground">
          The two brand parts print side by side on the invoice header — the
          second is shown in bold. Leave them blank to print the brand above.
          Currency is the default for invoices raised under this series; each
          invoice keeps its own and can override it.
        </p>
        <div className="flex gap-2">
          <Button size="sm" disabled={pending} onClick={save}>
            <RiAddLine className="size-4" />
            {editingId ? "Save series" : "Add series"}
          </Button>
          {editingId ? (
            <Button
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={reset}
            >
              Cancel
            </Button>
          ) : null}
        </div>
      </section>
    </div>
  )
}
