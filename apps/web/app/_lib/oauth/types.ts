import type { Capability, Role } from "@/app/_lib/auth/permissions"

/**
 * Shared types for the OAuth 2.1 authorization server and the MCP resource
 * server it protects. Pure types — no runtime deps, safe to import from any
 * layer (routes, libs, tools, tests).
 *
 * @spec L2-MCP-18, L2-MCP-19, L2-MCP-47
 */

/**
 * How `POST /api/oauth/register` (RFC 7591) behaves:
 * - `off` — the route 404s; an owner creates clients by hand (the default);
 * - `allowlist` — anonymous registration, but every `redirect_uri` host must be
 *   on the owner's allowlist;
 * - `open` — anonymous registration with no host restriction.
 */
export const DCR_MODES = ["off", "allowlist", "open"] as const

export type DcrMode = (typeof DCR_MODES)[number]

/** Owner-managed connector settings — the single `connector_config` row. */
export type ConnectorSettings = {
  /**
   * The master switch (`L2-MCP-25`), toggled by an owner in the admin UI.
   * Default off, so a fresh deployment exposes no connector surface until
   * someone opts in. `MCP_ENABLED=false` still forces it off on top of this.
   */
  enabled: boolean
  dcrMode: DcrMode
  /** Bare hostnames, lowercase. Loopback is always allowed on top of these. */
  redirectHosts: string[]
}

/** Client authentication methods the token endpoint accepts (`L2-MCP-52`). */
export type ClientAuthMethod =
  "none" | "client_secret_post" | "client_secret_basic"

/**
 * Grantable connector scopes. Deliberately a subset of `Capability`: the
 * read-only connector phase never grants `users.edit`.
 */
export const MCP_SCOPES = [
  "account",
  "dashboard",
  "users.view",
  "settings",
] as const

export type McpScope = (typeof MCP_SCOPES)[number]

/**
 * Scopes ARE capabilities (`L2-MCP-18`) — this alias documents the identity so
 * a scope can be handed straight to `can(role, capability)`.
 */
export type ScopeCapability = Extract<Capability, McpScope>

/**
 * Resolved bearer-token identity for one MCP request. `role` is read live from
 * the DB on every request, never frozen into the token (`L2-MCP-19`), so a
 * demotion takes effect immediately.
 */
export type McpAuthContext = {
  userId: string
  role: Role
  clientId: string
  clientName: string
  scopes: McpScope[]
  /** `oauth_token.id` of the presented access token — for `lastUsedAt` + audit. */
  tokenId: string
  expiresAt: Date
}

/** A client's standing authorization for one user, as shown in the account UI. */
export type OAuthGrant = {
  clientId: string
  clientName: string
  scopes: McpScope[]
  connectedAt: Date
  lastUsedAt: Date | null
}

/** Validated `/api/oauth/authorize` request, handed to the consent screen. */
export type AuthorizationRequest = {
  clientId: string
  clientName: string
  redirectUri: string
  scopes: McpScope[]
  state: string | null
  codeChallenge: string
  codeChallengeMethod: "S256"
  resource: string | null
}

/** RFC 6749 error codes this server emits. */
export type OAuthErrorCode =
  | "invalid_request"
  | "invalid_client"
  | "invalid_grant"
  | "unauthorized_client"
  | "unsupported_grant_type"
  | "invalid_scope"
  | "access_denied"
  | "server_error"

export type OAuthFailure = { error: OAuthErrorCode; description?: string }

/** Freshly minted token pair, as returned by the token endpoint. */
export type IssuedTokens = {
  accessToken: string
  refreshToken: string
  /** Access-token lifetime in seconds (`expires_in`). */
  expiresIn: number
  scopes: McpScope[]
}
