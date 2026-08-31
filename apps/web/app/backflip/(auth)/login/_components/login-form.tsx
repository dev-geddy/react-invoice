"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"

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
  FieldSeparator,
} from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import { cn } from "@workspace/ui/lib/utils"
import { signIn } from "next-auth/react"

function GoogleButton({ callbackUrl }: { callbackUrl: string }) {
  return (
    <Button
      variant="outline"
      type="button"
      onClick={() => signIn("google", { callbackUrl })}
    >
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
        <path
          d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"
          fill="currentColor"
        />
      </svg>
      Continue with Google
    </Button>
  )
}

export function LoginForm({
  callbackUrl = "/backflip",
  credentialsEnabled = true,
  googleEnabled = false,
  className,
  ...props
}: React.ComponentProps<"div"> & {
  callbackUrl?: string
  credentialsEnabled?: boolean
  googleEnabled?: boolean
}) {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError(null)
    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
    })
    setLoading(false)
    if (res?.error) {
      setError("Invalid email or password.")
      return
    }
    router.push(callbackUrl)
    router.refresh()
  }

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Welcome back</CardTitle>
          <CardDescription>
            {credentialsEnabled
              ? "Sign in to the admin console"
              : "Sign in to the admin console with Google"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!credentialsEnabled ? (
            <FieldGroup>
              {googleEnabled ? (
                <Field>
                  <GoogleButton callbackUrl={callbackUrl} />
                </Field>
              ) : (
                <FieldDescription className="text-center text-destructive">
                  No sign-in method is configured. Set up Google or enable
                  password login.
                </FieldDescription>
              )}
            </FieldGroup>
          ) : (
            <form onSubmit={onSubmit}>
              <FieldGroup>
                {googleEnabled ? (
                  <>
                    <Field>
                      <GoogleButton callbackUrl={callbackUrl} />
                    </Field>
                    <FieldSeparator className="*:data-[slot=field-separator-content]:bg-card">
                      Or continue with
                    </FieldSeparator>
                  </>
                ) : null}
                <Field>
                  <FieldLabel htmlFor="email">Email</FieldLabel>
                  <Input
                    id="email"
                    type="email"
                    placeholder="m@example.com"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </Field>
                <Field>
                  <div className="flex items-center justify-between">
                    <FieldLabel htmlFor="password">Password</FieldLabel>
                    <Link
                      href="/backflip/forgot-password"
                      className="text-sm text-muted-foreground underline-offset-4 hover:underline"
                    >
                      Forgot password?
                    </Link>
                  </div>
                  <Input
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </Field>
                {error ? (
                  <FieldDescription className="text-center text-destructive">
                    {error}
                  </FieldDescription>
                ) : null}
                <Field>
                  <Button type="submit" disabled={loading}>
                    {loading ? "Signing in…" : "Sign in"}
                  </Button>
                </Field>
              </FieldGroup>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
