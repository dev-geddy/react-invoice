import { NextResponse } from "next/server"

import {
  equalizeClientAuthTiming,
  findClientByClientId,
  parseClientAuthentication,
  touchClient,
  verifyClientSecret,
} from "@/app/_lib/oauth/clients"
import { consumeAuthorizationCode } from "@/app/_lib/oauth/codes"
import { isMcpEnabled } from "@/app/_lib/oauth/config"
import {
  connectorDisabledResponse,
  NO_STORE_HEADERS,
  oauthErrorResponse,
  rateLimitedResponse,
} from "@/app/_lib/oauth/errors"
import { clientIp, tokenLimiter } from "@/app/_lib/oauth/limits"
import { formatScopes } from "@/app/_lib/oauth/scopes"
import { issueTokenPair, rotateRefreshToken } from "@/app/_lib/oauth/tokens"
import type { IssuedTokens } from "@/app/_lib/oauth/types"

// Reads/writes postgres via pg — Node runtime, not edge.
export const runtime = "nodejs"

const FORM_CONTENT_TYPE = "application/x-www-form-urlencoded"

/** RFC 6749 token response. */
function tokenResponse(tokens: IssuedTokens): NextResponse {
  return NextResponse.json(
    {
      access_token: tokens.accessToken,
      token_type: "Bearer",
      expires_in: tokens.expiresIn,
      refresh_token: tokens.refreshToken,
      scope: formatScopes(tokens.scopes),
    },
    { status: 200, headers: NO_STORE_HEADERS }
  )
}

/**
 * POST /api/oauth/token — the token endpoint.
 *
 * Accepts **only** `application/x-www-form-urlencoded` (RFC 6749 §4.1.3): a
 * Claude client posts both the initial exchange and every refresh that way, so
 * a JSON-only endpoint would simply never be called successfully.
 *
 * Two kinds of caller (`L2-MCP-52`):
 * - public — `client_id` in the body, possession proven by PKCE alone. Dynamic
 *   registrations and native (loopback) clients, which cannot keep a secret.
 * - confidential — a manually created web client, which must additionally
 *   present its `client_secret` as `client_secret_post` or `client_secret_basic`.
 *
 * PKCE is mandatory for both (`L2-MCP-26`); the secret is an extra factor, never
 * a replacement.
 *
 * Status codes: 200 tokens · 400 invalid request/grant/client ·
 * 404 connector disabled · 429 rate limited. Always `Cache-Control: no-store`.
 *
 * @spec L2-MCP-15, L2-MCP-24, L2-MCP-26, L2-MCP-27, L2-MCP-30, L2-MCP-32,
 *       L2-MCP-33, L2-MCP-37, L2-MCP-40, L2-MCP-41, L2-MCP-52
 */
