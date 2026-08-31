import { can, type Role } from "@/app/_lib/auth/permissions"
import { MCP_SCOPES, type McpScope } from "./types"

/**
 * Scope parsing, formatting and the capability intersection that decides what a
 * given role may ever grant. Scopes ARE capabilities (`L2-MCP-18`), so a scope
 * string can be handed straight to `can(role, capability)`.
 *
 * Every list this module produces is in `MCP_SCOPES` declaration order, never
 * request order — a stable order makes two scope sets comparable by value,
 * which is what per-(user, client, scope set) consent reuse relies on
 * (`L2-MCP-38`).
 *
 * @spec L2-MCP-18, L2-MCP-34, L2-MCP-38
 */

/** Whether `value` is one of the grantable connector scopes. */
export function isMcpScope(value: unknown): value is McpScope {
  return (
    typeof value === "string" &&
    (MCP_SCOPES as readonly string[]).includes(value)
  )
}

/**
 * Parse an OAuth `scope` parameter (space-delimited, RFC 6749 §3.3). Unknown
 * scopes are dropped rather than rejected — a client asking for something we
 * don't offer gets the subset we do, which is what OAuth 2.1 prescribes.
 * Result is deduped and in canonical order.
 */
export function parseScopes(raw: string | null | undefined): McpScope[] {
  if (!raw) return []
  const requested = new Set(raw.split(/\s+/).filter(Boolean))
  return MCP_SCOPES.filter((scope) => requested.has(scope))
}

/** Render scopes as the space-delimited form used on the wire. */
export function formatScopes(scopes: McpScope[]): string {
  return scopes.join(" ")
}

/**
 * The scopes `role` is allowed to grant — `MCP_SCOPES` filtered by the live
 * capability model. A teammate can never consent to `users.view` even if the
 * client asks for it, and a demotion narrows every existing token on next use.
 */
export function grantableScopes(role: Role): McpScope[] {
  return MCP_SCOPES.filter((scope) => can(role, scope))
}

/**
 * Intersection of two scope sets, in canonical order. Used wherever the double
 * check applies — token scope AND live role capability (`L2-MCP-34`).
 */
export function intersectScopes(a: McpScope[], b: McpScope[]): McpScope[] {
  return MCP_SCOPES.filter((scope) => a.includes(scope) && b.includes(scope))
}

/**
 * Plain-language scope copy for the consent screen. A user approving a
 * connector must be able to tell what they are handing over without knowing
 * what a "scope" is.
 */
export const SCOPE_LABELS: Record<
  McpScope,
  { title: string; description: string }
> = {
  account: {
    title: "Your account",
    description: "See who you are signed in as — name, email and role.",
  },
  dashboard: {
    title: "Dashboard summary",
    description: "See user counts and the most recent signups.",
  },
  "users.view": {
    title: "View users",
    description:
      "Look up the people on this platform — names, emails and roles. No changes.",
  },
  settings: {
    title: "Platform status",
    description:
      "See which integrations are switched on. Never API keys or secrets.",
  },
}
