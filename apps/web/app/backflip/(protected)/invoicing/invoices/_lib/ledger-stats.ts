import type { LedgerRow } from "./queries"

/**
 * Derivations for the ledger overview: which tax year we are in, the per-series
 * headline stats, and the cumulative-sales curve each series draws.
 *
 * Pure and client-safe — the list page renders them, the tests pin them.
 *
 * @spec L2-INVOICE-34
 */

/** Where the financial year opens. Defaults to the UK tax year, 6 April. */
export type TaxYear = { month: number; day: number }

export const DEFAULT_TAX_YEAR: TaxYear = { month: 4, day: 6 }

/** The most recent opening of the financial year on or before `today`. */
export function taxYearStart(
  today: Date,
  { month, day }: TaxYear = DEFAULT_TAX_YEAR
): Date {
  const year = today.getUTCFullYear()
  const opensThisYear = Date.UTC(year, month - 1, day)
  return new Date(
    today.getTime() >= opensThisYear
      ? opensThisYear
      : Date.UTC(year - 1, month - 1, day)
  )
}

/** The last day of the year that opened at `start` — one year on, minus a day. */
export function taxYearEnd(start: Date): Date {
  const end = new Date(start.getTime())
  end.setUTCFullYear(end.getUTCFullYear() + 1)
  end.setUTCDate(end.getUTCDate() - 1)
  return end
}

/**
 * `2026/27` for a year that straddles two calendar years, plain `2026` for one
 * that opens on 1 January and closes inside the same year.
 */
export function taxYearLabel(start: Date): string {
  const from = start.getUTCFullYear()
  if (taxYearEnd(start).getUTCFullYear() === from) return String(from)
  return `${from}/${String(from + 1).slice(2)}`
}

export type SeriesStat = {
  code: string
  currency: string
  /** Payable total for the tax year, and across the whole ledger. */
  taxYearTotal: number
  allTimeTotal: number
  taxYearCount: number
  count: number
  draftCount: number
  lastInvoiceDate: string | null
}

export function seriesStats(rows: LedgerRow[], start: Date): SeriesStat[] {
  const from = start.toISOString().slice(0, 10)
  const byCode = new Map<string, SeriesStat>()

  for (const row of rows) {
    const stat: SeriesStat = byCode.get(row.series) ?? {
      code: row.series,
      currency: row.currency,
      taxYearTotal: 0,
      allTimeTotal: 0,
      taxYearCount: 0,
      count: 0,
      draftCount: 0,
      lastInvoiceDate: null,
    }

    stat.allTimeTotal += row.gross
    stat.count += 1
    if (!row.locked) stat.draftCount += 1
    if (row.invoiceDate >= from) {
      stat.taxYearTotal += row.gross
      stat.taxYearCount += 1
    }
    if (!stat.lastInvoiceDate || row.invoiceDate > stat.lastInvoiceDate) {
      stat.lastInvoiceDate = row.invoiceDate
    }

    byCode.set(row.series, stat)
  }

  return [...byCode.values()].sort((a, b) => b.taxYearTotal - a.taxYearTotal)
}

export type CumulativePoint = { month: string; label: string } & Record<
  string,
  string | number
>

/**
 * Cumulative payable per series, one point per month of the tax year up to the
 * current month. Months with no invoice still carry the running total forward,
 * so a flat stretch reads as "nothing billed", not as a gap.
 */
export function cumulativeByMonth(
  rows: LedgerRow[],
  start: Date,
  today: Date
): CumulativePoint[] {
  const codes = [...new Set(rows.map((row) => row.series))].sort()
  const running: Record<string, number> = Object.fromEntries(
    codes.map((code) => [code, 0])
  )

  const months: CumulativePoint[] = []
  // Walk whole months: the tax year opens mid-month (the 6th), so stepping from
  // the raw start date would skip the current month once the 6th has passed.
  const cursor = new Date(
    Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1)
  )
  const end = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1))

  while (cursor.getTime() <= end.getTime()) {
    const month = `${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, "0")}`

    for (const row of rows) {
      if (row.invoiceDate.slice(0, 7) !== month) continue
      if (row.invoiceDate < start.toISOString().slice(0, 10)) continue
      running[row.series] = (running[row.series] ?? 0) + row.gross
    }

    months.push({
      month,
      label: new Intl.DateTimeFormat("en-GB", {
        month: "short",
        timeZone: "UTC",
      }).format(cursor),
      ...running,
    })

    cursor.setUTCMonth(cursor.getUTCMonth() + 1)
  }

  return months
}
