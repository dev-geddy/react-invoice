import "server-only"

import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer"

import {
  chargesVat,
  formatDate,
  getTotals,
  invoiceRef,
  money,
} from "../calc"
import type { InvoiceDraft, InvoiceParty } from "../types"

/**
 * The invoice as a downloadable PDF. A deliberate second rendering of the same
 * document: the on-screen preview is HTML (and prints through the browser),
 * this one is laid out for A4 by `@react-pdf/renderer` so a download needs no
 * print dialog and looks the same on every machine. The two must be kept in
 * step — same sections, same order, same wording — but they are different
 * layout engines, so they cannot share components.
 *
 * Standard PDF fonts only (Helvetica): no font files ship with the app, and
 * WinAnsi covers the currency symbols the form offers (£, €, $).
 *
 * @spec L2-INVOICE-39
 */

const C = {
  fg: "#171717",
  muted: "#525252",
  subtle: "#737373",
  line: "#d4d4d4",
  lineSoft: "#e5e5e5",
}

const styles = StyleSheet.create({
  page: {
    backgroundColor: "#ffffff",
    color: C.fg,
    fontFamily: "Helvetica",
    fontSize: 9,
    lineHeight: 1.45,
    paddingTop: 40,
    paddingBottom: 56,
    paddingHorizontal: 40,
  },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    borderBottom: `1 solid ${C.line}`,
    paddingBottom: 10,
  },
  // One uppercase wordmark in two weights, as the printed document sets it.
  brand: { flexDirection: "row", alignItems: "baseline" },
  brandName: { fontSize: 22, color: C.subtle },
  brandSubName: { fontSize: 22, fontFamily: "Helvetica-Bold" },
  headerMeta: { fontSize: 8, color: C.muted, textAlign: "right" },
  strong: { fontFamily: "Helvetica-Bold" },

  parties: { flexDirection: "row", gap: 24, marginTop: 18 },
  party: { flex: 1 },
  partyHeading: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: C.subtle,
    letterSpacing: 0.8,
    marginBottom: 3,
  },

  h2: { fontSize: 13, fontFamily: "Helvetica-Bold", marginTop: 22 },
  h3: { fontSize: 10, fontFamily: "Helvetica-Bold", marginTop: 22 },

  metaRow: { flexDirection: "row", marginTop: 6 },
  metaCell: { width: 120 },
  label: { color: C.subtle },

  tableHead: {
    flexDirection: "row",
    borderBottom: `1 solid ${C.line}`,
    color: C.subtle,
    paddingBottom: 3,
    marginTop: 6,
  },
  row: {
    flexDirection: "row",
    borderBottom: `1 solid ${C.lineSoft}`,
    paddingVertical: 4,
  },
  colDate: { width: 62 },
  colDescription: { flex: 1, paddingRight: 8 },
  colQty: { width: 52, textAlign: "right" },
  colRate: { width: 74, textAlign: "right" },
  colTotal: { width: 74, textAlign: "right" },

  summary: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginTop: 18,
    gap: 24,
  },
  vatCell: { width: 78 },
  totals: { width: 200 },
  totalsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderBottom: `1 solid ${C.lineSoft}`,
    paddingVertical: 4,
  },
  totalsRowLast: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
  },

  footer: {
    position: "absolute",
    left: 40,
    right: 40,
    bottom: 28,
    borderTop: `1 solid ${C.line}`,
    paddingTop: 6,
    fontSize: 7.5,
    color: C.subtle,
  },
})

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
    <View style={styles.party}>
      <Text style={styles.partyHeading}>{heading.toUpperCase()}</Text>
      {party.companyName ? (
        <Text style={styles.strong}>{party.companyName}</Text>
      ) : null}
      {party.companyRegNo ? (
        <Text>Company reg. no.: {party.companyRegNo}</Text>
      ) : null}
      {party.companyVatNo ? (
        <Text>VAT reg. no.: {party.companyVatNo}</Text>
      ) : null}
      {party.name ? (
        <Text>
          {party.name}
          {party.role ? ` - ${party.role}` : ""}
        </Text>
      ) : null}
      {address.map((line) => (
        <Text key={line}>{line}</Text>
      ))}
      {bank.length > 0 ? (
        <View style={{ marginTop: 6 }}>
          {bank.map((line) => (
            <Text key={line}>{line}</Text>
          ))}
        </View>
      ) : null}
    </View>
  )
}

