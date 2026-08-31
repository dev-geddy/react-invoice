"use client"

import { useMemo, useState } from "react"
import Link from "next/link"

import { RiAddBoxLine, RiFileList3Line, RiLockLine } from "@remixicon/react"

import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@workspace/ui/components/toggle-group"

import { PageHeading, SectionLabel } from "../../../_components/page-heading"
import { formatDate, invoiceRef, money } from "../../_lib/calc"
import type { CumulativePoint, SeriesStat } from "../_lib/ledger-stats"
import type { LedgerRow } from "../_lib/queries"
import { SalesChart } from "./sales-chart"

/** Sentinel for the unfiltered state — no series is ever called this. */
const ALL_SERIES = "__all__"

/**
 * Segmented chip: the group joins its items (`spacing={0}`), and the selected
 * one carries the primary fill rather than the toggle's default muted wash, so
 * the active filter reads at a glance across the row. Default toggle size —
 * h-7 and `text-xs`, matching the page's New invoice button (`size="sm"`).
 */
const CHIP =
  "data-pressed:bg-primary data-pressed:text-primary-foreground data-pressed:hover:bg-primary"

/**
 * The ledger: series headlines, the cumulative-sales chart, then every invoice.
 * Opening one is a navigation now, not a selection — the editor is its own page.
 *
 * @spec L2-INVOICE-33, L2-INVOICE-34
 */
export function LedgerView({
  rows,
  stats,
  points,
  taxYear,
}: {
  rows: LedgerRow[]
  stats: SeriesStat[]
  points: CumulativePoint[]
  taxYear: string
}) {
  const [query, setQuery] = useState("")
  // Base UI toggle groups carry an array. Deselecting the active chip empties
  // it, so an empty selection falls back to All rather than to a filter that
  // matches nothing.
  const [series, setSeries] = useState<string[]>([ALL_SERIES])
  const activeSeries = series[0] ?? ALL_SERIES

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return rows.filter((row) => {
      if (activeSeries !== ALL_SERIES && row.series !== activeSeries) {
        return false
      }
      if (!q) return true
      return [row.series + row.number, row.customerName, row.ownerLabel]
        .join(" ")
        .toLowerCase()
        .includes(q)
    })
  }, [rows, query, activeSeries])

  const narrowed = filtered.length !== rows.length

  return (
    <div className="mx-auto w-full max-w-6xl p-6">
      <PageHeading
        title="Invoices"
        description="Every invoice on the platform. Open one to edit it, or raise a new one."
        action={
          <Button
            size="sm"
            render={<Link href="/backflip/invoicing/invoices/new" />}
          >
            <RiAddBoxLine className="size-4" />
            New invoice
          </Button>
        }
      />

      {stats.length > 0 ? (
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {stats.map((stat) => (
            <div key={stat.code} className="rounded-xl border bg-card p-4">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[13px] font-semibold">{stat.code}</span>
                <span className="text-xs text-muted-foreground">
                  {stat.taxYearCount} this year · {stat.count} total
                </span>
              </div>
              <div className="mt-1 text-xl font-semibold tabular-nums">
                {stat.currency}
                {money(stat.taxYearTotal)}
              </div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                {stat.currency}
                {money(stat.allTimeTotal)} all time
                {stat.draftCount > 0 ? ` · ${stat.draftCount} draft` : ""}
                {stat.lastInvoiceDate
                  ? ` · last ${formatDate(stat.lastInvoiceDate)}`
                  : ""}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <div className="mt-4">
        <SalesChart points={points} stats={stats} taxYear={taxYear} />
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <SectionLabel>
            {narrowed ? `${filtered.length} of ${rows.length}` : rows.length}{" "}
            {rows.length === 1 ? "invoice" : "invoices"}
          </SectionLabel>
          {stats.length > 1 ? (
            <ToggleGroup
              variant="outline"
              spacing={0}
              value={series}
              onValueChange={(next: string[]) =>
                setSeries(next.length > 0 ? next : [ALL_SERIES])
              }
              aria-label="Filter by series"
            >
              <ToggleGroupItem value={ALL_SERIES} className={CHIP}>
                All
              </ToggleGroupItem>
              {stats.map((stat) => (
                <ToggleGroupItem
                  key={stat.code}
                  value={stat.code}
                  className={CHIP}
                >
                  {stat.code}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          ) : null}
        </div>
        <Input
          value={query}
          placeholder="Search invoices"
          aria-label="Search invoices"
          className="max-w-xs"
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {filtered.length === 0 ? (
        <p className="mt-3 rounded-lg border bg-muted/50 px-3 py-2 text-[13px] text-muted-foreground">
          {rows.length === 0
            ? "No invoices yet. Raise the first one."
            : "No invoice matches that filter."}
        </p>
      ) : (
        <ul className="mt-3 overflow-hidden rounded-xl border bg-card">
          {filtered.map((row) => (
            <li key={row.id} className="border-b last:border-b-0">
              <Link
                href={`/backflip/invoicing/invoices/${row.id}`}
                className="flex items-center gap-3 px-4 py-3 hover:bg-accent/40"
              >
                <RiFileList3Line className="size-4 flex-none text-muted-foreground" />
                <span className="flex w-[120px] flex-none items-center gap-1.5 text-[13px] font-medium">
                  {invoiceRef(row.series, row.number)}
                  {row.locked ? (
                    <RiLockLine
                      className="size-3.5 text-muted-foreground"
                      aria-label="Locked"
                    />
                  ) : null}
                </span>
                <span className="w-[100px] flex-none text-xs text-muted-foreground tabular-nums">
                  {formatDate(row.invoiceDate)}
                </span>
                <span className="min-w-0 flex-1 truncate text-[13px]">
                  {row.customerName || "No customer"}
                </span>
                <span className="hidden w-[140px] flex-none truncate text-xs text-muted-foreground sm:block">
                  {row.ownerLabel}
                </span>
                <span className="w-[110px] flex-none text-right text-[13px] font-medium tabular-nums">
                  {row.currency}
                  {money(row.gross)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