export async function POST(request: Request) {
  if (!(await isMcpEnabled())) return connectorDisabledResponse()

  const ip = clientIp(request)
  if (tokenLimiter.blocked(ip)) {
    return rateLimitedResponse(tokenLimiter.retryAfterMs(ip))
  }
  tokenLimiter.hit(ip)

  const contentType = request.headers.get("content-type") ?? ""
  if (!contentType.toLowerCase().includes(FORM_CONTENT_TYPE)) {
    return oauthErrorResponse({
      error: "invalid_request",
      description: `Content-Type must be ${FORM_CONTENT_TYPE}.`,
    })
  }

  let form: URLSearchParams
  try {
    form = new URLSearchParams(await request.text())
  } catch {
    return oauthErrorResponse({
      error: "invalid_request",
      description: "The request body could not be read.",
    })
  }

  const grantType = form.get("grant_type")?.trim() ?? ""
  if (!grantType) {
    return oauthErrorResponse({
      error: "invalid_request",
      description: "Missing grant_type.",
    })
  }

  // Reject a grant type this server doesn't support at all *before* looking at
  // client_id. Checking afterwards would let an unauthenticated caller probe
  // client_id existence: invalid_client for an unknown id vs
  // unsupported_grant_type for a registered one is itself an oracle
  // (`L2-MCP-41`) — so unsupported types must short-circuit before any client
  // lookup happens, regardless of what client_id was sent alongside them.
  if (grantType !== "authorization_code" && grantType !== "refresh_token") {
    return oauthErrorResponse({
      error: "unsupported_grant_type",
      description: "Supported grants: authorization_code, refresh_token.",
    })
  }

  // Identity + optional secret, from the body or an HTTP Basic header.
  const presented = parseClientAuthentication({
    authorizationHeader: request.headers.get("authorization"),
    form,
  })
  if (!presented.ok) return oauthErrorResponse(presented.failure)

  let client
  try {
    client = await findClientByClientId(presented.clientId)
  } catch {
    return oauthErrorResponse({ error: "server_error" }, 500)
  }
  if (!client) {
    // Burn the same bcrypt work a wrong secret would cost, so an unknown
    // client_id can't be told apart by response time (`L2-MCP-41`).
    if (presented.secret !== null) {
      await equalizeClientAuthTiming(presented.secret)
    }
    return oauthErrorResponse({
      error: "invalid_client",
      description: "Client authentication failed.",
    })
  }

  // Client authentication (`L2-MCP-52`). A confidential client (one with a
  // stored hash) must present a valid secret; a public one must NOT present a
  // secret at all — ignoring it would let a caller believe it authenticated.
  // Both failures answer `invalid_client` with the same description, so the
  // response never says which of the two it was. PKCE is still required below
  // in every case: a secret never substitutes for it (`L2-MCP-26`).
  if (presented.secret !== null) {
    // `verifyClientSecret` returns false for a public client, having done the
    // same amount of work.
    const authenticated = await verifyClientSecret(client, presented.secret)
    if (!authenticated) {
      return oauthErrorResponse({
        error: "invalid_client",
        description: "Client authentication failed.",
      })
    }
  } else if (client.clientSecretHash) {
    return oauthErrorResponse({
      error: "invalid_client",
      description: "Client authentication failed.",
    })
  }
  // grantType is already known-supported by the server at this point, so this
  // only fires for a client registered without it — no existence oracle since
  // we've already confirmed the client exists above.
  if (!client.grantTypes.includes(grantType)) {
    return oauthErrorResponse({
      error: "unsupported_grant_type",
      description: "This grant type is not available for this client.",
    })
  }

  if (grantType === "authorization_code") {
    const code = form.get("code")?.trim() ?? ""
    const redirectUri = form.get("redirect_uri")?.trim() ?? ""
    const codeVerifier = form.get("code_verifier")?.trim() ?? ""

    if (!code || !redirectUri || !codeVerifier) {
      return oauthErrorResponse({
        error: "invalid_request",
        description: "code, redirect_uri and code_verifier are required.",
      })
    }

    try {
      const consumed = await consumeAuthorizationCode({
        code,
        clientDbId: client.id,
        redirectUri,
        codeVerifier,
      })
      if (!consumed.ok) return oauthErrorResponse(consumed.failure)

      const tokens = await issueTokenPair({
        userId: consumed.userId,
        clientDbId: client.id,
        scopes: consumed.scopes,
        resource: consumed.resource,
        // The code row's id is the family root, so replaying the code can
        // revoke exactly the tokens it minted (`L2-MCP-32`).
        familyId: consumed.familyId,
      })

      await touchClient(client.id)
      return tokenResponse(tokens)
    } catch {
      return oauthErrorResponse({ error: "server_error" }, 500)
    }
  }

  if (grantType === "refresh_token") {
    const refreshToken = form.get("refresh_token")?.trim() ?? ""
    if (!refreshToken) {
      return oauthErrorResponse({
        error: "invalid_request",
        description: "refresh_token is required.",
      })
    }

    try {
      const rotated = await rotateRefreshToken({
        refreshToken,
        clientDbId: client.id,
      })
      if (!rotated.ok) return oauthErrorResponse(rotated.failure)

      await touchClient(client.id)
      return tokenResponse(rotated.tokens)
    } catch {
      return oauthErrorResponse({ error: "server_error" }, 500)
    }
  }

  return oauthErrorResponse({
    error: "unsupported_grant_type",
    description: "Supported grants: authorization_code, refresh_token.",
  })
}
