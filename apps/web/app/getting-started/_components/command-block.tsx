"use client"

import { useEffect, useRef, useState } from "react"
import { RiCheckLine, RiFileCopyLine } from "@remixicon/react"

import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"

/** Splits on `<placeholder>` tokens, keeping them as their own parts. */
const PLACEHOLDER = /(<[^<>\n]+>)/g

function isPlaceholder(part: string) {
  return part.startsWith("<") && part.endsWith(">")
}

function Tokens({ text }: { text: string }) {
  return (
    <>
      {text.split(PLACEHOLDER).map((part, i) =>
        isPlaceholder(part) ? (
          <span
            key={i}
            className="rounded bg-primary/10 px-1 text-primary ring-1 ring-primary/20 ring-inset"
          >
            {part}
          </span>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  )
}

/**
 * A copy-to-clipboard terminal block. `lines` are joined with newlines for the
 * clipboard; `<placeholder>` tokens are highlighted so a missing variable is
 * obvious instead of rendering as a gap.
 */
export function CommandBlock({
  lines,
  label,
  prompt = true,
  compact = false,
  className,
}: {
  lines: string[]
  label?: string
  /** Show the `$` shell prompt gutter. Off for file snippets. */
  prompt?: boolean
  /** Narrow columns (the step-1 guidance panel): wrap instead of scrolling,
   * icon-only copy button. */
  compact?: boolean
  className?: string
}) {
  const [copied, setCopied] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [])

  async function copy() {
    try {
      await navigator.clipboard.writeText(lines.join("\n"))
    } catch {
      return
    }
    setCopied(true)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setCopied(false), 1600)
  }

  return (
    <div className={cn("overflow-hidden rounded-lg border bg-card", className)}>
      {label ? (
        <div className="border-b bg-muted/50 px-3.5 py-1.5 font-mono text-[11px] tracking-[0.08em] text-muted-foreground uppercase">
          {label}
        </div>
      ) : null}
      <div
        className={cn("flex items-start gap-2 p-3", compact && "gap-1.5 p-2")}
      >
        <pre
          className={cn(
            "min-w-0 flex-1 py-0.5 font-mono text-[0.8125rem] leading-relaxed",
            compact ? "whitespace-pre-wrap" : "overflow-x-auto"
          )}
        >
          <code>
            {lines.map((line, i) => (
              <span
                key={i}
                className={cn(
                  "block",
                  compact ? "break-all whitespace-pre-wrap" : "whitespace-pre"
                )}
              >
                {prompt ? (
                  <span
                    aria-hidden="true"
                    className="mr-2 inline-block text-muted-foreground/50 select-none"
                  >
                    $
                  </span>
                ) : null}
                <Tokens text={line} />
              </span>
            ))}
          </code>
        </pre>
        <Button
          variant="outline"
          size={compact ? "icon-sm" : "sm"}
          onClick={copy}
          aria-label={copied ? "Copied to clipboard" : "Copy to clipboard"}
          className="flex-none"
        >
          {copied ? (
            <RiCheckLine aria-hidden="true" />
          ) : (
            <RiFileCopyLine aria-hidden="true" />
          )}
          {compact ? null : copied ? "Copied" : "Copy"}
        </Button>
      </div>
    </div>
  )
}
