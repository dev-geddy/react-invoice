"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  RiArrowLeftLine,
  RiArrowRightLine,
  RiLockLine,
  RiRestartLine,
} from "@remixicon/react"

import { Button } from "@workspace/ui/components/button"

import { type StepMeta, WizardStepper } from "./wizard-stepper"

/**
 * Storage can throw (Safari private mode, disabled cookies) — never fatal.
 * The guide still works, it just won't remember.
 */
function readStored(key: string) {
  try {
    return window.sessionStorage.getItem(key)
  } catch {
    return null
  }
}

function writeStored(key: string, value: string) {
  try {
    window.sessionStorage.setItem(key, value)
  } catch {
    // no-op
  }
}

/**
 * Client island shared by the droplet setup wizards: owns the operator's
 * variables and the wizard position, renders one step at a time.
 *
 * Generic over the flavour's variable shape — each guide passes its own steps,
 * empty values and step renderer, so there is one wizard implementation and no
 * per-flavour fork of the navigation, persistence or privacy behaviour.
 *
 * Variables and step index survive a reload via sessionStorage (same tab only),
 * and only the keys in `persisted` are written — secrets are left out by the
 * caller. Storage is read in an effect, after a stable first render, so server
 * and client markup always agree.
 */
export function WizardShell<V extends Record<string, string>>({
  steps,
  emptyVars,
  persisted,
  storageKey,
  renderStep,
}: {
  steps: StepMeta[]
  emptyVars: V
  /** Keys mirrored into sessionStorage. Omit anything secret. */
  persisted: (keyof V)[]
  /** Namespace for this guide's storage entries, e.g. `backflip.setup`. */
  storageKey: string
  renderStep: (args: {
    index: number
    vars: V
    onChange: (key: keyof V, value: string) => void
  }) => React.ReactNode
}) {
  const varsKey = `${storageKey}.vars`
  const stepKey = `${storageKey}.step`
  const lastStep = steps.length - 1

  const [vars, setVars] = useState<V>(emptyVars)
  const [step, setStep] = useState(0)
  const [restored, setRestored] = useState(false)
  const topRef = useRef<HTMLDivElement | null>(null)

  /** Only known string keys are taken back out — storage is untrusted input. */
  const restoreVars = useCallback((): Partial<V> | null => {
    const raw = readStored(varsKey)
    if (!raw) return null
    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch {
      return null
    }
    if (typeof parsed !== "object" || parsed === null) return null
    const record = parsed as Record<string, unknown>
    const out: Partial<V> = {}
    for (const key of persisted) {
      const value = record[key as string]
      if (typeof value === "string") out[key] = value as V[keyof V]
    }
    return out
    // `persisted` is a module-level constant in every caller.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [varsKey])

  const restoreStep = useCallback((): number | null => {
    const raw = readStored(stepKey)
    if (raw === null) return null
    const parsed = Number.parseInt(raw, 10)
    if (!Number.isInteger(parsed)) return null
    return Math.min(Math.max(parsed, 0), lastStep)
  }, [stepKey, lastStep])

  useEffect(() => {
    const storedVars = restoreVars()
    if (storedVars) setVars((current) => ({ ...current, ...storedVars }))
    const storedStep = restoreStep()
    if (storedStep !== null) setStep(storedStep)
    setRestored(true)
  }, [restoreVars, restoreStep])

  useEffect(() => {
    if (!restored) return
    const out: Record<string, string> = {}
    for (const key of persisted) out[key as string] = vars[key] ?? ""
    writeStored(varsKey, JSON.stringify(out))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restored, vars, varsKey])

  useEffect(() => {
    if (!restored) return
    writeStored(stepKey, String(step))
  }, [restored, step, stepKey])

  const onChange = useCallback((key: keyof V, value: string) => {
    setVars((current) => ({ ...current, [key]: value }))
  }, [])

  const goTo = useCallback(
    (index: number) => {
      setStep(Math.min(Math.max(index, 0), lastStep))
      topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
    },
    [lastStep]
  )

  const reset = useCallback(() => {
    try {
      window.sessionStorage.removeItem(varsKey)
      window.sessionStorage.removeItem(stepKey)
    } catch {
      // no-op
    }
    setVars(emptyVars)
    setStep(0)
    topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
  }, [emptyVars, varsKey, stepKey])

  const meta = steps[step]!

  // max-w-6xl matches the site header/hero container width.
  return (
    <div className="mx-auto max-w-6xl px-6 py-14">
      <div ref={topRef} aria-hidden="true" className="scroll-mt-6" />

      <div className="flex items-center justify-between gap-4">
        <p className="font-mono text-xs tracking-[0.08em] text-muted-foreground uppercase">
          Step {step + 1} of {steps.length}
        </p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={reset}
          className="text-muted-foreground"
        >
          <RiRestartLine aria-hidden="true" />
          Reset
        </Button>
      </div>

      <div className="mt-4">
        <WizardStepper steps={steps} current={step} onSelect={goTo} />
      </div>

      <section aria-labelledby="step-title" className="mt-10">
        <h2
          id="step-title"
          className="font-heading text-[1.375rem] font-semibold tracking-tight"
        >
          {meta.title}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {meta.lead}
        </p>
        <div className="mt-6">
          {renderStep({ index: step, vars, onChange })}
        </div>
      </section>

      <div className="mt-10 flex items-center justify-between gap-3 border-t pt-6">
        <Button
          type="button"
          variant="outline"
          onClick={() => goTo(step - 1)}
          disabled={step === 0}
        >
          <RiArrowLeftLine aria-hidden="true" />
          Back
        </Button>
        <p className="font-mono text-xs text-muted-foreground">
          {step + 1} / {steps.length}
        </p>
        <Button
          type="button"
          onClick={() => goTo(step + 1)}
          disabled={step === lastStep}
        >
          Next
          <RiArrowRightLine aria-hidden="true" />
        </Button>
      </div>

      <p className="mt-6 flex items-start gap-2 rounded-lg bg-muted px-3.5 py-3 text-xs leading-relaxed text-muted-foreground">
        <RiLockLine
          className="mt-px size-4 flex-none text-primary"
          aria-hidden="true"
        />
        <span>
          These values stay in this browser tab. The page has no server action
          and makes no network call — your entries and your place in the wizard
          are kept in this tab’s session storage only, dropped when the tab
          closes, and passwords are never stored at all. The only thing that
          leaves is a command you copy yourself.
        </span>
      </p>
    </div>
  )
}
