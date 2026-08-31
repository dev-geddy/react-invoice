"use client"

import { useState } from "react"
import Link from "next/link"

import { Button } from "@workspace/ui/components/button"

import { confirmEmailChange, type SaveState } from "../../_actions"

/**
 * Confirms a pending email change. The token is proof, but confirmation still
 * runs server-side under the signed-in session (`confirmEmailChange` checks the
 * token belongs to the current user). A button (not auto-run) avoids link
 * prefetch consuming the token.
 */
export function VerifyEmailConfirm({ token }: { token: string }) {
  const [state, setState] = useState<SaveState>(null)
  const [pending, setPending] = useState(false)

  if (!token) {
    return (
      <p className="text-sm text-destructive">
        This link is missing its token. Request the change again from your
        account page.
      </p>
    )
  }

  async function onConfirm() {
    setPending(true)
    setState(await confirmEmailChange(token))
    setPending(false)
  }

  if (state?.ok) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm">{state.message}</p>
        <Button
          render={<Link href="/backflip/account">Back to account</Link>}
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Click below to confirm this address as your new sign-in email.
      </p>
      <div className="flex items-center gap-3">
        <Button onClick={onConfirm} disabled={pending}>
          {pending ? "Confirming…" : "Confirm email change"}
        </Button>
        {state && !state.ok ? (
          <span className="text-sm text-destructive">{state.message}</span>
        ) : null}
      </div>
    </div>
  )
}
