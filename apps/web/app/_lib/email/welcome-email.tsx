import { Text } from "@react-email/components"

import { EmailShell, FallbackUrl, PrimaryButton, emailText } from "./layout"

export type WelcomeEmailProps = {
  /** Recipient display name; falls back to a neutral greeting when absent. */
  name?: string | null
  /** Absolute URL to the admin sign-in page. */
  loginUrl: string
  /** Product/brand name shown in the copy (from Resend "from name"). */
  appName?: string
}

/**
 * Transactional welcome email sent when an owner adds a new user.
 * GitHub-style shell (`EmailShell`) with a single green CTA to sign in.
 */
export function WelcomeEmail({
  name,
  loginUrl,
  appName = "Backflip",
}: WelcomeEmailProps) {
  const greetingName = name?.trim() || "there"

  return (
    <EmailShell
      heading={`Welcome to ${appName}`}
      preview={`Your ${appName} account is ready — sign in to get started.`}
      footerNote={`You’re receiving this email because an account was created for you on ${appName}. If you weren’t expecting it, you can safely ignore this message.`}
    >
      <Text style={emailText}>Hi {greetingName},</Text>
      <Text style={emailText}>
        An account has just been created for you on <strong>{appName}</strong>.
        You now have access to the admin dashboard — sign in to get started.
      </Text>
      <PrimaryButton href={loginUrl}>Sign in to {appName}</PrimaryButton>
      <FallbackUrl url={loginUrl} />
    </EmailShell>
  )
}

export default WelcomeEmail
