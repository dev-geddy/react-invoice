import { AnalyticsGate } from "./analytics-gate"
import { AppVersion } from "./app-version"

/**
 * Public-site footer. Also the mount point for `AnalyticsGate` — this footer is
 * the one piece of chrome every public page renders and no admin page does, so
 * it scopes analytics + the cookie banner to the public surface (`L1-ARCH-01`)
 * without touching the shared root layout.
 */
export function SiteFooter() {
  return (
    <footer className="border-t">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-5 px-6 py-10">
        <a
          href="/"
          className="flex items-center gap-2 text-[0.9375rem] font-bold tracking-tight"
        >
          <span className="inline-flex size-5 items-center justify-center rounded-md border bg-card">
            <svg
              width="11"
              height="11"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              className="text-primary"
            >
              <path d="M12 3v7" />
              <path d="M6 8a7 7 0 1 0 12 0" />
            </svg>
          </span>
          Backflip
        </a>
        <nav
          aria-label="Footer"
          className="flex flex-wrap gap-5 text-sm text-muted-foreground"
        >
          <a href="/getting-started" className="hover:text-foreground">
            Getting started
          </a>
          <a href="/backflip" className="hover:text-foreground">
            Admin
          </a>
        </nav>
        <p className="flex items-baseline gap-2 text-[0.8125rem] text-muted-foreground">
          © {new Date().getFullYear()} Backflip
          <AppVersion />
        </p>
      </div>
      <AnalyticsGate />
    </footer>
  )
}
