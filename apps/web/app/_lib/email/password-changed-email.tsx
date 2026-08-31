import { Text } from "@react-email/components"

import { EmailShell, PrimaryButton, emailText } from "./layout"

export type PasswordChangedEmailProps = {
  name?: string | null
  /** Absolute URL to the admin sign-in page. */
  loginUrl: string
  appName?: string
}

/**
 * Security notice sent after a password is changed (self-service or via reset).
 * No link is required to act, but we surface sign-in and a "wasn't me" note.
 */
export function PasswordChangedEmail({
  name,
  loginUrl,
  appName = "Backflip",
}: PasswordChangedEmailProps) {
  const greetingName = name?.trim() || "there"

  return (
    <EmailShell
      heading="Your password was changed"
      preview={`The password for your ${appName} account was just changed.`}
      footerNote={`If you didn’t make this change, your account may be compromised — contact your ${appName} administrator immediately.`}
    >
      <Text style={emailText}>Hi {greetingName},</Text>
      <Text style={emailText}>
        The password for your <strong>{appName}</strong> account was just
        changed. If this was you, no further action is needed.
      </Text>
      <Text style={emailText}>
        If you didn’t change your password, contact your administrator right
        away.
      </Text>
      <PrimaryButton href={loginUrl}>Go to sign in</PrimaryButton>
    </EmailShell>
  )
}

export default PasswordChangedEmail
