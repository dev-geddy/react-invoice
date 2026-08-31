import { NextResponse } from "next/server"

import { isMcpEnabled } from "@/app/_lib/oauth/config"
import {
  connectorDisabledResponse,
  NO_STORE_HEADERS,
  oauthErrorResponse,
} from "@/app/_lib/oauth/errors"
import { revokeRawToken } from "@/app/_lib/oauth/tokens"

// Writes to postgres via pg — Node runtime, not edge.
export const runtime = "nodejs"

const FORM_CONTENT_TYPE = "application/x-www-form-urlencoded"

/**
 * POST /api/oauth/revoke — token revocation (RFC 7009), form-encoded
 * `{token, token_type_hint?}`.
 *
 * Answers `200` for anything that parses, including tokens that never existed:
 * per RFC 7009 §2.2 the client's goal is "this token no longer works", which an
 * unknown token already satisfies, and a distinguishable response would turn
 * the endpoint into a token-validity oracle.
 *
 * Revoking any token of a grant revokes its whole refresh family (`L2-MCP-16`)
 * — a disconnect means the connection, not one string. `token_type_hint` is
 * accepted and ignored: the hash lookup finds the row either way.
 *
 * Status codes: 200 always · 400 wrong content type / missing token ·
 * 404 connector disabled.
 *
 * @spec L2-MCP-16, L2-MCP-27, L2-MCP-37, L2-MCP-41
 */
export async function POST(request: Request) {
  if (!(await isMcpEnabled())) return connectorDisabledResponse()

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

  const token = form.get("token")?.trim() ?? ""
  if (!token) {
    return oauthErrorResponse({
      error: "invalid_request",
      description: "Missing token.",
    })
  }

  try {
    await revokeRawToken(token)
  } catch {
    // Still a 200: a storage hiccup must not tell the caller anything about
    // the token, and the client has nothing useful to do with the error.
  }

  return new NextResponse(null, { status: 200, headers: NO_STORE_HEADERS })
}
