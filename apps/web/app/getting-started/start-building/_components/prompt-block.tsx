"use client"

import { useEffect, useRef, useState } from "react"
import { RiCheckLine, RiFileCopyLine } from "@remixicon/react"

import { Button } from "@workspace/ui/components/button"

/**
 * A copy-to-clipboard prompt card: prose meant to be pasted into a coding
 * agent, so it wraps (no horizontal scroll, no shell gutter) unlike the
 * terminal-styled CommandBlock of the setup wizard.
 */
export function PromptBlock({ label, text }: { label: string; text: string }) {
  const [copied, setCopied] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [])

  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      return
    }
    setCopied(true)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setCopied(false), 1600)
  }

  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <div className="flex items-center justify-between gap-3 border-b bg-muted/50 py-1.5 pr-1.5 pl-3.5">
        <span className="font-mono text-[11px] tracking-[0.08em] text-muted-foreground uppercase">
          {label}
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={copy}
          aria-label={copied ? "Copied to clipboard" : "Copy to clipboard"}
          className="flex-none"
        >
          {copied ? (
            <RiCheckLine aria-hidden="true" />
          ) : (
            <RiFileCopyLine aria-hidden="true" />
          )}
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <p className="p-3.5 font-mono text-[0.8125rem] leading-relaxed whitespace-pre-wrap">
        {text}
      </p>
    </div>
  )
}
