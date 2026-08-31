import { revalidatePath } from "next/cache"
import { NextResponse } from "next/server"

import bcrypt from "bcryptjs"
import { db, users } from "@workspace/db"

import { auth } from "@/app/_lib/auth"
import { canEditUsers } from "@/app/_lib/auth/permissions"
import { sendWelcomeEmail } from "@/app/_lib/email/send"
import { createUserSchema, firstError } from "@/app/_lib/validation"

// Uses pg (db) + bcrypt — Node runtime, not edge.
export const runtime = "nodejs"

function isUniqueViolation(e: unknown) {
  return (
    typeof e === "object" &&
    e !== null &&
    "code" in e &&
    (e as { code?: string }).code === "23505"
  )
}

/**
 * POST /api/backflip/users — owner-only: create a platform user, then send a
 * welcome email (best-effort). Auth + capability (`users.edit`) enforced here,
 * not just in the UI. Body (JSON): `{ name?, email, role, password? }`.
 * A blank password → `passwordHash` null (Google-only sign-in; the email must
 * be pre-registered per the auth model).
 *
 * Status codes: 201 created · 400 validation · 401 unauth · 403 forbidden ·
 * 409 duplicate email. Email delivery never changes the status: an unconfigured
 * Resend or a send failure still returns 201 with an informative `message`.
 *
 * @spec L2-AUTH-25, L2-AUTH-42
 */
export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json(
      { ok: false, message: "Unauthorized" },
      { status: 401 }
    )
  }
  if (!canEditUsers(session.user.role)) {
    return NextResponse.json(
      { ok: false, message: "Forbidden" },
      { status: 403 }
    )
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json(
      { ok: false, message: "Invalid JSON body" },
      { status: 400 }
    )
  }

  const parsed = createUserSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, message: firstError(parsed.error) },
      { status: 400 }
    )
  }
  const { name, email, role, password } = parsed.data

  const passwordHash = password ? await bcrypt.hash(password, 12) : null

  try {
    await db.insert(users).values({ name, email, role, passwordHash })
  } catch (e) {
    if (isUniqueViolation(e)) {
      return NextResponse.json(
        { ok: false, message: "Email already in use." },
        { status: 409 }
      )
    }
    throw e
  }

  const result = await sendWelcomeEmail({ to: email, name })
  revalidatePath("/backflip/users")

  const message = result.sent
    ? "User added. Welcome email sent."
    : result.reason === "not_configured"
      ? "User added. Email sending not configured — no welcome email sent."
      : `User added, but the welcome email failed to send: ${result.message}`

  return NextResponse.json({ ok: true, message }, { status: 201 })
}
