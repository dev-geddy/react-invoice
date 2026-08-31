"use server"

import { revalidatePath } from "next/cache"

import bcrypt from "bcryptjs"
import { db, users } from "@workspace/db"
import { and, eq, ne, sql } from "drizzle-orm"

import { auth } from "@/app/_lib/auth"
import {
  consumeUserToken,
  countRecentTokens,
  createUserToken,
  RATE_LIMIT,
} from "@/app/_lib/auth/tokens"
import {
  appUrl,
  sendEmailChangedNotice,
  sendEmailChangeVerification,
  sendPasswordChangedEmail,
} from "@/app/_lib/email/send"

/**
 * Self-service account actions (`/backflip/account`). All self-scoped to the
 * signed-in user; never a client-supplied id.
 *
 * @spec L2-AUTH-27, L2-AUTH-30, L2-AUTH-36, L2-AUTH-37
 */

export type SaveState = { ok: boolean; message: string } | null

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

/** Update the signed-in user's display name. Self-scoped — never a client id. */
export async function saveProfile(
  _prev: SaveState,
  formData: FormData
): Promise<SaveState> {
  const session = await auth()
  if (!session?.user) return { ok: false, message: "Unauthorized" }

  const name = String(formData.get("name") ?? "").trim() || null
  await db.update(users).set({ name }).where(eq(users.id, session.user.id))

  revalidatePath("/backflip/account")
  return { ok: true, message: "Profile updated." }
}

/**
 * Change the signed-in user's password. If one is already set, the current
 * password must verify (bcrypt). OAuth-only users (no hash) may set a first
 * password. Sends a "password changed" security notice on success.
 */
export async function changePassword(
  _prev: SaveState,
  formData: FormData
): Promise<SaveState> {
  const session = await auth()
  if (!session?.user) return { ok: false, message: "Unauthorized" }

  const current = String(formData.get("currentPassword") ?? "")
  const next = String(formData.get("newPassword") ?? "")
  const confirm = String(formData.get("confirmPassword") ?? "")

  if (next.length < 8) {
    return { ok: false, message: "New password must be at least 8 characters." }
  }
  if (next !== confirm) {
    return { ok: false, message: "New passwords don’t match." }
  }

  const [row] = await db
    .select({
      passwordHash: users.passwordHash,
      email: users.email,
      name: users.name,
    })
    .from(users)
    .where(eq(users.id, session.user.id))
  if (!row) return { ok: false, message: "User not found." }

  if (row.passwordHash) {
    if (!current) return { ok: false, message: "Enter your current password." }
    const ok = await bcrypt.compare(current, row.passwordHash)
    if (!ok) return { ok: false, message: "Current password is incorrect." }
  }

  const passwordHash = await bcrypt.hash(next, 12)
  // Bump tokenVersion → invalidate all existing sessions (incl. this one).
  await db
    .update(users)
    .set({ passwordHash, tokenVersion: sql`${users.tokenVersion} + 1` })
    .where(eq(users.id, session.user.id))

  await sendPasswordChangedEmail({ to: row.email, name: row.name })

  revalidatePath("/backflip/account")
  return {
    ok: true,
    message: "Password updated. You’ll be signed out on other devices.",
  }
}

/**
 * Request an email change. Validates + checks availability, then mints an
 * `email_change` token and sends a verification link to the NEW address. The
 * address is NOT changed until that link is confirmed (`confirmEmailChange`).
 * Requires configured email — otherwise verification can't be delivered.
 */
