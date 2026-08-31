import { z } from "zod"

import { isRole, type Role } from "@/app/_lib/auth/permissions"

/**
 * Shared input schemas for the admin user-management surfaces. Centralizes the
 * rules that were previously hand-rolled per endpoint: real email format, a
 * known role, a password floor, and — crucially — rejecting non-string JSON
 * (`{}`/arrays) instead of coercing them to `"[object Object]"`.
 *
 * @spec L2-AUTH-25, L2-AUTH-42
 */

export const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/
export const PASSWORD_MIN = 8

/** Trim → null when empty; accepts string | null | undefined, rejects other types. */
const nameField = z
  .string()
  .nullish()
  .transform((v) => {
    const t = (v ?? "").trim()
    return t.length > 0 ? t : null
  })

const emailField = z
  .string()
  .transform((v) => v.trim().toLowerCase())
  .refine((v) => v.length > 0, "Email is required.")
  .refine((v) => EMAIL_RE.test(v), "Enter a valid email address.")

const roleField = z
  .string()
  .refine(isRole, "Unknown role.")
  .transform((v) => v as Role)

/** Optional on create: blank → Google-only account; otherwise min length. */
const optionalPasswordField = z
  .string()
  .optional()
  .transform((v) => v ?? "")
  .refine(
    (v) => v === "" || v.length >= PASSWORD_MIN,
    `Password must be at least ${PASSWORD_MIN} characters.`
  )

export const createUserSchema = z.object({
  name: nameField,
  email: emailField,
  role: roleField,
  password: optionalPasswordField,
})

export const updateUserSchema = z.object({
  id: z.string().refine((v) => v.length > 0, "Missing user id."),
  name: nameField,
  email: emailField,
  role: roleField,
})

/** First human-readable message from a failed parse, for a flat UI response. */
export function firstError(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Invalid input."
}
