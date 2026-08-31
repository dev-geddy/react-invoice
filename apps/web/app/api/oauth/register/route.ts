import { NextResponse } from "next/server"

import {
  isValidRedirectUri,
  redirectUriHost,
  registerClient,
} from "@/app/_lib/oauth/clients"
import { isMcpEnabled } from "@/app/_lib/oauth/config"
import {
  getConnectorSettings,
  isHostAllowed,
  type ConnectorSettings,
} from "@/app/_lib/oauth/connector-config"
import {
  connectorDisabledResponse,
  NO_STORE_HEADERS,
  rateLimitedResponse,
} from "@/app/_lib/oauth/errors"
import { clientIp, registerLimiter } from "@/app/_lib/oauth/limits"
import { formatScopes, parseScopes } from "@/app/_lib/oauth/scopes"

// Writes to postgres via pg — Node runtime, not edge.
export const runtime = "nodejs"

/** Only the code grant + refresh are implemented. */
const SUPPORTED_GRANT_TYPES = ["authorization_code", "refresh_token"]

/** Bounds on attacker-controlled metadata — this endpoint is unauthenticated. */
const MAX_CLIENT_NAME_LENGTH = 200
const MAX_REDIRECT_URIS = 10

/**
 * RFC 7591 §3.2.2 error shape. Its vocabulary (`invalid_redirect_uri`,
 * `invalid_client_metadata`) is registration-specific and deliberately not the
 * RFC 6749 set used elsewhere in this server.
 */
function registrationError(
  error: "invalid_redirect_uri" | "invalid_client_metadata",
  description: string
): NextResponse {
  return NextResponse.json(
    { error, error_description: description },
    { status: 400, headers: NO_STORE_HEADERS }
  )
}

/**
 * POST /api/oauth/register — Dynamic Client Registration (RFC 7591).
 *
 * **Off by default** (`dcrMode = "off"`, `L2-MCP-12`, `L2-MCP-47`): anonymous
 * registration hands any internet caller a `client_id` with an attacker-chosen
 * `redirect_uri` — a phishing primitive on our own domain — so an owner creates
 * clients by hand instead. With the mode off this route is a plain `404`,
 * indistinguishable from a route that was never deployed.
 *
 * When an owner does switch it on: `allowlist` registers only clients whose
 * redirect hosts are on the owner's list (`L2-MCP-49`); `open` accepts any
 * valid URI. Either way it stays rate-limited to 10/h per IP (`L2-MCP-30`) and
 * always registers a PUBLIC client: `token_endpoint_auth_method: "none"`, no
 * secret, PKCE instead (`L2-MCP-26`).
 *
 * Status codes: 201 registered · 400 invalid metadata · 404 connector disabled
 * or DCR off · 429 rate limited · 500 storage failure.
 *
 * @spec L2-MCP-12, L2-MCP-21, L2-MCP-30, L2-MCP-31, L2-MCP-37, L2-MCP-41,
 *       L2-MCP-47, L2-MCP-49
 */
export async function POST(request: Request) {
  if (!(await isMcpEnabled())) return connectorDisabledResponse()

  // The mode gate runs BEFORE the limiter and before the body is read: a 404
  // must cost nothing and reveal nothing — no rate-limit budget consumed, no
  // parse errors that would distinguish this route from a missing one. A failed
  // settings read fails closed, for the same reason.
  let settings: ConnectorSettings
  try {
    settings = await getConnectorSettings()
  } catch {
    return connectorDisabledResponse()
  }
  if (settings.dcrMode === "off") return connectorDisabledResponse()

  const ip = clientIp(request)
  if (registerLimiter.blocked(ip)) {
    return rateLimitedResponse(registerLimiter.retryAfterMs(ip))
  }
  registerLimiter.hit(ip)

  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return registrationError("invalid_client_metadata", "Invalid JSON body.")
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return registrationError("invalid_client_metadata", "Invalid JSON body.")
  }

  const rawUris = body.redirect_uris
  if (!Array.isArray(rawUris) || rawUris.length === 0) {
    return registrationError(
      "invalid_redirect_uri",
      "redirect_uris must be a non-empty array."
    )
  }
  if (rawUris.length > MAX_REDIRECT_URIS) {
    return registrationError(
      "invalid_redirect_uri",
      "Too many redirect_uris were supplied."
    )
  }
  const redirectUris: string[] = []
  for (const uri of rawUris) {
    if (typeof uri !== "string" || !isValidRedirectUri(uri)) {
      return registrationError(
        "invalid_redirect_uri",
        "Each redirect_uri must be an absolute https URL (or http on localhost) with no fragment."
      )
    }
    const value = uri.trim()
    // In `allowlist` mode the owner's host list bounds where an authorization
    // response may land — same rule manual clients are held to (`L2-MCP-49`).
    if (settings.dcrMode === "allowlist") {
      const host = redirectUriHost(value)
      if (!host || !isHostAllowed(host, settings.redirectHosts)) {
        return registrationError(
          "invalid_redirect_uri",
          "That redirect_uri host is not allowed on this server."
        )
      }
    }
    if (!redirectUris.includes(value)) redirectUris.push(value)
  }

  const rawName =
    typeof body.client_name === "string" ? body.client_name.trim() : ""
  if (rawName.length > MAX_CLIENT_NAME_LENGTH) {
    return registrationError(
      "invalid_client_metadata",
      "client_name is too long."
    )
  }
  // The name is shown on the consent screen, so a nameless client still needs
  // something honest to render.
  const clientName = rawName || "Unnamed MCP client"

  const rawGrantTypes = body.grant_types
  if (rawGrantTypes !== undefined) {
    if (
      !Array.isArray(rawGrantTypes) ||
      rawGrantTypes.some(
        (grant) =>
          typeof grant !== "string" || !SUPPORTED_GRANT_TYPES.includes(grant)
      )
    ) {
      return registrationError(
        "invalid_client_metadata",
        "Only the authorization_code and refresh_token grants are supported."
      )
    }
  }

  const rawResponseTypes = body.response_types
  if (rawResponseTypes !== undefined) {
    if (
      !Array.isArray(rawResponseTypes) ||
      rawResponseTypes.some((type) => type !== "code")
    ) {
      return registrationError(
        "invalid_client_metadata",
        "Only the code response type is supported."
      )
    }
  }

  const authMethod = body.token_endpoint_auth_method
  if (authMethod !== undefined && authMethod !== "none") {
    return registrationError(
      "invalid_client_metadata",
      "Only public clients (token_endpoint_auth_method: none) are supported."
    )
  }

  const scopes = parseScopes(
    typeof body.scope === "string" ? body.scope : undefined
  )

  try {
    const client = await registerClient({
      clientName,
      redirectUris,
      grantTypes: rawGrantTypes as string[] | undefined,
      scopes,
    })

    return NextResponse.json(
      {
        client_id: client.clientId,
        client_id_issued_at: Math.floor(client.createdAt.getTime() / 1000),
        client_name: client.clientName,
        redirect_uris: client.redirectUris,
        grant_types: client.grantTypes,
        response_types: ["code"],
        token_endpoint_auth_method: client.tokenEndpointAuthMethod,
        scope: formatScopes(parseScopes(client.scopes.join(" "))),
      },
      { status: 201, headers: NO_STORE_HEADERS }
    )
  } catch {
    // Never surface a db error (`L2-MCP-41`).
    return NextResponse.json(
      { error: "server_error", error_description: "Registration failed." },
      { status: 500, headers: NO_STORE_HEADERS }
    )
  }
}
