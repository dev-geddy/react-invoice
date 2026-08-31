"use server"

import { revalidatePath } from "next/cache"

import { db, users } from "@workspace/db"
import { eq, sql } from "drizzle-orm"

import { auth } from "@/app/_lib/auth"
import { canEditUsers } from "@/app/_lib/auth/permissions"
import { firstError, updateUserSchema } from "@/app/_lib/validation"

/**
 * Admin user-management actions. (User creation lives in the REST endpoint
 * `POST /api/backflip/users` — `L2-AUTH-25`.)
 *
 * @spec L2-AUTH-22, L2-AUTH-23, L2-AUTH-38, L2-AUTH-39, L2-AUTH-42
 */

export type SaveState = { ok: boolean; message: string } | null

function isUniqueViolation(e: unknown) {
  return (
    typeof e === "object" &&
    e !== null &&
    "code" in e &&
    (e as { code?: string }).code === "23505"
  )
}

/**
 * Owner-only: update a user's name, email, and role. Guards:
 * - capability `users.edit` (owner) — server-enforced, not just UI-hidden.
 * - validated input (email format, known role) via `updateUserSchema`.
 * - self-lockout: an owner cannot change their own role.
 * - last-owner: demoting the final owner is refused (transactional, with the
 *   owner set row-locked so two concurrent demotions can't both pass — the
 *   check `deleteUser` had, now covering demotion too).
 * - session invalidation: changing a user's email or role bumps their
 *   `tokenVersion`, so their existing sessions are revoked (`L2-AUTH-36`).
 * - unique email: friendly message on the pg 23505 violation.
 */
export async function updateUser(
  _prev: SaveState,
  formData: FormData
): Promise<SaveState> {
  const session = await auth()
  if (!session?.user || !canEditUsers(session.user.role)) {
    return { ok: false, message: "Unauthorized" }
  }

  const parsed = updateUserSchema.safeParse({
    id: String(formData.get("id") ?? ""),
    name:
      formData.get("name") == null ? undefined : String(formData.get("name")),
    email: String(formData.get("email") ?? ""),
    role: String(formData.get("role") ?? ""),
  })
  if (!parsed.success) return { ok: false, message: firstError(parsed.error) }
  const { id, name, email, role } = parsed.data

  if (id === session.user.id && role !== session.user.role) {
    return { ok: false, message: "You can't change your own role." }
  }

  try {
    return await db.transaction(async (tx) => {
      const [current] = await tx
        .select({ email: users.email, role: users.role })
        .from(users)
        .where(eq(users.id, id))
        .for("update")
      if (!current) return { ok: false, message: "User not found." }

      // Refuse to demote the last owner. Lock the owner set so a concurrent
      // demotion of the other owner serializes behind this one.
      if (current.role === "owner" && role !== "owner") {
        const owners = await tx
          .select({ id: users.id })
          .from(users)
          .where(eq(users.role, "owner"))
          .for("update")
        if (owners.length <= 1) {
          return { ok: false, message: "Can't remove the last owner." }
        }
      }

      const identityChanged =
        current.email.toLowerCase() !== email || current.role !== role
      await tx
        .update(users)
        .set({
          name,
          email,
          role,
          ...(identityChanged
            ? { tokenVersion: sql`${users.tokenVersion} + 1` }
            : {}),
        })
        .where(eq(users.id, id))

      revalidatePath("/backflip/users")
      return { ok: true, message: "Saved." }
    })
  } catch (e) {
    if (isUniqueViolation(e)) {
      return { ok: false, message: "Email already in use." }
    }
    throw e
  }
}

/**
 * Owner-only: permanently remove a user. FK cascades drop their linked
 * accounts, sessions, and tokens. Guards:
 * - capability `users.edit` (owner) — server-enforced.
 * - can't remove your own account (avoid self-lockout).
 * - can't remove the last remaining owner (keep at least one).
 */
export async function deleteUser(userId: string): Promise<SaveState> {
  const session = await auth()
  if (!session?.user || !canEditUsers(session.user.role)) {
    return { ok: false, message: "Unauthorized" }
  }
  if (!userId) return { ok: false, message: "Missing user id" }
  if (userId === session.user.id) {
    return { ok: false, message: "You can't remove your own account." }
  }

  return await db.transaction(async (tx) => {
    const [target] = await tx
      .select({ role: users.role })
      .from(users)
      .where(eq(users.id, userId))
      .for("update")
    if (!target) return { ok: false, message: "User not found." }

    // Refuse to remove the last owner. Lock the owner set so a concurrent
    // demotion/delete of the other owner serializes behind this one.
    if (target.role === "owner") {
      const owners = await tx
        .select({ id: users.id })
        .from(users)
        .where(eq(users.role, "owner"))
        .for("update")
      if (owners.length <= 1) {
        return { ok: false, message: "Can't remove the last owner." }
      }
    }

    await tx.delete(users).where(eq(users.id, userId))
    revalidatePath("/backflip/users")
    return { ok: true, message: "Member removed." }
  })
}
