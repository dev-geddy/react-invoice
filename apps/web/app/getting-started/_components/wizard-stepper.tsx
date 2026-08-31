"use client"

import { RiCheckLine } from "@remixicon/react"

import { cn } from "@workspace/ui/lib/utils"

export type StepMeta = {
  id: string
  /** Full heading, shown above the step body. */
  title: string
  /** Stepper label — one or two words. */
  short: string
  /** One to two sentences of context. */
  lead: string
}

/**
 * Numbered progress indicator. Every dot is clickable — the guide is a reading
 * order, not a gate, so revisiting a step must never be blocked.
 *
 * Below `sm` each item is only as wide as its dot (labels are hidden there), so
 * six dots plus connectors still fit a 320px viewport without horizontal scroll
 * (`L2-UI-16`).
 */
export function WizardStepper({
  steps,
  current,
  onSelect,
}: {
  steps: StepMeta[]
  current: number
  onSelect: (index: number) => void
}) {
  return (
    <nav aria-label="Setup steps">
      <ol className="flex items-start">
        {steps.map((step, i) => {
          const done = i < current
          const active = i === current
          return (
            <li
              key={step.id}
              className={cn(
                "flex items-start",
                i < steps.length - 1 && "min-w-0 flex-1"
              )}
            >
              <button
                type="button"
                onClick={() => onSelect(i)}
                aria-current={active ? "step" : undefined}
                className="group flex w-9 flex-none cursor-pointer flex-col items-center gap-1.5 text-center sm:w-20"
              >
                <span
                  className={cn(
                    "flex size-9 flex-none items-center justify-center rounded-full border font-mono text-xs font-semibold transition-colors",
                    active &&
                      "border-primary bg-primary text-primary-foreground",
                    done && "border-primary/40 bg-primary/10 text-primary",
                    !active &&
                      !done &&
                      "bg-card text-muted-foreground group-hover:border-primary/40 group-hover:text-foreground"
                  )}
                >
                  {done ? (
                    <RiCheckLine className="size-4" aria-hidden="true" />
                  ) : (
                    String(i + 1).padStart(2, "0")
                  )}
                  <span className="sr-only">
                    Step {i + 1}: {step.title}
                    {done ? " (completed)" : ""}
                  </span>
                </span>
                <span
                  aria-hidden="true"
                  className={cn(
                    "hidden text-[11px] leading-tight sm:block",
                    active ? "text-foreground" : "text-muted-foreground"
                  )}
                >
                  {step.short}
                </span>
              </button>
              {i < steps.length - 1 ? (
                <span
                  aria-hidden="true"
                  className={cn(
                    "mt-[18px] h-px min-w-2 flex-1",
                    done ? "bg-primary/40" : "bg-border"
                  )}
                />
              ) : null}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
