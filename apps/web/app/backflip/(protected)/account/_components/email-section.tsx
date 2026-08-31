"use client"

import { useActionState, useState } from "react"

import { Button } from "@workspace/ui/components/button"
import {
  Field,
  FieldDescription,
  FieldLabel,
} from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import { cn } from "@workspace/ui/lib/utils"

import { requestEmailChange } from "../_actions"

/**
 * Email section. Row + inline-expand change flow presented as a 2-step stepper:
 * (1) Details — confirm current password (step-up) + enter the new address;
 * (2) Verify — we email a confirmation LINK to the new address (the swap is
 * deferred until that link is opened on `/account/verify-email`). No 6-digit
 * codes — the backend is link-based. The "Verified" pill reflects the real
 * `emailVerified` state.
 */
export function AccountEmailSection({
  email,
  emailVerified,
  hasPassword,
}: {
  email: string
  emailVerified: boolean
  hasPassword: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [state, action, pending] = useActionState(requestEmailChange, null)
  const sent = Boolean(state?.ok)

  return (
    <div>
      <div className="flex items-center gap-4">
        <div className="w-32 flex-none text-sm text-muted-foreground">
          Email address
        </div>
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="truncate font-mono text-sm">{email}</span>
          {emailVerified ? (
            <span className="inline-flex flex-none items-center gap-1.5 rounded-md bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
              <span className="size-1.5 rounded-full bg-emerald-500" />
              Verified
            </span>
          ) : (
            <span className="flex-none rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
              Unverified
            </span>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setEditing((v) => !v)}
        >
          {editing ? "Cancel" : "Change email"}
        </Button>
      </div>

      {editing ? (
        <div className="mt-4 rounded-lg border bg-muted/40 p-4">
          <Stepper active={sent ? 2 : 1} />

          {sent ? (
            <div className="mt-4 flex gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950/40">
              <div className="flex size-6 flex-none items-center justify-center rounded-md bg-amber-500 text-xs font-bold text-white">
                !
              </div>
              <div>
                <div className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                  Check your inbox
                </div>
                <p className="mt-1 text-xs leading-relaxed text-amber-800 dark:text-amber-300">
                  {state?.message} Open the link to finish — your email won’t
                  change until you do.
                </p>
              </div>
            </div>
          ) : (
            <form action={action} className="mt-4 flex max-w-sm flex-col gap-4">
              <Field>
                <FieldLabel htmlFor="new-email">New email</FieldLabel>
                <Input
                  id="new-email"
                  name="newEmail"
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="you@example.com"
                />
                <FieldDescription>
                  We’ll send a confirmation link to the new address.
                </FieldDescription>
              </Field>
              {hasPassword ? (
                <Field>
                  <FieldLabel htmlFor="email-current-password">
                    Current password
                  </FieldLabel>
                  <Input
                    id="email-current-password"
                    name="currentPassword"
                    type="password"
                    autoComplete="current-password"
                    required
                  />
                  <FieldDescription>
                    Confirm it’s you before changing your sign-in email.
                  </FieldDescription>
                </Field>
              ) : null}
              <div className="flex items-center gap-3">
                <Button type="submit" disabled={pending}>
                  {pending ? "Sending…" : "Send confirmation link"}
                </Button>
                {state && !state.ok ? (
                  <span className="text-sm text-destructive">
                    {state.message}
                  </span>
                ) : null}
              </div>
            </form>
          )}
        </div>
      ) : null}
    </div>
  )
}

/** Two-step progress header: Details → Verify. */
function Stepper({ active }: { active: 1 | 2 }) {
  const steps = ["Details", "Verify"]
  return (
    <div className="flex items-center gap-2">
      {steps.map((label, i) => {
        const n = (i + 1) as 1 | 2
        const on = active >= n
        return (
          <div key={label} className="flex items-center gap-2">
            <span
              className={cn(
                "flex size-5 items-center justify-center rounded-full text-[11px] font-semibold",
                on
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              )}
            >
              {n}
            </span>
            <span
              className={cn(
                "text-xs font-medium",
                on ? "text-foreground" : "text-muted-foreground"
              )}
            >
              {label}
            </span>
            {i < steps.length - 1 ? (
              <span className="mx-1 h-px w-6 bg-border" />
            ) : null}
          </div>
        )
      })}
    </div>
  )
}
