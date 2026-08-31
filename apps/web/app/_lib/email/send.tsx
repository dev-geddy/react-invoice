import { db, decryptSecret, emailConfig } from "@workspace/db"
import { render } from "@react-email/components"
import { eq } from "drizzle-orm"
import { Resend } from "resend"

import { EmailChangedEmail } from "./email-changed-email"
import { EmailChangeVerifyEmail } from "./email-change-verify-email"
import { PasswordChangedEmail } from "./password-changed-email"
import { PasswordResetEmail } from "./password-reset-email"
import { WelcomeEmail } from "./welcome-email"

/**
 * Transactional email send layer: one soft-failing Resend core + per-event
 * send functions. Templates live in the sibling `*-email.tsx` files.
 *
 * @spec L2-EMAIL-11, L2-EMAIL-13, L2-EMAIL-16
 */

/**
 * Result of a send attempt. `not_configured` is a soft outcome (never an error):
 * Resend is disabled, keyless, or missing a from-address. Callers treat it as a
 * non-fatal info state — sending is optional infrastructure. (`L2-EMAIL-13`)
 */
export type SendResult =
  | { sent: true; id: string | null }
  | { sent: false; reason: "not_configured"; message: string }
  | { sent: false; reason: "error"; message: string }

const NOT_CONFIGURED_MESSAGE =
  "Email sending is not configured — no email sent."

/** Base URL of this deployment, used to build absolute links in emails. */
export function appUrl() {
  const raw =
    process.env.APP_URL ??
    process.env.AUTH_URL ??
    process.env.NEXTAUTH_URL ??
    "http://localhost:3070"
  return raw.replace(/\/$/, "")
}

/** Resolved brand name for subjects/copy (Resend "from name" or default). */
function appName(cfg: { fromName: string | null }) {
  return cfg.fromName?.trim() || "Backflip"
}

/**
 * Shared send core: reads the single Resend `email_config` row, decrypts the
 * key server-side (`L2-DB-16`), renders the react-email element to HTML, and
 * sends. Never throws — an unconfigured provider returns `not_configured` and
 * any failure returns `error`, so callers are never blocked by email.
 * (`L2-EMAIL-13`)
 */
async function send(
  build: (ctx: { appName: string }) => {
    subject: string
    react: React.ReactElement
    to: string
  }
): Promise<SendResult> {
  const [cfg] = await db
    .select()
    .from(emailConfig)
    .where(eq(emailConfig.provider, "resend"))

  // Soft "not configured": disabled, no key, or no verified sender address.
  if (!cfg || !cfg.enabled || !cfg.apiKeyEnc || !cfg.fromEmail) {
    return {
      sent: false,
      reason: "not_configured",
      message: NOT_CONFIGURED_MESSAGE,
    }
  }

  try {
    const resend = new Resend(decryptSecret(cfg.apiKeyEnc))
    const { subject, react, to } = build({ appName: appName(cfg) })
    const html = await render(react)
    const from = cfg.fromName
      ? `${cfg.fromName} <${cfg.fromEmail}>`
      : cfg.fromEmail

    const { data, error } = await resend.emails.send({
      from,
      to,
      subject,
      html,
      ...(cfg.replyTo ? { replyTo: cfg.replyTo } : {}),
    })

    if (error) {
      return { sent: false, reason: "error", message: error.message }
    }
    return { sent: true, id: data?.id ?? null }
  } catch (e) {
    return {
      sent: false,
      reason: "error",
      message: e instanceof Error ? e.message : "Failed to send email",
    }
  }
}

/** Welcome email — sent when an owner adds a new user. */
export function sendWelcomeEmail(params: {
  to: string
  name?: string | null
}): Promise<SendResult> {
  const loginUrl = `${appUrl()}/backflip/login`
  return send(({ appName }) => ({
    to: params.to,
    subject: `Welcome to ${appName}`,
    react: (
      <WelcomeEmail name={params.name} loginUrl={loginUrl} appName={appName} />
    ),
  }))
}

/** Forgot-password: single-use reset link to the requesting address. */
export function sendPasswordResetEmail(params: {
  to: string
  name?: string | null
  resetUrl: string
}): Promise<SendResult> {
  return send(({ appName }) => ({
    to: params.to,
    subject: `Reset your ${appName} password`,
    react: (
      <PasswordResetEmail
        name={params.name}
        resetUrl={params.resetUrl}
        appName={appName}
      />
    ),
  }))
}

/** Security notice after a password change (self-service or reset). */
export function sendPasswordChangedEmail(params: {
  to: string
  name?: string | null
}): Promise<SendResult> {
  const loginUrl = `${appUrl()}/backflip/login`
  return send(({ appName }) => ({
    to: params.to,
    subject: `Your ${appName} password was changed`,
    react: (
      <PasswordChangedEmail
        name={params.name}
        loginUrl={loginUrl}
        appName={appName}
      />
    ),
  }))
}

/** Email-change: verification link sent TO the pending new address. */
export function sendEmailChangeVerification(params: {
  to: string
  name?: string | null
  newEmail: string
  verifyUrl: string
}): Promise<SendResult> {
  return send(({ appName }) => ({
    to: params.to,
    subject: `Confirm your new ${appName} email`,
    react: (
      <EmailChangeVerifyEmail
        name={params.name}
        newEmail={params.newEmail}
        verifyUrl={params.verifyUrl}
        appName={appName}
      />
    ),
  }))
}

/** Email-change: heads-up sent to the OLD address after confirmation. */
export function sendEmailChangedNotice(params: {
  to: string
  name?: string | null
  newEmail: string
}): Promise<SendResult> {
  return send(({ appName }) => ({
    to: params.to,
    subject: `Your ${appName} email was changed`,
    react: (
      <EmailChangedEmail
        name={params.name}
        newEmail={params.newEmail}
        appName={appName}
      />
    ),
  }))
}
