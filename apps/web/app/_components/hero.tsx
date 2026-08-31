import {
  RiArrowRightLine,
  RiGitForkLine,
  RiGithubLine,
  RiSparkling2Line,
} from "@remixicon/react"

import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"

// Server Component. Backdrop is a pure CSS stripe texture — no image assets.
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
      {/* Readability overlay — fades to the theme background where the copy sits. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[linear-gradient(90deg,var(--background)_0%,var(--background)_34%,transparent_82%),linear-gradient(0deg,var(--background)_2%,transparent_34%)]"
      />

      <div className="relative mx-auto max-w-6xl px-6 pt-24 pb-26">
        <div className="max-w-2xl">
          <Badge variant="outline" className="gap-1.5 rounded-full">
            <RiSparkling2Line
              className="size-3.5 text-primary"
              aria-hidden="true"
            />
            Self-hosted invoicing
          </Badge>
          <h1 className="mt-5 text-[clamp(2.5rem,6.4vw,4.25rem)] leading-[1.02] font-bold tracking-tight">
            Invoices, behind
            <br />
            your own login.
          </h1>
          <p className="mt-5 max-w-lg text-lg leading-relaxed text-muted-foreground">
            One shared ledger for your team: every invoice readable by everyone,
            each one recording who raised it. Write it, watch the preview, print
            it. Self-hosted on a foundation you own — data included.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button size="lg" render={<a href="/backflip/login" />}>
              Open the invoice console
              <RiArrowRightLine className="size-4" aria-hidden="true" />
            </Button>
            <Button
              variant="outline"
              size="lg"
              render={<a href="/getting-started" />}
            >
              Getting started
            </Button>
            {/* GitHub's /fork route opens the fork dialog (and prompts sign-in
                when signed out) — the closest thing to a one-click fork. */}
            <Button
              variant="outline"
              size="lg"
              render={
                <a
                  href="https://github.com/dev-geddy/react-invoice/fork"
                  target="_blank"
                  rel="noreferrer"
                />
              }
            >
              <RiGitForkLine className="size-4" aria-hidden="true" />
              Fork it, make it yours
            </Button>
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
      </div>
    </section>
  )
}
