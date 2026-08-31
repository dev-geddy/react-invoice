import { createMcpHandler } from "@modelcontextprotocol/server"
import { NextResponse } from "next/server"

import { requireBearer } from "@/app/_lib/oauth/bearer"
import {
  isMcpEnabled,
  protectedResourceMetadataUrl,
} from "@/app/_lib/oauth/config"
import {
  connectorDisabledResponse,
  NO_STORE_HEADERS,
  rateLimitedResponse,
} from "@/app/_lib/oauth/errors"
import { clientIp, mcpChallengeLimiter } from "@/app/_lib/oauth/limits"
import { buildMcpServer } from "@/app/_lib/mcp/server"

// Talks to `pg` (db) via the bearer gate and every tool — Node runtime, not edge.
export const runtime = "nodejs"

/**
 * Anything this route would accept as a credential. Deliberately *looser* than
 * `readBearer`'s parse in `bearer.ts`: every header that gate can extract a
 * token from also matches this, so a real token is never diverted to the
 * anonymous branch. Headers it does not match carry no token either way, so
 * they cost nothing here.
 */
const BEARER_CREDENTIAL = /^Bearer\s+\S/i

/** Whether the caller presented something that could be a bearer token. */
function hasBearerCredential(request: Request): boolean {
  const header = request.headers.get("authorization")?.trim()
  return !!header && BEARER_CREDENTIAL.test(header)
}

/**
 * The `401` challenge, built from static configuration alone.
 *
 * Byte-identical to the one `requireBearer` returns for an invalid token — same
 * status, same body, same headers — and that is the point: if the free
 * short-circuit answered differently it would tell a caller "no token was even
 * looked up here", i.e. that this server has no live tokens (`L2-MCP-54`).
 * `mcp.test.ts` compares the two responses so they cannot drift apart.
 */
function unauthorizedChallenge(): NextResponse {
  return NextResponse.json(
    { error: "invalid_token" },
    {
      status: 401,
      headers: {
        "WWW-Authenticate": `Bearer resource_metadata="${protectedResourceMetadataUrl()}", error="invalid_token"`,
        ...NO_STORE_HEADERS,
      },
    }
  )
}

/**
 * `/api/mcp` — the MCP Streamable HTTP endpoint (`POST`/`GET`/`DELETE`,
 * answered by the SDK's handler). Stateless: a fresh `McpServer` is built
 * from this request's resolved `McpAuthContext`, so tool visibility always
 * reflects the token's scopes and the account's *current* role — no session,
 * nothing cached across requests.
 *
 * Three gates, in this order, and the order is the security property:
 *
 * 1. **Enabled** (`L2-MCP-25`, `L2-MCP-37`) — off → `404`, from the settings
 *    cache, before anything else. Answering `401` here would advertise that the
 *    route exists on a deployment that never switched the connector on.
 * 2. **Anonymous** (`L2-MCP-54`) — no bearer credential → the static challenge,
 *    with zero database work, capped per IP so it cannot be sprayed. Over the
 *    cap is `429`, not `401`: a caller that is being throttled should be told
 *    to come back, not sent round the OAuth flow again. The challenge itself
 *    cannot be withheld — it is what points a Claude client at our metadata
 *    document, so the whole handshake starts here (`L2-MCP-03`).
 * 3. **Bearer** — the full gate: per-token limit, then live verification of the
 *    token, its audience, its user and their `tokenVersion` (`L2-MCP-39`).
 *
 * @spec L2-MCP-01, L2-MCP-03, L2-MCP-30, L2-MCP-37, L2-MCP-39, L2-MCP-54
 */
async function handle(request: Request): Promise<Response> {
  if (!(await isMcpEnabled())) return connectorDisabledResponse()

  if (!hasBearerCredential(request)) {
    const ip = clientIp(request)
    if (mcpChallengeLimiter.blocked(ip)) {
      return rateLimitedResponse(mcpChallengeLimiter.retryAfterMs(ip))
    }
    mcpChallengeLimiter.hit(ip)
    return unauthorizedChallenge()
  }

  const auth = await requireBearer(request)
  if (auth instanceof Response) return auth

  // Bound to this request's already-resolved auth context — the SDK's own
  // `ctx.authInfo` (passed below) is not consulted; `requireBearer` is the
  // single source of truth for who this request is.
  const handler = createMcpHandler(() => buildMcpServer(auth))

  const rawToken =
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? ""

  return handler.fetch(request, {
    authInfo: {
      token: rawToken,
      clientId: auth.clientId,
      scopes: auth.scopes,
      expiresAt: Math.floor(auth.expiresAt.getTime() / 1000),
    },
  })
}

export const POST = handle
export const GET = handle
export const DELETE = handle
