import type { ReactNode } from "react"

/**
 * Flat page heading: large tracking-tight title over a muted subtitle. Matches
 * the content-title pattern of the Flat Admin design (breadcrumb in the header,
 * a larger title leading the page body). Optional `action` sits at the trailing
 * edge for page-level buttons.
 */
export function PageHeading({
  title,
  description,
  action,
}: {
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
        {description ? (
          <p className="text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {action ? <div className="flex-none">{action}</div> : null}
    </div>
  )
}

/** Uppercase micro-label used above grouped sections and card headers. */
export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
      {children}
    </div>
  )
}
