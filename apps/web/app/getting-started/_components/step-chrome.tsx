import { RiInformationLine, RiTerminalBoxLine } from "@remixicon/react"

/** Inline code token used throughout the guide copy. */
export function Mono({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.8125em]">
      {children}
    </code>
  )
}

/** A caveat or follow-up remark under a command block. */
export function Note({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-2 text-sm leading-relaxed text-muted-foreground">
      <RiInformationLine
        className="mt-0.5 size-4 flex-none text-primary"
        aria-hidden="true"
      />
      <span>{children}</span>
    </p>
  )
}

/** Where a command box is meant to be executed. Sits directly above the box. */
export function RunOn({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-center gap-1.5 font-mono text-[11px] tracking-[0.08em] text-muted-foreground uppercase">
      <RiTerminalBoxLine
        className="size-3.5 flex-none text-primary"
        aria-hidden="true"
      />
      Run on: {children}
    </p>
  )
}

/** Bordered card whose children are `ChecklistRow`s or `EnvRow`s. */
export function RowCard({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={
        "divide-y overflow-hidden rounded-lg border bg-card" +
        (className ? ` ${className}` : "")
      }
    >
      {children}
    </div>
  )
}

/** One "term — explanation" row inside a `RowCard`. */
export function ChecklistRow({
  term,
  children,
}: {
  term: string
  children: React.ReactNode
}) {
  return (
    <div className="px-4 py-3.5 text-sm leading-relaxed text-muted-foreground">
      <span className="font-medium text-foreground">{term}</span> — {children}
    </div>
  )
}

/** One env-variable row: the keys and their file on the left, why on the right. */
export function EnvRow({
  fields,
  file,
  children,
}: {
  fields: string
  file: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5 px-4 py-3.5 sm:flex-row sm:items-baseline sm:gap-4">
      <div className="flex min-w-0 flex-col gap-1 sm:w-64 sm:flex-none">
        <span className="font-mono text-xs break-all text-foreground">
          {fields}
        </span>
        <span className="font-mono text-[11px] text-muted-foreground">
          {file}
        </span>
      </div>
      <div className="min-w-0 flex-1 text-sm leading-relaxed text-muted-foreground">
        {children}
      </div>
    </div>
  )
}

/** Section divider inside a step body, with an uppercase micro-heading. */
export function SubSection({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-3 border-t pt-4">
      <p className="font-mono text-xs tracking-[0.08em] text-muted-foreground uppercase">
        {title}
      </p>
      {children}
    </div>
  )
}
