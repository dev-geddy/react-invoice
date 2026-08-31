"use server"

import bcrypt from "bcryptjs"
import { db, users } from "@workspace/db"
import { eq, sql } from "drizzle-orm"

import { isCredentialsEnabled } from "@/app/_lib/auth/config"
import {
  consumeUserToken,
  countRecentTokens,
  createUserToken,
  RATE_LIMIT,
} from "@/app/_lib/auth/tokens"
import {
  appUrl,
  sendPasswordChangedEmail,
  sendPasswordResetEmail,
} from "@/app/_lib/email/send"

/**
 * Public password-recovery actions (forgot / reset).
 *
 * @spec L2-AUTH-28, L2-AUTH-36, L2-AUTH-37
 */

export type SaveState = { ok: boolean; message: string } | null

const PASSWORD_LOGIN_DISABLED =
  "Password sign-in is disabled — use Google to sign in."

/**
 * Forgot-password: mint a `password_reset` token for the email (if it exists)
 * and send a reset link. Always returns the same generic success — never
 * reveals whether an account exists (no user enumeration).
 */
export async function requestPasswordReset(
  _prev: SaveState,
  formData: FormData
): Promise<SaveState> {
  if (!isCredentialsEnabled()) {
    return { ok: false, message: PASSWORD_LOGIN_DISABLED }
  }

  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase()
  if (!email) return { ok: false, message: "Email is required" }

  const [user] = await db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(eq(users.email, email))

  if (user) {
    // Per-account rate limit — silently skip past the cap (no signal to caller).
    const recent = await countRecentTokens({
      userId: user.id,
      type: "password_reset",
      withinMinutes: RATE_LIMIT.windowMinutes,
    })
    if (recent < RATE_LIMIT.max) {
      const raw = await createUserToken({
        userId: user.id,
        type: "password_reset",
      })
      const resetUrl = `${appUrl()}/backflip/reset-password?token=${encodeURIComponent(raw)}`
      // Best-effort; failure is not surfaced (would leak account existence).
      await sendPasswordResetEmail({ to: email, name: user.name, resetUrl })
    }
  }

  return {
    ok: true,
    message: "If an account exists for that email, we’ve sent a reset link.",
  }
}

/**
 * Reset-password: validate the token, set the new password, and send a
 * "password changed" notice. Single-use — the token is consumed on success.
 */
export async function resetPassword(
  _prev: SaveState,
  formData: FormData
): Promise<SaveState> {
  if (!isCredentialsEnabled()) {
    return { ok: false, message: PASSWORD_LOGIN_DISABLED }
  }

  const token = String(formData.get("token") ?? "")
  const next = String(formData.get("newPassword") ?? "")
  const confirm = String(formData.get("confirmPassword") ?? "")

  if (next.length < 8) {
    return { ok: false, message: "Password must be at least 8 characters." }
  }
  if (next !== confirm) {
    return { ok: false, message: "Passwords don’t match." }
  }

  const consumed = await consumeUserToken({
    rawToken: token,
    type: "password_reset",
  })
  if (!consumed) {
    return { ok: false, message: "This reset link is invalid or has expired." }
  }

  const passwordHash = await bcrypt.hash(next, 12)
  // Bump tokenVersion → invalidate all existing sessions (force re-login).
  await db
    .update(users)
    .set({ passwordHash, tokenVersion: sql`${users.tokenVersion} + 1` })
    .where(eq(users.id, consumed.userId))

  const [u] = await db
    .select({ email: users.email, name: users.name })
    .from(users)
    .where(eq(users.id, consumed.userId))
  if (u) await sendPasswordChangedEmail({ to: u.email, name: u.name })

  return { ok: true, message: "Password updated. You can now sign in." }
}