function InvoiceDocument({ draft }: { draft: InvoiceDraft }) {
  const { meta, provider, customer, entries } = draft
  const { net, vatAmount, gross } = getTotals(entries, provider, meta.vatRate)
  const vatShown = chargesVat(provider, meta.vatRate)
  const cur = meta.currency

  const footer = [
    provider.companyName,
    provider.companyRegNo && `Company reg. no. ${provider.companyRegNo}`,
    provider.companyVatNo && `VAT reg. no. ${provider.companyVatNo}`,
    provider.addressLine1,
    provider.addressLine2,
    provider.addressLine3,
    provider.addressLine4,
  ]
    .filter(Boolean)
    .join(", ")

  return (
    <Document title={invoiceRef(meta.series, meta.number)}>
      <Page size="A4" style={styles.page}>
        <View style={styles.header} fixed>
          <View style={styles.brand}>
            <Text style={styles.brandName}>
              {meta.brandName.toUpperCase()}
            </Text>
            <Text style={styles.brandSubName}>
              {meta.brandSubName.toUpperCase()}
            </Text>
          </View>
          <View style={styles.headerMeta}>
            {provider.companyName ? <Text>{provider.companyName}</Text> : null}
            {provider.companyRegNo ? (
              <Text>
                Company reg. no.:{" "}
                <Text style={styles.strong}>{provider.companyRegNo}</Text>
              </Text>
            ) : null}
            {provider.companyVatNo ? (
              <Text>
                VAT reg. no.:{" "}
                <Text style={styles.strong}>{provider.companyVatNo}</Text>
              </Text>
            ) : null}
          </View>
        </View>

        <View style={styles.parties}>
          <PartyBlock party={provider} heading="Provider" />
          <PartyBlock party={customer} heading="Customer" />
        </View>

        <Text style={styles.h2}>Invoice</Text>
        <View style={styles.metaRow}>
          <Text style={[styles.metaCell, styles.label]}>Invoice date</Text>
          <Text style={styles.label}>Invoice number</Text>
        </View>
        <View style={styles.metaRow}>
          <Text style={styles.metaCell}>{formatDate(meta.invoiceDate)}</Text>
          <Text>{invoiceRef(meta.series, meta.number)}</Text>
        </View>

        <Text style={styles.h3}>Works completed / Services provided</Text>
        {/* `fixed` repeats the column headings when lines run onto page two. */}
        <View style={styles.tableHead} fixed>
          <Text style={styles.colDate}>Date</Text>
          <Text style={styles.colDescription}>Description</Text>
          <Text style={styles.colQty}>Qty</Text>
          <Text style={styles.colRate}>Rate</Text>
          <Text style={styles.colTotal}>Total</Text>
        </View>
        {entries.map((entry, index) => (
          <View key={index} style={styles.row} wrap={false}>
            <Text style={styles.colDate}>{formatDate(entry.dateProvided)}</Text>
            <Text style={styles.colDescription}>{entry.description}</Text>
            <Text style={styles.colQty}>
              {entry.qty}
              {entry.qtyType}
            </Text>
            <Text style={styles.colRate}>
              {cur}
              {entry.rate}
              {entry.qtyType ? `/${entry.qtyType}` : ""}
            </Text>
            <Text style={styles.colTotal}>
              {cur}
              {entry.total}
            </Text>
          </View>
        ))}

        <View style={styles.summary} wrap={false}>
          <View>
            {vatShown ? (
              <>
                <View style={{ flexDirection: "row" }}>
                  <Text style={[styles.vatCell, styles.label]}>VAT basis</Text>
                  <Text style={[styles.vatCell, styles.label]}>VAT rate</Text>
                  <Text style={styles.label}>VAT amount</Text>
                </View>
                <View style={{ flexDirection: "row" }}>
                  <Text style={styles.vatCell}>
                    {cur}
                    {money(net)}
                  </Text>
                  <Text style={styles.vatCell}>{meta.vatRate}%</Text>
                  <Text>
                    {cur}
                    {money(vatAmount)}
                  </Text>
                </View>
              </>
            ) : null}
          </View>

          <View style={styles.totals}>
            <View style={styles.totalsRow}>
              <Text style={styles.label}>Total</Text>
              <Text>
                {cur}
                {money(net)}
              </Text>
            </View>
            <View style={styles.totalsRow}>
              <Text style={styles.label}>VAT</Text>
              <Text>
                {cur}
                {money(vatAmount)}
              </Text>
            </View>
            <View style={styles.totalsRowLast}>
              <Text style={styles.strong}>Total payable</Text>
              <Text style={styles.strong}>
                {cur}
                {money(gross)}
              </Text>
            </View>
          </View>
        </View>

        <Text style={styles.footer} fixed>
          {footer}
        </Text>
      </Page>
    </Document>
  )
}

/** Renders one invoice to PDF bytes. */
export async function renderInvoicePdf(draft: InvoiceDraft): Promise<Buffer> {
  return renderToBuffer(<InvoiceDocument draft={draft} />)
}
