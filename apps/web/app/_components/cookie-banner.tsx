"use client"

import { Button } from "@workspace/ui/components/button"

/**
 * Consent bar pinned to the bottom of the viewport. Presentational only — the
 * decision (and everything it gates) lives in `AnalyticsGate`.
 */
export function CookieBanner({
  text,
  onAccept,
  onDecline,
}: {
  text: string
  onAccept: () => void
  onDecline: () => void
}) {
  return (
    <div
      role="region"
      aria-label="Cookie consent"
      className="fixed inset-x-0 bottom-0 z-50 p-3 sm:p-4"
    >
      <div className="mx-auto flex max-w-3xl flex-col gap-3 rounded-xl border bg-card p-4 shadow-lg sm:flex-row sm:items-center sm:gap-4">
        <p className="flex-1 text-sm leading-relaxed text-muted-foreground">
          {text}
        </p>
        <div className="flex flex-none gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onDecline}>
            Decline
          </Button>
          <Button type="button" size="sm" onClick={onAccept}>
            Accept
          </Button>
        </div>
      </div>
    </div>
  )
}
