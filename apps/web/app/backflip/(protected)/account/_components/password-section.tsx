"use client"

import { useActionState, useEffect, useState } from "react"

import { toast } from "sonner"

import { Button } from "@workspace/ui/components/button"
import { Field, FieldLabel } from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import { cn } from "@workspace/ui/lib/utils"

import { changePassword } from "../_actions"

/**
 * Client-only strength heuristic (no backend, no dep). Score 0–4 from length +
 * character-class variety. Server still enforces the real rule (min 8 + match).
 */
function strength(pw: string): { score: 0 | 1 | 2 | 3 | 4; label: string } {
  if (!pw) return { score: 0, label: "" }
  let s = 0
  if (pw.length >= 8) s++
  if (pw.length >= 12) s++
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++
  if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) s++
  const score = Math.min(s, 4) as 0 | 1 | 2 | 3 | 4
  const label = ["Too short", "Weak", "Fair", "Good", "Strong"][score]!
  return { score, label }
}

const BAR_COLOR = [
  "bg-transparent",
  "bg-red-500",
  "bg-amber-500",
  "bg-emerald-500",
  "bg-emerald-600",
]

/**
 * Password section. Row + inline-expand form. Change requires the current
 * password (when one is set); a live strength meter reflects the typed value.
 * On success a "password changed" email is sent server-side and other sessions
 * are invalidated.
 */
export function PasswordSection({ hasPassword }: { hasPassword: boolean }) {
  const [editing, setEditing] = useState(false)
  const [pw, setPw] = useState("")
  const [show, setShow] = useState(false)
  const [state, action, pending] = useActionState(changePassword, null)

  useEffect(() => {
    if (state?.ok) {
      toast.success(state.message)
      setEditing(false)
      setPw("")
    }
  }, [state])

  const st = strength(pw)

  return (
    <div>
      <div className="flex items-center gap-4">
        <div className="w-32 flex-none text-sm text-muted-foreground">
          Password
        </div>
        <div className="min-w-0 flex-1 text-sm">
          {hasPassword ? (
            <span className="tracking-widest text-muted-foreground">
              ••••••••••
            </span>
          ) : (
            <span className="text-muted-foreground italic">not set</span>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setEditing((v) => !v)}
        >
          {editing
            ? "Cancel"
            : hasPassword
              ? "Change password"
              : "Set password"}
        </Button>
      </div>

      {editing ? (
        <form
          action={action}
          className="mt-4 flex max-w-sm flex-col gap-4 rounded-lg border bg-muted/40 p-4"
        >
          {hasPassword ? (
            <Field>
              <FieldLabel htmlFor="current-password">
                Current password
              </FieldLabel>
              <Input
                id="current-password"
                name="currentPassword"
                type="password"
                autoComplete="current-password"
                required
              />
            </Field>
          ) : null}
          <Field>
            <FieldLabel htmlFor="new-password">New password</FieldLabel>
            <Input
              id="new-password"
              name="newPassword"
              type={show ? "text" : "password"}
              autoComplete="new-password"
              required
              minLength={8}
              value={pw}
              onChange={(e) => setPw(e.target.value)}
            />
            {pw ? (
              <div className="mt-1 flex items-center gap-2">
                <div className="flex h-1 flex-1 gap-1">
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className={cn(
                        "h-full flex-1 rounded-full",
                        i <= st.score ? BAR_COLOR[st.score] : "bg-muted"
                      )}
                    />
                  ))}
                </div>
                <span className="w-14 text-right text-xs font-medium text-muted-foreground">
                  {st.label}
                </span>
              </div>
            ) : null}
          </Field>
          <Field>
            <FieldLabel htmlFor="confirm-password">
              Confirm new password
            </FieldLabel>
            <Input
              id="confirm-password"
              name="confirmPassword"
              type={show ? "text" : "password"}
              autoComplete="new-password"
              required
              minLength={8}
            />
          </Field>
          <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={show}
              onChange={(e) => setShow(e.target.checked)}
              className="size-3.5 accent-primary"
            />
            Show passwords
          </label>
          <div className="flex items-center gap-3">
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Update password"}
            </Button>
            {state && !state.ok ? (
              <span className="text-sm text-destructive">{state.message}</span>
            ) : null}
          </div>
        </form>
      ) : null}
    </div>
  )
}
