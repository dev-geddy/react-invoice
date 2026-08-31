"use client"

import { useActionState } from "react"
import Link from "next/link"

import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"

import { resetPassword } from "../../_actions"

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(resetPassword, null)

  if (!token) {
    return (
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Invalid link</CardTitle>
          <CardDescription>
            This reset link is missing its token.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          <Button
            variant="outline"
            render={
              <Link href="/backflip/forgot-password">Request a new link</Link>
            }
          />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-xl">Set a new password</CardTitle>
        <CardDescription>
          Choose a strong password you’ll remember.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {state?.ok ? (
          <div className="flex flex-col gap-4 text-center">
            <p className="text-sm text-muted-foreground">{state.message}</p>
            <Button
              render={<Link href="/backflip/login">Go to sign in</Link>}
            />
          </div>
        ) : (
          <form action={action}>
            <input type="hidden" name="token" value={token} />
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="new-password">New password</FieldLabel>
                <Input
                  id="new-password"
                  name="newPassword"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="confirm-password">
                  Confirm new password
                </FieldLabel>
                <Input
                  id="confirm-password"
                  name="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                />
              </Field>
              {state && !state.ok ? (
                <FieldDescription className="text-center text-destructive">
                  {state.message}
                </FieldDescription>
              ) : null}
              <Field>
                <Button type="submit" disabled={pending}>
                  {pending ? "Saving…" : "Reset password"}
                </Button>
              </Field>
            </FieldGroup>
          </form>
        )}
      </CardContent>
    </Card>
  )
}
