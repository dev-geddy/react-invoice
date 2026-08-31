import { Card } from "@workspace/ui/components/card"

import { requireCapability } from "@/app/_lib/auth/guard"
import { VerifyEmailConfirm } from "./_components/verify-email-confirm"

/**
 * /backflip/account/verify-email — target of the email-change verification link.
 * Protected (capability `account`): the signed-in user confirms the pending
 * address. The actual swap + old-address notice happens in `confirmEmailChange`.
 */
export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  await requireCapability("account")
  const { token } = await searchParams

  return (
    <div className="mx-auto w-full max-w-md">
      <Card className="flex flex-col gap-4 p-6">
        <h2 className="text-lg font-semibold">Confirm email change</h2>
        <VerifyEmailConfirm token={token ?? ""} />
      </Card>
    </div>
  )
}
