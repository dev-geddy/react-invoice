import type { RemixiconComponentType } from "@remixicon/react"
import {
  RiCodeBoxLine,
  RiFilePdf2Line,
  RiPriceTag3Line,
  RiServerLine,
  RiTeamLine,
} from "@remixicon/react"

/**
 * Why run it yourself — the page's argument, as a numbered ledger of claims.
 * Every line names something that ships in the repo today; nothing here is
 * roadmap.
 */

const POINTS: {
  icon: RemixiconComponentType
  title: string
  body: string
}[] = [
  {
    icon: RiPriceTag3Line,
    title: "Free, and it stays free",
    body: "MIT licensed, no seats, no per-invoice fee, no plan that suddenly needs upgrading when a second person joins.",
  },
  {
    icon: RiServerLine,
    title: "Your server, your database",
    body: "Postgres you run, on a droplet you control. Invoices and customer records never leave infrastructure you can point at.",
  },
  {
    icon: RiTeamLine,
    title: "One shared ledger",
    body: "Every signed-in teammate reads the same book, each invoice recording who raised it. Owner, admin and teammate roles exist before your first feature does.",
  },
  {
    icon: RiFilePdf2Line,
    title: "Print-ready by default",
    body: "Hyphenated series numbering, VAT only when the provider is registered, and a server-rendered A4 PDF named after the invoice.",
  },
  {
    icon: RiCodeBoxLine,
    title: "Ready to be extended",
    body: "It is a real Next.js 16 codebase with docs a coding agent reads before it changes anything. Describe the next feature, review the pull request, deploy.",
  },
]

export function SellingPoints() {
  return (
    <section aria-label="Why self-host it" className="border-b bg-muted">
      <div className="mx-auto max-w-6xl px-6 py-20">
        <div className="mb-9 flex flex-col gap-2">
          <span className="font-mono text-xs tracking-[0.08em] text-[var(--brand)] uppercase">
            Why people run it themselves
          </span>
          <h2 className="text-[clamp(1.625rem,3.4vw,2.125rem)] font-semibold tracking-tight">
            Five reasons this beats another invoicing subscription
          </h2>
          <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
            Everything below ships today, in the repo you clone. Nothing is
            gated, metered or waiting behind a plan upgrade.
          </p>
        </div>

        <ul className="border-t">
          {POINTS.map((point, index) => (
            <li
              key={point.title}
              className="grid items-center gap-x-8 gap-y-2.5 border-b py-6 md:grid-cols-[4rem_minmax(0,1fr)_minmax(0,1.15fr)]"
            >
              <span
                aria-hidden="true"
                className="font-mono text-[2.75rem] leading-none font-semibold text-[color-mix(in_oklab,var(--brand)_22%,transparent)] tabular-nums"
              >
                {String(index + 1).padStart(2, "0")}
              </span>
              <div className="flex items-center gap-2.5">
                <point.icon
                  className="size-5 flex-none text-[var(--brand)]"
                  aria-hidden="true"
                />
                <h3 className="text-[1.0625rem] font-semibold">
                  {point.title}
                </h3>
              </div>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {point.body}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
