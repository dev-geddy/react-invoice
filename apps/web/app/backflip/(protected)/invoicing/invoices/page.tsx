import { requireCapability } from "@/app/_lib/auth/guard"
import { LedgerView } from "./_components/ledger-view"
import {
  cumulativeByMonth,
  seriesStats,
  taxYearLabel,
  taxYearStart,
} from "./_lib/ledger-stats"
import { loadLedger, loadTaxYear } from "./_lib/queries"

/**
 * /backflip/invoicing/invoices — the ledger list, with per-series headlines and
 * the cumulative-sales curve for the current tax year above it. Editing lives
 * on its own route (`new` / `[id]`).
 *
 * @spec L2-INVOICE-33, L2-INVOICE-34
 */
export default async function InvoicesPage() {
  await requireCapability("invoices")

  const [rows, taxYear] = await Promise.all([loadLedger(), loadTaxYear()])
  const now = new Date()
  const start = taxYearStart(now, taxYear)

  return (
    <LedgerView
      rows={rows}
      stats={seriesStats(rows, start)}
      points={cumulativeByMonth(rows, start, now)}
      taxYear={taxYearLabel(start)}
    />
  )
}
