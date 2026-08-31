"use client"

import { RiCursorLine, RiExternalLinkLine } from "@remixicon/react"

export type Guidance = {
  title: string
  /** One paragraph per entry. Two to four short sentences in total. */
  body: React.ReactNode[]
  /** Optional deep link into the DigitalOcean control panel. */
  link?: { href: string; label: string }
  /** Optional trailing block — a copyable command, a caveat callout. */
  extra?: React.ReactNode
}

/**
 * The variables-step guidance panel: what the focused field is and where to get
 * its value. Driven purely by focus — the caller keeps the last focused key
 * after a blur, so the panel never blanks out mid-typing.
 */
export function GuidancePanel({ guidance }: { guidance: Guidance | null }) {
  // `lg:top-20` clears the sticky site header (h-14) once the panel pins.
  return (
    <aside className="rounded-xl border bg-card px-4 py-4 lg:sticky lg:top-20">
      <p className="font-mono text-[11px] tracking-[0.08em] text-muted-foreground uppercase">
        What this needs
      </p>

      <div aria-live="polite" className="mt-3">
        {guidance ? (
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium">{guidance.title}</p>
            {guidance.body.map((paragraph, i) => (
              <p
                key={i}
                className="text-sm leading-relaxed text-muted-foreground"
              >
                {paragraph}
              </p>
            ))}
            {guidance.extra ? (
              <div className="mt-1">{guidance.extra}</div>
            ) : null}
            {guidance.link ? (
              <a
                href={guidance.link.href}
                target="_blank"
                rel="noreferrer"
                className="mt-1 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
              >
                {guidance.link.label}
                <RiExternalLinkLine className="size-3.5" aria-hidden="true" />
              </a>
            ) : null}
          </div>
        ) : (
          <p className="flex items-start gap-2 text-sm leading-relaxed text-muted-foreground">
            <RiCursorLine
              className="mt-0.5 size-4 flex-none text-primary"
              aria-hidden="true"
            />
            <span>Click into a field to see what it needs.</span>
          </p>
        )}
      </div>
    </aside>
  )
}
