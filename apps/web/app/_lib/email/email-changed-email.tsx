import { Text } from "@react-email/components"

import { EmailShell, emailText } from "./layout"

export type EmailChangedEmailProps = {
  name?: string | null
  /** The address the account was changed TO. */
  newEmail: string
  appName?: string
}

/**
 * Heads-up sent to the OLD address after an email change is confirmed, so the
 * previous owner is alerted if the change wasn't theirs.
 */
export function EmailChangedEmail({
  name,
  newEmail,
  appName = "Backflip",
}: EmailChangedEmailProps) {
  const greetingName = name?.trim() || "there"

  return (
    <EmailShell
      heading="Your email was changed"
      preview={`The email on your ${appName} account was changed to ${newEmail}.`}
      footerNote={`If you didn’t make this change, contact your ${appName} administrator immediately — someone may have access to your account.`}
    >
      <Text style={emailText}>Hi {greetingName},</Text>
      <Text style={emailText}>
        The email address on your <strong>{appName}</strong> account was just
        changed to <strong>{newEmail}</strong>. You’ll use the new address to
        sign in from now on.
      </Text>
      <Text style={emailText}>
        If you didn’t make this change, contact your administrator right away.
      </Text>
    </EmailShell>
  )
}

export default EmailChangedEmail
