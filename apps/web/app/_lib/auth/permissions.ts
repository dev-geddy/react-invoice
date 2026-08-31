/**
 * Authorization model — the single source of truth for what each platform role
 * may do. Pure + client-safe (no server imports), so both server guards and
 * client UI (nav gating, edit buttons) share one definition.
 *
 * Roles (see db `user_role`, `L2-DB-05`):
 * - `owner`    — can do everything.
 * - `admin`    — operator; cannot touch system settings, cannot edit users.
 * - `teammate` — own account area + admin dashboard only.
 *
 * @spec L2-AUTH-19, L2-AUTH-21
 */

export const ROLES = ["owner", "admin", "teammate"] as const
export type Role = (typeof ROLES)[number]

export const ROLE_LABELS: Record<Role, string> = {
  owner: "Owner",
  admin: "Admin",
  teammate: "Teammate",
}

export type Capability =
  "dashboard" | "account" | "users.view" | "users.edit" | "settings"

/** Capabilities granted per role. Owner is the superset. */
const CAPABILITIES: Record<Role, readonly Capability[]> = {
  owner: ["dashboard", "account", "users.view", "users.edit", "settings"],
  admin: ["dashboard", "account", "users.view"],
  teammate: ["dashboard", "account"],
}

export function isRole(value: unknown): value is Role {
  return (
    typeof value === "string" && (ROLES as readonly string[]).includes(value)
  )
}

/** Whether `role` is allowed `capability`. Unknown/absent role → false. */
export function can(role: string | undefined | null, capability: Capability) {
  return isRole(role) ? CAPABILITIES[role].includes(capability) : false
}

export const canViewUsers = (role?: string | null) => can(role, "users.view")
export const canEditUsers = (role?: string | null) => can(role, "users.edit")
export const canAccessSettings = (role?: string | null) => can(role, "settings")
