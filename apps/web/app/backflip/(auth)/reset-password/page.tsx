import Link from "next/link"

import { ResetPasswordForm } from "./_components/reset-password-form"

/**
 * /backflip/reset-password — public. Sets a new password from a reset link.
 * The `token` comes from the emailed URL; validity is checked server-side in
 * `resetPassword`. Allowed through the auth gate by the proxy.
 */
export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  const { token } = await searchParams

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted p-6 md:p-10">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <Link
          href="/backflip/login"
          className="flex items-center gap-2 self-center font-medium"
        >
          <div className="flex size-6 items-center justify-center rounded-md bg-primary text-xs font-bold text-primary-foreground">
            b
          </div>
          backflip
        </Link>
        <ResetPasswordForm token={token ?? ""} />
      </div>
    </div>
  )
}
