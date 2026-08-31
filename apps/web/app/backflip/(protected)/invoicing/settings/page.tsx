import { db, invoiceSeries, invoices } from "@workspace/db"
import { asc, count } from "drizzle-orm"

import { requireCapability } from "@/app/_lib/auth/guard"
import { SeriesSettings } from "./_components/series-settings"

/**
 * /backflip/invoicing/settings — invoice series and the branding printed with
 * them. Operator configuration (owner/admin); raising invoices needs no access
 * here.
 *
 * @spec L2-INVOICE-22, L2-INVOICE-23
 */
export default async function InvoiceSettingsPage() {
  await requireCapability("invoices.settings")

  const rows = await db
    .select({
      id: invoiceSeries.id,
      code: invoiceSeries.code,
      currency: invoiceSeries.currency,
      brandName: invoiceSeries.brandName,
      brandSubName: invoiceSeries.brandSubName,
    })
    .from(invoiceSeries)
    .orderBy(asc(invoiceSeries.code))

  // How many invoices already carry each code — a series in use can't be
  // removed, and the count says why.
  const usage = await db
    .select({ series: invoices.series, used: count() })
    .from(invoices)
    .groupBy(invoices.series)
  const usedByCode = new Map(usage.map((u) => [u.series, Number(u.used)]))

  // Codes that invoices already use but that nobody has defined — typically
  // invoices raised before series existed. Offered for one-click adoption.
  const configured = new Set(rows.map((row) => row.code))
  const unconfigured = usage
    .filter((u) => u.series.length > 0 && !configured.has(u.series))
    .map((u) => ({ code: u.series, invoiceCount: Number(u.used) }))

  return (
    <SeriesSettings
      series={rows.map((row) => ({
        ...row,
        invoiceCount: usedByCode.get(row.code) ?? 0,
      }))}
      unconfigured={unconfigured}
    />
  )
}
