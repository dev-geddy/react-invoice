import { RiFilePdf2Line } from "@remixicon/react"

/**
 * The hero's floating invoice: two blank sheets behind one rendered document.
 * Decorative — the figures are a sample, not live data, so the whole stack is
 * `aria-hidden` and the copy beside it carries the meaning.
 */

const LINES = [
  { item: "Platform engineering", qty: "42", total: "£735.00" },
  { item: "Droplet provisioning", qty: "6", total: "£105.00" },
  { item: "Support retainer", qty: "1", total: "£012.50" },
]

const COLUMNS = "grid grid-cols-[1fr_2.4rem_4rem] gap-2"

export function InvoicePaperStack() {
  return (
    <div aria-hidden="true" className="relative hidden h-[29rem] lg:block">
      {/* Sheets behind the document: paper it sits on, nothing to read. */}
      <div className="absolute top-22 right-36 h-[19.8rem] w-56 animate-[paper-float-c_11s_ease-in-out_infinite] rounded-sm bg-card shadow-[0_18px_40px_var(--paper-shadow)] ring-1 ring-border" />
      <div className="absolute top-[2.6rem] right-8 h-[22.6rem] w-64 animate-[paper-float-b_9s_ease-in-out_infinite] rounded-sm bg-card shadow-[0_22px_46px_var(--paper-shadow)] ring-1 ring-border" />

      <div className="absolute top-0 left-2 flex h-[27.5rem] w-[19.5rem] animate-[paper-float-a_8s_ease-in-out_infinite] flex-col rounded-sm bg-card px-5.5 py-6 shadow-[0_30px_60px_var(--paper-shadow)] ring-1 ring-border">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="font-mono text-[0.6875rem] tracking-[0.1em] text-muted-foreground uppercase">
              Invoice
            </div>
            <div className="mt-1 text-lg font-bold tracking-tight">
              RIE-0010
            </div>
          </div>
          <span className="inline-flex items-center gap-1 rounded-sm bg-[var(--brand)] px-1.5 py-[0.2rem] font-mono text-[0.5625rem] tracking-[0.08em] text-[var(--brand-ink)]">
            <RiFilePdf2Line className="size-2.5" />
            PDF
          </span>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 text-[0.6875rem] leading-normal text-muted-foreground">
          <div>
            <div className="font-semibold text-foreground">
              Northgate Systems Ltd
            </div>
            <div>London, UK</div>
            <div>VAT GB 412 7745 09</div>
          </div>
          <div>
            <div className="font-semibold text-foreground">Issued</div>
            <div>21 Aug 2026</div>
            <div>Due 04 Sep 2026</div>
          </div>
        </div>

        <div className="mt-5 flex flex-col border-t">
          <div
            className={`${COLUMNS} border-b py-2 font-mono text-[0.5625rem] tracking-[0.08em] text-muted-foreground uppercase`}
          >
            <span>Item</span>
            <span className="text-right">Qty</span>
            <span className="text-right">Total</span>
          </div>
          {LINES.map((line) => (
            <div
              key={line.item}
              className={`${COLUMNS} border-b border-muted py-[0.45rem] text-[0.6875rem]`}
            >
              <span>{line.item}</span>
              <span className="text-right font-mono text-muted-foreground">
                {line.qty}
              </span>
              <span className="text-right font-mono">{line.total}</span>
            </div>
          ))}
        </div>

        <div className="mt-auto flex items-end justify-between border-t-2 border-[var(--brand)] pt-2.5">
          <span className="text-[0.6875rem] text-muted-foreground">
            Total, VAT incl.
          </span>
          <span className="font-mono text-[1.0625rem] font-semibold text-[var(--brand)]">
            £1031.25
          </span>
        </div>
      </div>
    </div>
  )
}
