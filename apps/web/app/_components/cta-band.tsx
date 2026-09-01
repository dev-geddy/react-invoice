import { RiGitForkLine } from "@remixicon/react"

/**
 * Closing band: the two things a convinced visitor can do next — fork it, or
 * read how to stand it up. Brand-tinted, striped like the hero so the page
 * ends where it started.
 */
export function CtaBand() {
  return (
    <section
      aria-label="Get started"
      className="relative overflow-hidden border-t bg-[var(--brand-soft)]"
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 [background-image:repeating-linear-gradient(135deg,var(--brand-stripe)_0_2px,transparent_2px_22px)]"
      />
      <div
        aria-hidden="true"
        className="absolute -top-8 -right-12 hidden h-84 w-60 animate-[paper-float-b_12s_ease-in-out_infinite] rounded-sm bg-[var(--brand-paper)] shadow-[0_20px_44px_var(--paper-shadow)] md:block"
      />

      <div className="relative mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-8 px-6 py-18">
        <div className="max-w-xl">
          <h2 className="text-[clamp(1.75rem,3.6vw,2.375rem)] font-bold tracking-tight">
            Free to run. Yours to extend.
          </h2>
          <p className="mt-2.5 text-[0.9375rem] leading-relaxed text-muted-foreground">
            Clone it, point it at your own droplet and database, and send the
            first invoice this afternoon. Everything after that is a feature you
            decide on.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <a
            href="https://github.com/dev-geddy/react-invoice/fork"
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-[var(--brand)] px-3.5 text-xs font-medium text-[var(--brand-ink)] transition-opacity hover:opacity-90"
          >
            <RiGitForkLine className="size-4" aria-hidden="true" />
            Fork the repo
          </a>
          <a
            href="/getting-started"
            className="inline-flex h-9 items-center rounded-md border border-[var(--brand-line)] bg-card px-3.5 text-xs font-medium transition-colors hover:bg-muted"
          >
            Read the setup guide
          </a>
        </div>
      </div>
    </section>
  )
}
