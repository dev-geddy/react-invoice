"use client"

import { useEffect, useState } from "react"
import { createPortal } from "react-dom"

import {
  chargesVat,
  formatDate,
  getTotals,
  invoiceRef,
  money,
} from "../_lib/calc"
import type { InvoiceDraft, InvoiceParty } from "../_lib/types"

/**
 * The printable invoice. What is on screen is what prints: the print rules
 * below hide the admin shell and hand the page to this element alone, so
 * "print → save as PDF" produces the document without extra tooling.
 *
 * @spec L2-INVOICE-11
 */

const PRINT_CSS = `
@media print {
  /* The printed page is the invoice alone. The document is portalled to a
     direct child of <body> so siblings can simply be switched off — hiding by
     inherited \`visibility\` proved unreliable against the admin shell. */
  body > *:not(.invoice-print-portal) { display: none !important; }
  .invoice-print-portal { display: block !important; }
  html, body { height: auto !important; overflow: visible !important; background: #fff !important; }
  #invoice-print-root {
    width: auto !important;
    max-width: none !important;
    margin: 0 !important;
    padding: 0 !important;
    box-shadow: none !important;
    background: #fff !important;
    color: #000 !important;
  }
  @page { size: A4; margin: 14mm; }
}
`

function PartyBlock({
  party,
  heading,
}: {
  party: InvoiceParty
  heading: string
}) {
  const address = [
    party.addressLine1,
    party.addressLine2,
    party.addressLine3,
    party.addressLine4,
  ].filter(Boolean)
  const bank = [
    party.billingBankAccountBic && `BIC: ${party.billingBankAccountBic}`,
    party.billingBankAccountIban && `IBAN: ${party.billingBankAccountIban}`,
    party.billingBankAccountNo && `Account: ${party.billingBankAccountNo}`,
    party.billingBankAccountSortCode &&
      `Sort code: ${party.billingBankAccountSortCode}`,
  ].filter(Boolean)

  return (
    <div className="flex-1">
      <div className="text-[10px] font-semibold tracking-wide text-neutral-500 uppercase">
        {heading}
      </div>
      <div className="mt-1 text-[12px] leading-relaxed">
        {party.companyName ? (
          <div className="font-semibold">{party.companyName}</div>
        ) : null}
        {party.companyRegNo ? (
          <div>Company reg. no.: {party.companyRegNo}</div>
        ) : null}
        {party.companyVatNo ? (
          <div>VAT reg. no.: {party.companyVatNo}</div>
        ) : null}
        {party.name ? (
          <div>
            {party.name}
            {party.role ? ` — ${party.role}` : ""}
          </div>
        ) : null}
        {address.map((line) => (
          <div key={line}>{line}</div>
        ))}
        {bank.length > 0 ? (
          <div className="mt-2">
            {bank.map((line) => (
              <div key={line}>{line}</div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  )
}

/**
 * The invoice document itself. Rendered twice: once in the preview rail, and
 * once into a body-level portal that only paper sees.
 */
function InvoiceDocument({
  draft,
  printable,
}: {
  draft: InvoiceDraft
  printable?: boolean
}) {
  const { meta, provider, customer, entries } = draft
  const { net, vatAmount, gross } = getTotals(entries, provider, meta.vatRate)
  const vatShown = chargesVat(provider, meta.vatRate)
  const cur = meta.currency

  return (
    <div
      {...(printable ? { id: "invoice-print-root" } : {})}
        className="mx-auto w-full max-w-[820px] bg-white p-8 text-neutral-900 shadow-sm ring-1 ring-black/5 print:ring-0"
      >
        <header className="flex items-start justify-between gap-6 border-b border-neutral-300 pb-4">
          <h1 className="text-2xl leading-none font-light tracking-tight">
            <span>{meta.brandName}</span>
            <span className="font-bold">{meta.brandSubName}</span>
          </h1>
          <div className="text-right text-[11px] leading-relaxed text-neutral-600">
            {provider.companyName ? <div>{provider.companyName}</div> : null}
            {provider.companyRegNo ? (
              <div>
                Company reg. no.: <strong>{provider.companyRegNo}</strong>
              </div>
            ) : null}
            {provider.companyVatNo ? (
              <div>
                VAT reg. no.: <strong>{provider.companyVatNo}</strong>
              </div>
            ) : null}
          </div>
        </header>

        <div className="mt-6 flex gap-8">
          <PartyBlock party={provider} heading="Provider" />
          <PartyBlock party={customer} heading="Customer" />
        </div>

        <h2 className="mt-8 text-lg font-semibold tracking-tight">Invoice</h2>
        <table className="mt-2 text-[12px]">
          <thead>
            <tr className="text-left text-neutral-500">
              <th className="pr-8 font-medium">Invoice date</th>
              <th className="font-medium">Invoice number</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="pr-8">{formatDate(meta.invoiceDate)}</td>
              <td>{invoiceRef(meta.series, meta.number)}</td>
            </tr>
          </tbody>
        </table>

        <h3 className="mt-8 text-[13px] font-semibold">
          Works completed / Services provided
        </h3>
        <table className="mt-2 w-full border-collapse text-[12px]">
          <thead>
            <tr className="border-b border-neutral-300 text-left text-neutral-500">
              <th className="w-[92px] py-1.5 font-medium">Date</th>
              <th className="py-1.5 font-medium">Description</th>
              <th className="w-[64px] py-1.5 text-right font-medium">Qty</th>
              <th className="w-[92px] py-1.5 text-right font-medium">Rate</th>
              <th className="w-[92px] py-1.5 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry, index) => (
              <tr key={index} className="border-b border-neutral-200">
                <td className="py-1.5 align-top">
                  {formatDate(entry.dateProvided)}
                </td>
                <td className="py-1.5 align-top">{entry.description}</td>
                <td className="py-1.5 text-right align-top tabular-nums">
                  {entry.qty}
                  {entry.qtyType}
                </td>
                <td className="py-1.5 text-right align-top tabular-nums">
                  {cur}
                  {entry.rate}
                  {entry.qtyType ? `/${entry.qtyType}` : ""}
                </td>
                <td className="py-1.5 text-right align-top tabular-nums">
                  {cur}
                  {entry.total}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-6 flex justify-between gap-8">
          {vatShown ? (
            <table className="text-[12px]">
              <thead>
                <tr className="text-left text-neutral-500">
                  <th className="pr-6 font-medium">VAT basis</th>
                  <th className="pr-6 font-medium">VAT rate</th>
                  <th className="font-medium">VAT amount</th>
                </tr>
              </thead>
              <tbody>
                <tr className="tabular-nums">
                  <td className="pr-6">
                    {cur}
                    {money(net)}
                  </td>
                  <td className="pr-6">{meta.vatRate}%</td>
                  <td>
                    {cur}
                    {money(vatAmount)}
                  </td>
                </tr>
              </tbody>
            </table>
          ) : (
            <div />
          )}

          <table className="min-w-[240px] text-[12px]">
            <tbody>
              <tr className="border-b border-neutral-200">
                <th className="py-1.5 text-left font-medium text-neutral-500">
                  Total
                </th>
                <td className="py-1.5 text-right tabular-nums">
                  {cur}
                  {money(net)}
                </td>
              </tr>
              <tr className="border-b border-neutral-200">
                <th className="py-1.5 text-left font-medium text-neutral-500">
                  VAT
                </th>
                <td className="py-1.5 text-right tabular-nums">
                  {cur}
                  {money(vatAmount)}
                </td>
              </tr>
              <tr>
                <th className="py-1.5 text-left font-semibold">Total payable</th>
                <td className="py-1.5 text-right font-semibold tabular-nums">
                  {cur}
                  {money(gross)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <footer className="mt-10 border-t border-neutral-300 pt-3 text-[10px] text-neutral-500">
          {[
            provider.companyName,
            provider.companyRegNo && `Company reg. no. ${provider.companyRegNo}`,
            provider.companyVatNo && `VAT reg. no. ${provider.companyVatNo}`,
            provider.addressLine1,
            provider.addressLine2,
            provider.addressLine3,
            provider.addressLine4,
          ]
            .filter(Boolean)
            .join(", ")}
      </footer>
    </div>
  )
}

/**
 * Preview rail + the print copy. `document.body` only exists in the browser, so
 * the portal mounts after hydration.
 */
export function InvoicePreview({ draft }: { draft: InvoiceDraft }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  return (
    <>
      <style>{PRINT_CSS}</style>
      <InvoiceDocument draft={draft} />
      {mounted
        ? createPortal(
            <div className="invoice-print-portal hidden">
              <InvoiceDocument draft={draft} printable />
            </div>,
            document.body
          )
        : null}
    </>
  )
}
