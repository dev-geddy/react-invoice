"use client"

import { useEffect, useRef, useState } from "react"
import { RiCheckLine, RiFileCopyLine } from "@remixicon/react"

import { Button } from "@workspace/ui/components/button"

/**
 * A labelled, monospaced value with a copy button — for the three strings an
 * owner has to move into Claude's *Add custom connector* dialog: the server
 * URL, the client ID and (once) the client secret.
 *
 * The value stays selectable as well as copyable: the secret is shown exactly
 * once (`L2-MCP-50`), so a failed clipboard write must never be the only way
 * to get it out of the screen.
 *
 * @spec L2-MCP-47, L2-MCP-50
 */
export function ConnectorCopyField({
  label,
  value,
  description,
}: {
  label: string
  value: string
  description?: string
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
      await navigator.clipboard.writeText(value)
    } catch {
      // Clipboard blocked (insecure context, denied permission) — the value is
      // still on screen and `select-all`, so silently leave it to the user.
      return
    }
    setCopied(true)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setCopied(false), 1600)
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <div className="text-[11px] font-medium text-muted-foreground">
          {label}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={copy}
          aria-label={copied ? `${label} copied` : `Copy ${label}`}
          className="h-6 flex-none px-1.5 text-[11px]"
        >
          {copied ? (
            <RiCheckLine aria-hidden="true" className="size-3" />
          ) : (
            <RiFileCopyLine aria-hidden="true" className="size-3" />
          )}
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <code className="mt-1 block rounded-md border bg-card px-2.5 py-2 font-mono text-xs break-all select-all">
        {value}
      </code>
      {description ? (
        <p className="mt-1 text-[11px] text-muted-foreground">{description}</p>
      ) : null}
    </div>
  )
}
