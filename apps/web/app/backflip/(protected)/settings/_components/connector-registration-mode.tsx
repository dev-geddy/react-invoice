"use client"

import { useActionState, useState } from "react"

import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"

import { saveDcrMode } from "../_actions"
import type { DcrMode } from "./connectors-integration"

const OPTIONS: { value: DcrMode; title: string; body: string }[] = [
  {
    value: "off",
    title: "Manual clients only — recommended",
    body: "Nobody can create a client without an owner doing it here, in Clients below.",
  },
  {
    value: "allowlist",
    title: "Self-register, allowlisted hosts only",
    body: "A client can register itself, but only if its redirect address lands on the host allowlist below.",
  },
  {
    value: "open",
    title: "Any client may self-register",
    body: "Any client can register itself at the registration endpoint, no allowlist check.",
  },
]

/** Registration-mode picker — how `POST /api/oauth/register` behaves (`L2-MCP-47`). */
export function ConnectorRegistrationMode({ dcrMode }: { dcrMode: DcrMode }) {
  const [state, action, pending] = useActionState(saveDcrMode, null)
  const [selected, setSelected] = useState<DcrMode>(dcrMode)

  return (
    <form action={action} className="flex flex-col gap-4">
      <div>
        <div className="text-[13px] font-semibold">Registration mode</div>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Controls who can create an OAuth client for this connector.
        </p>
      </div>

      <div className="grid gap-2">
        {OPTIONS.map((opt) => {
          const checked = selected === opt.value
          return (
            <label
              key={opt.value}
              htmlFor={`dcr-${opt.value}`}
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors",
                checked
                  ? "border-primary bg-muted/50 ring-1 ring-primary"
                  : "hover:bg-muted/40"
              )}
            >
              <input
                id={`dcr-${opt.value}`}
                type="radio"
                name="dcrMode"
                value={opt.value}
                checked={checked}
                onChange={() => setSelected(opt.value)}
                className="sr-only"
              />
              <span
                className={cn(
                  "mt-0.5 size-4 flex-none rounded-full border",
                  checked ? "border-4 border-primary" : "border-input"
                )}
              />
              <span className="min-w-0">
                <span className="block text-sm font-medium">{opt.title}</span>
                <span className="block text-xs text-muted-foreground">
                  {opt.body}
                </span>
              </span>
            </label>
          )
        })}
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save changes"}
        </Button>
        {state && !state.ok ? (
          <span className="text-sm text-destructive">{state.message}</span>
        ) : null}
      </div>
    </form>
  )
}
