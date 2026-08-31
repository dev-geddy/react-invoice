import { NextResponse } from "next/server"

import { validateAuthorizationRequest } from "@/app/_lib/oauth/authorize"
import { isMcpEnabled, issuerOrigin } from "@/app/_lib/oauth/config"
import {
  connectorDisabledResponse,
  fatalAuthorizeResponse,
  NO_STORE_HEADERS,
  oauthErrorRedirect,
} from "@/app/_lib/oauth/errors"

// Reads the client registry from postgres via pg — Node runtime, not edge.
export const runtime = "nodejs"

/** Consent lives inside the protected admin scope (`L2-MCP-14`). */
const CONSENT_PATH = "/backflip/connect"

/**
 * GET /api/oauth/authorize — the authorization endpoint (RFC 6749 §3.1).
 *
 * This route only validates and routes; it never authenticates the user and
 * never mints anything. A valid request is handed to `/backflip/connect` with
 * its query string intact — that page sits behind the `/backflip` auth gate
 * (`L2-AUTH-01`), so an anonymous visitor is bounced to login and returns here
 * automatically, and it re-validates before minting a code.
 *
 * The error split is the security-relevant part: a bad `client_id` or an
 * unregistered `redirect_uri` renders on our origin, because redirecting to an
 * unverified URL is exactly the attack (`L2-MCP-31`). Everything downstream of
 * that check goes back to the client as an OAuth error redirect.
 *
 * Status codes: 307 to consent · 302 error redirect to the client ·
 * 400 fatal (untrusted client/redirect) · 404 connector disabled.
 *
 * @spec L2-MCP-13, L2-MCP-26, L2-MCP-31, L2-MCP-37, L2-MCP-40
 */
export async function GET(request: Request) {
  if (!(await isMcpEnabled())) return connectorDisabledResponse()

  const url = new URL(request.url)
  const result = await validateAuthorizationRequest(url.searchParams)

  if (!result.ok) {
    return result.fatal
      ? fatalAuthorizeResponse(result.failure)
      : oauthErrorRedirect({
          redirectUri: result.redirectUri,
          state: result.state,
          failure: result.failure,
        })
  }

  let consentUrl: URL
  try {
    // Built on the configured issuer, not on `request.url`: behind the TLS
    // proxy the incoming request is plain http on localhost.
    consentUrl = new URL(CONSENT_PATH, issuerOrigin())
  } catch {
    return fatalAuthorizeResponse({
      error: "server_error",
      description: "The connector is not configured.",
    })
  }
  consentUrl.search = url.search

  return NextResponse.redirect(consentUrl.toString(), {
    status: 307,
    headers: NO_STORE_HEADERS,
  })
}
