import type { Role } from "@/app/_lib/auth/permissions"

/**
 * Derived member status — real data only (no schema column). `active` = the
 * member can sign in (has a login method) or has a verified email; `pending` =
 * created but no sign-in method yet and unverified. There is no "suspended"
 * state (no backend for it).
 */
export type MemberStatus = "active" | "pending"

/** One row of the Members admin, serialized for the client shell. */
export type Member = {
  id: string
  name: string | null
  email: string
  image: string | null
  role: Role
  /** Human-readable auth methods, e.g. ["Password", "Google"]. */
  loginMethods: string[]
  /** True when a Google OAuth account is linked (drives the sign-in badge). */
  usesGoogle: boolean
  /** Preformatted join date (server-formatted to avoid locale hydration skew). */
  joined: string
  emailVerified: boolean
  status: MemberStatus
}

export type WorkspaceCounts = {
  total: number
  active: number
  pending: number
}
