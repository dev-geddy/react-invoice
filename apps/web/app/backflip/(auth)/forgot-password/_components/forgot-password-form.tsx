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

import { requestPasswordReset } from "../../_actions"

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState(requestPasswordReset, null)

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-xl">Forgot your password?</CardTitle>
        <CardDescription>
          Enter your email and we’ll send a reset link.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {state?.ok ? (
          <div className="flex flex-col gap-4 text-center">
            <p className="text-sm text-muted-foreground">{state.message}</p>
            <Button
              variant="outline"
              render={<Link href="/backflip/login">Back to sign in</Link>}
            />
          </div>
        ) : (
          <form action={action}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="email">Email</FieldLabel>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="m@example.com"
                  autoComplete="email"
                  required
                />
              </Field>
              {state && !state.ok ? (
                <FieldDescription className="text-center text-destructive">
                  {state.message}
                </FieldDescription>
              ) : null}
              <Field>
                <Button type="submit" disabled={pending}>
                  {pending ? "Sending…" : "Send reset link"}
                </Button>
                <FieldDescription className="text-center">
                  <Link href="/backflip/login">Back to sign in</Link>
                </FieldDescription>
              </Field>
            </FieldGroup>
          </form>
        )}
      </CardContent>
    </Card>
  )
}
