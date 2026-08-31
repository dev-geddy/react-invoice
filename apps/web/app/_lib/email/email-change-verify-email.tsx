import { Text } from "@react-email/components"

import { EmailShell, FallbackUrl, PrimaryButton, emailText } from "./layout"

export type EmailChangeVerifyEmailProps = {
  name?: string | null
  /** The pending new address (this email is sent TO it). */
  newEmail: string
  /** Absolute URL to the confirm-email-change page, token in the query. */
  verifyUrl: string
  appName?: string
  expiresIn?: string
}

/**
 * Sent to the PENDING new address on an email-change request. The address only
 * becomes the account login after this link is confirmed.
 */
export function EmailChangeVerifyEmail({
  name,
  newEmail,
  verifyUrl,
  appName = "Backflip",
  expiresIn = "60 minutes",
}: EmailChangeVerifyEmailProps) {
  const greetingName = name?.trim() || "there"

  return (
    <EmailShell
      heading="Confirm your new email"
      preview={`Confirm ${newEmail} as your new ${appName} email.`}
      footerNote="If you didn’t request this change, you can safely ignore this email — your address won’t change."
    >
      <Text style={emailText}>Hi {greetingName},</Text>
      <Text style={emailText}>
        You asked to change the email on your {appName} account to{" "}
        <strong>{newEmail}</strong>. Confirm below to make it your new sign-in
        address. This link is valid for {expiresIn}.
      </Text>
      <PrimaryButton href={verifyUrl}>Confirm new email</PrimaryButton>
      <FallbackUrl url={verifyUrl} />
    </EmailShell>
  )
}

export default EmailChangeVerifyEmail
