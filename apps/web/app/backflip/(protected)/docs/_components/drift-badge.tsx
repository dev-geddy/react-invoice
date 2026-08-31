import { cn } from "@workspace/ui/lib/utils"

import { BADGE_HELP, BADGE_LABELS, type DriftBadge } from "../_lib/docs-graph"

/**
 * Drift signal on a clause row. Derived on every read (never stored), so a
 * badge disappears the moment the docs or the `@spec` tags catch up.
 */
const TONES: Record<DriftBadge, string> = {
  orphan:
    "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  "no-code": "border-border bg-muted text-muted-foreground",
  "needs-confirm":
    "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  "broken-ref":
    "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-400",
}

export function DriftBadgePill({
  badge,
  className,
}: {
  badge: DriftBadge
  className?: string
}) {
  return (
    <span
      title={BADGE_HELP[badge]}
      className={cn(
        "shrink-0 rounded-full border px-1.5 py-px text-[10px] leading-4 font-medium",
        TONES[badge],
        className
      )}
    >
      {BADGE_LABELS[badge]}
    </span>
  )
}

/** Monospace spec-ID chip. Clickable when `onClick` is passed. */
export function IdChip({
  id,
  onClick,
  className,
}: {
  id: string
  onClick?: () => void
  className?: string
}) {
  const classes = cn(
    "rounded border bg-muted/60 px-1 py-px font-mono text-[10px] leading-4 text-muted-foreground",
    onClick && "hover:border-primary/40 hover:text-foreground",
    className
  )
  if (!onClick) return <span className={classes}>{id}</span>
  return (
    <button type="button" onClick={onClick} className={classes}>
      {id}
    </button>
  )
}
