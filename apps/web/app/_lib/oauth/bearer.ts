import { NextResponse } from "next/server"

import { db, hashToken, oauthClients, oauthTokens, users } from "@workspace/db"
import { eq } from "drizzle-orm"

import { mcpResourceUrl, protectedResourceMetadataUrl } from "./config"
import { touchClient } from "./clients"
import { NO_STORE_HEADERS } from "./errors"
import { mcpLimiter } from "./limits"
import { grantableScopes, intersectScopes, parseScopes } from "./scopes"
import type { McpAuthContext } from "./types"

/**
 * The bearer gate in front of `/api/mcp`. Everything the resource server knows
 * about the caller is resolved here, live from the database on every request:
 * the role is never frozen into the token (`L2-MCP-19`), and the token's
 * `userTokenVersion` must still match the user's (`L2-MCP-29`), so a password
 * change or an admin role edit takes effect on the very next call.
 *
 * @spec L2-MCP-03, L2-MCP-29, L2-MCP-30, L2-MCP-33, L2-MCP-34, L2-MCP-39
 */

/**
 * The challenge that makes a Claude client start the OAuth dance: it points at
 * our RFC 9728 document, which points at the authorization server.
 */
function challengeHeaders(): Record<string, string> {
  return {
    "WWW-Authenticate": `Bearer resource_metadata="${protectedResourceMetadataUrl()}", error="invalid_token"`,
    ...NO_STORE_HEADERS,
  }
}

/** `401` with the discovery challenge. Body stays generic (`L2-MCP-41`). */
function unauthorized(): NextResponse {
  return NextResponse.json(
    { error: "invalid_token" },
    { status: 401, headers: challengeHeaders() }
  )
}

/** The raw bearer credential from an `Authorization` header, if well-formed. */
function readBearer(request: Request): string | null {
  const header = request.headers.get("authorization")
  if (!header) return null
  const match = /^Bearer[ ]+(.+)$/i.exec(header.trim())
  return match?.[1]?.trim() || null
}

/**
 * Resolve a raw access token to a request identity, or null. Rejects — with no
 * distinction between the reasons — a token that is unknown, of the wrong type,
 * revoked, expired, bound to a different audience (`L2-MCP-33`), or whose user
 * has vanished or bumped `tokenVersion` since issue (`L2-MCP-29`).
 *
 * Scopes are re-intersected with the user's live capabilities, so a demoted
 * account's existing token silently narrows instead of keeping stale power
 * (`L2-MCP-34`).
 */
export async function verifyAccessToken(
  raw: string
): Promise<McpAuthContext | null> {
  if (!raw) return null

  const [row] = await db
    .select({
      token: oauthTokens,
      clientDbId: oauthClients.id,
      clientId: oauthClients.clientId,
      clientName: oauthClients.clientName,
    })
    .from(oauthTokens)
    .innerJoin(oauthClients, eq(oauthTokens.clientId, oauthClients.id))
    .where(eq(oauthTokens.tokenHash, hashToken(raw)))

  if (!row) return null
  const token = row.token

  if (token.type !== "access") return null
  if (token.revokedAt) return null
  if (token.expiresAt.getTime() <= Date.now()) return null
  // A token issued for another audience must not work here (RFC 8707). A null
  // `resource` predates audience binding for this grant and stays acceptable.
  if (token.resource !== null && token.resource !== mcpResourceUrl())
    return null

  const [user] = await db
    .select({ role: users.role, tokenVersion: users.tokenVersion })
    .from(users)
    .where(eq(users.id, token.userId))

  if (!user) return null
  if (user.tokenVersion !== token.userTokenVersion) return null

  const scopes = intersectScopes(
    parseScopes(token.scopes.join(" ")),
    grantableScopes(user.role)
  )

  // Usage telemetry only — never let it fail a tool call.
  try {
    await db
      .update(oauthTokens)
      .set({ lastUsedAt: new Date() })
      .where(eq(oauthTokens.id, token.id))
    await touchClient(row.clientDbId)
  } catch {
    // Ignored on purpose.
  }

  return {
    userId: token.userId,
    role: user.role,
    clientId: row.clientId,
    clientName: row.clientName,
    scopes,
    tokenId: token.id,
    expiresAt: token.expiresAt,
  }
}

/**
 * Gate an MCP request: rate-limit, authenticate, or hand back the `401` the
 * client needs to see. Returns either the identity or a ready-made `Response`;
 * callers just check `instanceof Response`.
 *
 * The limiter is keyed on the token **hash** (never the raw token, which would
 * then live in a process-wide Map) and runs before any db work, so a flood
 * costs a counter increment (`L2-MCP-30`).
 */
export async function requireBearer(
  request: Request
): Promise<McpAuthContext | Response> {
  const raw = readBearer(request)
  if (!raw) return unauthorized()

  const key = hashToken(raw)
  if (mcpLimiter.blocked(key)) {
    return NextResponse.json(
      { error: "invalid_request" },
      {
        status: 429,
        headers: {
          "Retry-After": String(
            Math.max(1, Math.ceil(mcpLimiter.retryAfterMs(key) / 1000))
          ),
          ...NO_STORE_HEADERS,
        },
      }
    )
  }
  mcpLimiter.hit(key)

  let context: McpAuthContext | null
  try {
    context = await verifyAccessToken(raw)
  } catch {
    // Never leak a db failure through the auth path (`L2-MCP-41`).
    return unauthorized()
  }

  return context ?? unauthorized()
}