export async function requestEmailChange(
  _prev: SaveState,
  formData: FormData
): Promise<SaveState> {
  const session = await auth()
  if (!session?.user) return { ok: false, message: "Unauthorized" }

  const newEmail = String(formData.get("newEmail") ?? "")
    .trim()
    .toLowerCase()
  const currentPassword = String(formData.get("currentPassword") ?? "")
  if (!newEmail) return { ok: false, message: "Email is required" }
  if (!EMAIL_RE.test(newEmail)) {
    return { ok: false, message: "Enter a valid email address." }
  }

  const [me] = await db
    .select({
      email: users.email,
      name: users.name,
      passwordHash: users.passwordHash,
    })
    .from(users)
    .where(eq(users.id, session.user.id))
  if (!me) return { ok: false, message: "User not found." }
  if (newEmail === me.email.toLowerCase()) {
    return { ok: false, message: "That’s already your email." }
  }

  // Step-up: re-verify the password before changing the login identity. Users
  // with no password (Google-only) are authenticated by their active session.
  if (me.passwordHash) {
    if (!currentPassword) {
      return { ok: false, message: "Enter your current password to continue." }
    }
    const ok = await bcrypt.compare(currentPassword, me.passwordHash)
    if (!ok) return { ok: false, message: "Current password is incorrect." }
  }

  // Per-account rate limit on change requests.
  const recent = await countRecentTokens({
    userId: session.user.id,
    type: "email_change",
    withinMinutes: RATE_LIMIT.windowMinutes,
  })
  if (recent >= RATE_LIMIT.max) {
    return {
      ok: false,
      message: "Too many change requests. Try again in a few minutes.",
    }
  }

  const [taken] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, newEmail))
  if (taken) return { ok: false, message: "That email is already in use." }

  const raw = await createUserToken({
    userId: session.user.id,
    type: "email_change",
    newEmail,
  })
  const verifyUrl = `${appUrl()}/backflip/account/verify-email?token=${encodeURIComponent(raw)}`
  const result = await sendEmailChangeVerification({
    to: newEmail,
    name: me.name,
    newEmail,
    verifyUrl,
  })

  if (!result.sent) {
    const message =
      result.reason === "not_configured"
        ? "Email sending isn’t configured, so a new address can’t be verified. Ask an owner to set up email first."
        : `Couldn’t send the verification email: ${result.message}`
    return { ok: false, message }
  }

  return {
    ok: true,
    message: `Verification sent to ${newEmail}. Open the link there to confirm the change.`,
  }
}

/**
 * Confirm a pending email change from the verification link. Consumes the
 * token, re-checks availability, swaps the address, and notifies the OLD email.
 * Called directly (server action) from the verify-email page; requires the same
 * signed-in user the token was issued to.
 */
export async function confirmEmailChange(token: string): Promise<SaveState> {
  const session = await auth()
  if (!session?.user) return { ok: false, message: "Unauthorized" }

  // Pass userId so a token belonging to another account is NOT consumed —
  // otherwise anyone holding the link could burn a victim's pending change.
  const consumed = await consumeUserToken({
    rawToken: token,
    type: "email_change",
    userId: session.user.id,
  })
  if (!consumed || !consumed.newEmail) {
    return { ok: false, message: "This link is invalid or has expired." }
  }

  const [taken] = await db
    .select({ id: users.id })
    .from(users)
    .where(
      and(eq(users.email, consumed.newEmail), ne(users.id, session.user.id))
    )
  if (taken) {
    return {
      ok: false,
      message: "That email is now in use by another account.",
    }
  }

  const [me] = await db
    .select({ email: users.email, name: users.name })
    .from(users)
    .where(eq(users.id, session.user.id))

  // Swap the address + mark it verified (the user just proved control of it) +
  // bump tokenVersion → invalidate existing sessions.
  await db
    .update(users)
    .set({
      email: consumed.newEmail,
      emailVerified: new Date(),
      tokenVersion: sql`${users.tokenVersion} + 1`,
    })
    .where(eq(users.id, session.user.id))

  if (me?.email) {
    await sendEmailChangedNotice({
      to: me.email,
      name: me.name,
      newEmail: consumed.newEmail,
    })
  }

  revalidatePath("/backflip/account")
  return {
    ok: true,
    message: `Your email is now ${consumed.newEmail}. You’ll be signed out shortly.`,
  }
}
