import { describe, expect, it } from "vitest"

import {
  chargesVat,
  currencyIso,
  formatDate,
  getTotals,
  invoiceRef,
  invoiceTitle,
  money,
  nextNumber,
  num,
  recalcEntry,
} from "./calc"
import { EMPTY_PARTY, type InvoiceEntry } from "./types"

const entry = (over: Partial<InvoiceEntry> = {}): InvoiceEntry => ({
  dateProvided: "2026-08-31",
  description: "Work",
  qty: "2",
  qtyType: "d",
  rate: "100",
  total: "200",
  ...over,
})

const vatProvider = { ...EMPTY_PARTY, companyVatNo: "GB123456789" }

describe("num", () => {
  it("reads blanks and junk as 0 instead of NaN", () => {
    expect(num("")).toBe(0)
    expect(num("abc")).toBe(0)
    expect(num(undefined)).toBe(0)
    expect(num("12.5")).toBe(12.5)
  })
})

describe("recalcEntry", () => {
  it("qty drives the total", () => {
    expect(recalcEntry(entry(), "qty", "3").total).toBe("300.00")
  })

  it("rate drives the total", () => {
    expect(recalcEntry(entry(), "rate", "150").total).toBe("300.00")
  })

  it("total back-solves the rate", () => {
    expect(recalcEntry(entry(), "total", "500").rate).toBe("250.00")
  })

  it("keeps the rate when qty is zero (no division by zero)", () => {
    const zero = entry({ qty: "0" })
    expect(recalcEntry(zero, "total", "500").rate).toBe("100")
  })
})

describe("getTotals", () => {
  it("adds VAT only for a VAT-registered provider", () => {
    const entries = [entry(), entry({ total: "100" })]
    expect(getTotals(entries, vatProvider, "21")).toEqual({
      net: 300,
      vatAmount: 63,
      gross: 363,
    })
  })

  it("charges nothing when the provider has no VAT number", () => {
    expect(getTotals([entry()], EMPTY_PARTY, "21")).toEqual({
      net: 200,
      vatAmount: 0,
      gross: 200,
    })
  })

  it("charges nothing at a 0% rate", () => {
    expect(getTotals([entry()], vatProvider, "0").gross).toBe(200)
  })

  it("totals an empty invoice at zero", () => {
    expect(getTotals([], vatProvider, "21")).toEqual({
      net: 0,
      vatAmount: 0,
      gross: 0,
    })
  })
})

describe("nextNumber", () => {
  it("starts a fresh series at 0001", () => {
    expect(nextNumber([])).toBe("0001")
    expect(nextNumber(["", "draft"])).toBe("0001")
  })

  it("increments the highest number, keeping the widest padding", () => {
    expect(nextNumber(["0007", "0009", "0008"])).toBe("0010")
    expect(nextNumber(["12", "0007"])).toBe("0013")
  })
})

describe("chargesVat / formatting helpers", () => {
  it("needs both a VAT number and a non-zero rate", () => {
    expect(chargesVat(vatProvider, "21")).toBe(true)
    expect(chargesVat(vatProvider, "0")).toBe(false)
    expect(chargesVat(EMPTY_PARTY, "21")).toBe(false)
  })

  it("maps currency symbols to ISO codes", () => {
    expect(currencyIso("€")).toBe("EUR")
    expect(currencyIso("£")).toBe("GBP")
    expect(currencyIso("zł")).toBe("ZŁ")
  })

  it("renders dates and refs the way the printed invoice does", () => {
    expect(formatDate("2026-08-31")).toBe("31/08/2026")
    expect(invoiceRef("INV", "0007")).toBe("INV0007")
    expect(invoiceRef("", "")).toBe("—")
  })

  it("rounds money away from float dust", () => {
    expect(money(0.1 + 0.2)).toBe("0.30")
  })
})

describe("invoiceTitle", () => {
  it("names the file the way the reference app did", () => {
    const title = invoiceTitle({
      meta: {
        invoiceDate: "2026-08-31",
        series: "INV",
        number: "0007",
        currency: "€",
        vatRate: "21",
        brandName: "",
        brandSubName: "",
      },
      provider: vatProvider,
      customer: { ...EMPTY_PARTY, companyName: "Acme Ltd", name: "Jane Doe" },
      entries: [entry()],
    })

    expect(title).toBe(
      "2026_08_31 - INV0007 - EUR242.00 VAT incl. - Acme Ltd, Jane Doe"
    )
  })
})
