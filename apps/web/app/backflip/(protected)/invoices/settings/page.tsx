import { db, invoiceSeries, invoices } from "@workspace/db"
import { asc, count } from "drizzle-orm"

import { requireCapability } from "@/app/_lib/auth/guard"
import { SeriesSettings } from "./_components/series-settings"

/**
 * /backflip/invoices/settings — invoice series and the branding printed with
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

  return (
    <SeriesSettings
      series={rows.map((row) => ({
        ...row,
        invoiceCount: usedByCode.get(row.code) ?? 0,
      }))}
    />
  )
}
