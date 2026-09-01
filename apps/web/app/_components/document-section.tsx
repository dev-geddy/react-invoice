import { RiCheckboxCircleFill, RiFilePdf2Line } from "@remixicon/react"

/**
 * "The preview is the document" — the claim the editor's two-pane layout makes,
 * with a sample filename standing in for the real download.
 */

const POINTS = [
  {
    title: "Live preview",
    body: "line items whose qty, rate and total recompute each other as you type.",
  },
  {
    title: "Series numbering",
    body: "each series owns its prefix, currency and branding; issued invoices snapshot all three.",
  },
  {
    title: "Customers",
    body: "an address book that prefills the form, with one-click adoption for companies you invoiced but never saved.",
  },
  {
    title: "Tax-year totals",
    body: "per-series totals and a cumulative sales chart above the ledger.",
  },
]

const LEDGER = [
  { no: "RIE-0010", amount: "£1031.25" },
  { no: "RIE-0009", amount: "£480.00" },
  { no: "RIE-0008", amount: "£2145.60" },
  { no: "RIE-0007", amount: "£360.00" },
]

export function DocumentSection() {
  return (
    <section aria-label="The document" className="mx-auto max-w-6xl px-6 py-20">
      <div className="grid items-center gap-14 lg:grid-cols-2">
        {/* `min-w-0`: the filename chip below is `whitespace-nowrap`, and a grid
            item's default `min-width:auto` would let it set the column width. */}
        <div className="min-w-0">
          <span className="font-mono text-xs tracking-[0.08em] text-[var(--brand)] uppercase">
            Paper, not a screenshot of paper
          </span>
          <h2 className="mt-2 text-[clamp(1.625rem,3.4vw,2.125rem)] font-semibold tracking-tight">
            The preview is the document
          </h2>
          <p className="mt-2 max-w-lg text-sm leading-relaxed text-muted-foreground">
            Edit on the left, the invoice redraws on the right. Print it from
            the browser or download a server-rendered A4 PDF — same layout
            either way, named after the invoice it came from.
          </p>

          <div className="mt-6 flex flex-col gap-3.5">
            {POINTS.map((point) => (
              <div key={point.title} className="flex items-start gap-2.5">
                <RiCheckboxCircleFill
                  className="mt-0.5 size-4 flex-none text-[var(--brand)]"
                  aria-hidden="true"
                />
                <p className="text-sm leading-normal text-muted-foreground">
                  <strong className="font-semibold text-foreground">
                    {point.title}
                  </strong>{" "}
                  — {point.body}
                </p>
              </div>
            ))}
          </div>

          {/* The filename is the feature: it names the invoice it came from. */}
          <div className="mt-7 inline-flex max-w-full items-center gap-2 overflow-x-auto rounded-md border border-[var(--brand-line)] bg-[var(--brand-soft)] px-3 py-2 font-mono text-[0.6875rem] whitespace-nowrap">
            <RiFilePdf2Line
              className="size-4 flex-none text-[var(--brand)]"
              aria-hidden="true"
            />
            2026_08_21 - RIE-0010 - GBP1031.25 VAT incl. - Northgate Systems
            Ltd.pdf
          </div>
        </div>

        <div aria-hidden="true" className="relative hidden h-96 lg:block">
          <div className="absolute inset-0 rounded-lg border bg-card [background-image:repeating-linear-gradient(135deg,var(--muted)_0_2px,transparent_2px_22px)]" />
          <div className="absolute top-8 left-10 h-68 w-48 animate-[paper-float-c_10s_ease-in-out_infinite] rounded-sm bg-card shadow-[0_16px_34px_var(--paper-shadow)] ring-1 ring-border" />
          <div className="absolute right-12 bottom-9 flex w-56 animate-[paper-float-b_8500ms_ease-in-out_infinite] flex-col gap-3 rounded-sm bg-card p-4.5 shadow-[0_24px_50px_var(--paper-shadow)] ring-1 ring-border">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[0.625rem] tracking-[0.08em] text-muted-foreground uppercase">
                Series RIE
              </span>
              <span className="inline-flex items-center rounded-sm border border-[var(--brand-line)] bg-[var(--brand-soft)] px-1.5 py-[0.15rem] font-mono text-[0.5625rem] text-[var(--brand)]">
                VAT 20%
              </span>
            </div>
            {LEDGER.map((row) => (
              <div
                key={row.no}
                className="flex items-center justify-between border-b border-muted pb-1.5 text-[0.6875rem]"
              >
                <span className="font-mono text-muted-foreground">
                  {row.no}
                </span>
                <span className="font-mono">{row.amount}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
