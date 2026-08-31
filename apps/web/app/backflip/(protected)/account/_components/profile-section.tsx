"use client"

import { useActionState, useEffect, useState } from "react"

import { Button } from "@workspace/ui/components/button"
import { Field, FieldLabel } from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"

import { saveProfile } from "../_actions"

/** Profile section: display name, self-service. Row + inline-expand edit form. */
export function ProfileSection({ name }: { name: string | null }) {
  const [editing, setEditing] = useState(false)
  const [state, action, pending] = useActionState(saveProfile, null)

  useEffect(() => {
    if (state?.ok) setEditing(false)
  }, [state])

  return (
    <div>
      <div className="flex items-center gap-4">
        <div className="w-32 flex-none text-sm text-muted-foreground">
          Full name
        </div>
        <div className="min-w-0 flex-1 truncate text-sm">
          {name || (
            <span className="text-muted-foreground italic">not set</span>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setEditing((v) => !v)}
        >
          {editing ? "Cancel" : "Edit"}
        </Button>
      </div>

      {editing ? (
        <form
          action={action}
          className="mt-4 flex max-w-sm flex-col gap-4 rounded-lg border bg-muted/40 p-4"
        >
          <Field>
            <FieldLabel htmlFor="account-name">Name</FieldLabel>
            <Input
              id="account-name"
              name="name"
              autoComplete="name"
              placeholder="Your name"
              defaultValue={name ?? ""}
            />
          </Field>
          <div className="flex items-center gap-3">
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save name"}
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
