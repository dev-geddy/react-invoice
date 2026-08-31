import { describe, expect, it } from "vitest"

import {
  cumulativeByMonth,
  seriesStats,
  taxYearEnd,
  taxYearLabel,
  taxYearStart,
} from "./ledger-stats"
import type { LedgerRow } from "./queries"

const row = (over: Partial<LedgerRow>): LedgerRow => ({
  id: crypto.randomUUID(),
  series: "RIS",
  number: "0001",
  invoiceDate: "2026-05-10",
  currency: "£",
  vatRate: "21",
  locked: true,
  customerName: "Acme",
  ownerLabel: "Owner",
  gross: 100,
  ...over,
})

describe("taxYearStart", () => {
  it("runs 6 April to 5 April", () => {
    expect(taxYearStart(new Date("2026-08-31T00:00:00Z")).toISOString()).toMatch(
      /^2026-04-06/
    )
    expect(taxYearStart(new Date("2026-04-06T00:00:00Z")).toISOString()).toMatch(
      /^2026-04-06/
    )
    // The day before the switch still belongs to the previous year.
    expect(taxYearStart(new Date("2026-04-05T00:00:00Z")).toISOString()).toMatch(
      /^2025-04-06/
    )
  })

  it("labels the year the way HMRC writes it", () => {
    expect(taxYearLabel(new Date("2026-04-06T00:00:00Z"))).toBe("2026/27")
  })

  it("honours a configured start", () => {
    // Calendar year.
    const jan = taxYearStart(new Date("2026-08-31T00:00:00Z"), {
      month: 1,
      day: 1,
    })
    expect(jan.toISOString()).toMatch(/^2026-01-01/)
    expect(taxYearEnd(jan).toISOString()).toMatch(/^2026-12-31/)
    expect(taxYearLabel(jan)).toBe("2026")

    // July start: August is inside the year that opened this July.
    const july = taxYearStart(new Date("2026-08-31T00:00:00Z"), {
      month: 7,
      day: 1,
    })
    expect(july.toISOString()).toMatch(/^2026-07-01/)
    expect(taxYearEnd(july).toISOString()).toMatch(/^2027-06-30/)
  })

  it("ends the day before the next opening", () => {
    expect(
      taxYearEnd(new Date("2026-04-06T00:00:00Z")).toISOString()
    ).toMatch(/^2027-04-05/)
  })
})

describe("seriesStats", () => {
  const start = new Date("2026-04-06T00:00:00Z")

  it("splits tax-year totals from the all-time ones", () => {
    const stats = seriesStats(
      [
        row({ gross: 100, invoiceDate: "2026-05-10" }),
        row({ gross: 50, invoiceDate: "2026-01-10" }),
        row({ series: "RIE", currency: "€", gross: 30, locked: false }),
      ],
      start
    )

    expect(stats.map((s) => s.code)).toEqual(["RIS", "RIE"])
    expect(stats[0]).toMatchObject({
      taxYearTotal: 100,
      allTimeTotal: 150,
      taxYearCount: 1,
      count: 2,
      draftCount: 0,
      lastInvoiceDate: "2026-05-10",
    })
    expect(stats[1]).toMatchObject({ currency: "€", draftCount: 1 })
  })

  it("returns nothing for an empty ledger", () => {
    expect(seriesStats([], start)).toEqual([])
  })
})

describe("cumulativeByMonth", () => {
  const start = new Date("2026-04-06T00:00:00Z")
  const today = new Date("2026-07-15T00:00:00Z")

  it("accumulates per series and carries quiet months forward", () => {
    const points = cumulativeByMonth(
      [
        row({ series: "RIS", gross: 100, invoiceDate: "2026-04-20" }),
        row({ series: "RIS", gross: 40, invoiceDate: "2026-06-02" }),
        row({ series: "RIE", gross: 25, invoiceDate: "2026-05-05" }),
      ],
      start,
      today
    )

    expect(points.map((p) => p.label)).toEqual(["Apr", "May", "Jun", "Jul"])
    expect(points.map((p) => p.RIS)).toEqual([100, 100, 140, 140])
    expect(points.map((p) => p.RIE)).toEqual([0, 25, 25, 25])
  })

  it("ignores invoices from before the tax year", () => {
    const points = cumulativeByMonth(
      [row({ gross: 999, invoiceDate: "2026-03-31" })],
      start,
      today
    )
    expect(points.every((p) => p.RIS === 0)).toBe(true)
  })
})
