import { redirect } from "next/navigation"

import { auth } from "@/app/_lib/auth"
import {
  isCredentialsEnabled,
  isGoogleConfigured,
} from "@/app/_lib/auth/config"
import { LoginForm } from "./_components/login-form"

/**
 * /backflip/login — public admin login (credentials + Google).
 * `from` (set by the proxy on redirect) becomes the post-login target,
 * constrained to in-scope paths to avoid open redirects.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>
}) {
  // Already signed in (validity-aware — a revoked token reads as no session)
  // → skip the login page. Kept here (node) since the edge can't check it.
  const session = await auth()
  if (session?.user) redirect("/backflip")

  const { from } = await searchParams
  const callbackUrl = from?.startsWith("/backflip") ? from : "/backflip"

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted p-6 md:p-10">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <div className="flex items-center gap-2 self-center font-medium">
          <div className="flex size-6 items-center justify-center rounded-md bg-primary text-xs font-bold text-primary-foreground">
            b
          </div>
          backflip
        </div>
        <LoginForm
          callbackUrl={callbackUrl}
          credentialsEnabled={isCredentialsEnabled()}
          googleEnabled={isGoogleConfigured()}
        />
      </div>
    </div>
  )
}
