import { Text } from "@react-email/components"

import { EmailShell, FallbackUrl, PrimaryButton, emailText } from "./layout"

export type PasswordResetEmailProps = {
  name?: string | null
  /** Absolute URL to the reset-password page, token in the query. */
  resetUrl: string
  appName?: string
  /** Token lifetime, for the copy (e.g. "60 minutes"). */
  expiresIn?: string
}

/** Sent on a forgot-password request: a single-use link to set a new password. */
export function PasswordResetEmail({
  name,
  resetUrl,
  appName = "Backflip",
  expiresIn = "60 minutes",
}: PasswordResetEmailProps) {
  const greetingName = name?.trim() || "there"

  return (
    <EmailShell
      heading="Reset your password"
      preview={`Reset your ${appName} password — link valid for ${expiresIn}.`}
      footerNote="If you didn’t request a password reset, you can safely ignore this email — your password won’t change."
    >
      <Text style={emailText}>Hi {greetingName},</Text>
      <Text style={emailText}>
        We received a request to reset the password for your {appName} account.
        Click below to choose a new one. This link is valid for {expiresIn}.
      </Text>
      <PrimaryButton href={resetUrl}>Reset password</PrimaryButton>
      <FallbackUrl url={resetUrl} />
    </EmailShell>
  )
}

export default PasswordResetEmail
