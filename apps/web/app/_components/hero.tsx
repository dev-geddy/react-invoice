import {
  RiArrowRightLine,
  RiGitForkLine,
  RiGithubLine,
  RiSparkling2Line,
} from "@remixicon/react"

import { InvoicePaperStack } from "./invoice-paper"

// Server Component. Backdrop is a pure CSS stripe texture — no image assets.

/** The claim strip under the CTAs: what it costs, what it runs on. */
const FACTS = [
  "£0 forever",
  "MIT licensed",
  "Your Postgres",
  "Next.js 16 · React 19",
]

export function Hero() {
  return (
    <section
      aria-label="Introduction"
      className="relative overflow-hidden border-b"
    >
      {/* Angled stripe texture — the hero backdrop (no photo). */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-card [background-image:repeating-linear-gradient(135deg,var(--muted)_0_2px,transparent_2px_22px)]"
      />
      {/* Readability overlay: a brand-tinted glow behind the paper, then the
          theme background fading in where the copy sits. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[radial-gradient(70%_60%_at_78%_22%,var(--brand-soft)_0%,transparent_70%),linear-gradient(90deg,var(--background)_0%,var(--background)_30%,transparent_72%),linear-gradient(0deg,var(--background)_2%,transparent_34%)]"
      />

      <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-6 pt-24 pb-26 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
        <div className="max-w-2xl">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--brand-line)] bg-[var(--brand-soft)] px-2 py-0.5 text-[0.625rem] font-medium text-[var(--brand)]">
            <RiSparkling2Line className="size-3.5" aria-hidden="true" />
            Free · MIT · self-hosted
          </span>
          <h1 className="mt-5 text-[clamp(2.5rem,6.4vw,4.25rem)] leading-[1.02] font-bold tracking-tight">
            Invoicing you
            <br />
            own outright.
          </h1>
          <p className="mt-5 max-w-lg text-lg leading-relaxed text-muted-foreground">
            A shared ledger behind your own login, a live preview that{" "}
            <em className="font-medium text-foreground not-italic">is</em> the
            printed document, and an A4 PDF at the end of it. No seats, no
            subscription, no data on someone else&apos;s server.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href="/backflip/login"
              className="inline-flex h-9 items-center gap-1.5 rounded-md bg-[var(--brand)] px-3.5 text-xs font-medium text-[var(--brand-ink)] shadow-sm transition-opacity hover:opacity-90"
            >
              Open the invoice console
              <RiArrowRightLine className="size-4" aria-hidden="true" />
            </a>
            {/* GitHub's /fork route opens the fork dialog (and prompts sign-in
                when signed out) — the closest thing to a one-click fork. */}
            <a
              href="https://github.com/dev-geddy/react-invoice/fork"
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-9 items-center gap-1.5 rounded-md border px-3.5 text-xs font-medium transition-colors hover:bg-muted"
            >
              <RiGitForkLine className="size-4" aria-hidden="true" />
              Fork it, make it yours
            </a>
            <a
              href="/getting-started"
              className="inline-flex h-9 items-center rounded-md px-3.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Getting started
            </a>
          </div>

          <div className="mt-7 flex flex-wrap items-center gap-5 font-mono text-[0.6875rem] tracking-[0.08em] text-muted-foreground uppercase">
            {FACTS.map((fact, index) => (
              /* Separators trail their fact rather than leading the next one:
                 the strip wraps on narrow columns, and a line that opens with a
                 slash reads as a typo. */
              <span key={fact} className="flex items-center gap-5">
                {fact}
                {index < FACTS.length - 1 ? (
                  <span aria-hidden="true" className="text-[var(--brand-line)]">
                    /
                  </span>
                ) : null}
              </span>
            ))}
          </div>

          <a
            href="https://github.com/dev-geddy/react-invoice"
            target="_blank"
            rel="noreferrer"
            className="mt-5 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <RiGithubLine className="size-4" aria-hidden="true" />
            github.com/dev-geddy/react-invoice
          </a>
        </div>

        <InvoicePaperStack />
      </div>
    </section>
  )
}
