import { NextResponse } from "next/server"

import type { OAuthFailure } from "./types"

/**
 * RFC 6749 error shaping. Two shapes, and which one applies is a security
 * decision, not a style one:
 * - the client's `redirect_uri` is proven registered → redirect there with
 *   `error`/`error_description`/`state`;
 * - it is not (bad `client_id`, unmatched URI) → render on our own origin, so
 *   we never bounce a user to an attacker-supplied URL (`L2-MCP-31`).
 *
 * Descriptions are fixed strings chosen by the caller — never request input,
 * which would be reflected straight into a URL or an HTML-ish body. Bodies stay
 * generic: no stack traces, no db errors, no hint whether a client, code or
 * user exists (`L2-MCP-41`).
 *
 * @spec L2-MCP-31, L2-MCP-40, L2-MCP-41
 */

/** Token/authorization responses must never be cached (RFC 6749 §5.1). */
export const NO_STORE_HEADERS = { "Cache-Control": "no-store" } as const

/** Metadata documents are public and stable enough to cache for an hour. */
export const METADATA_CACHE_HEADERS = {
  "Cache-Control": "public, max-age=3600",
} as const

/** The JSON body of an OAuth error response. */
export function oauthErrorBody(failure: OAuthFailure): {
  error: string
  error_description?: string
} {
  return failure.description
    ? { error: failure.error, error_description: failure.description }
    : { error: failure.error }
}

/**
 * A direct OAuth error response (token, revoke, DCR). `400` by default — the
 * token endpoint answers every parameter/grant failure with 400 per
 * `L2-MCP-40`.
 */
export function oauthErrorResponse(
  failure: OAuthFailure,
  status = 400
): NextResponse {
  return NextResponse.json(oauthErrorBody(failure), {
    status,
    headers: NO_STORE_HEADERS,
  })
}

/**
 * Build the error redirect back to a **validated** redirect URI. Existing query
 * parameters on the registered URI are preserved; `state` is echoed only when
 * the client sent one.
 */
export function buildErrorRedirectUrl(
  redirectUri: string,
  failure: OAuthFailure,
  state: string | null
): string {
  const url = new URL(redirectUri)
  url.searchParams.set("error", failure.error)
  if (failure.description) {
    url.searchParams.set("error_description", failure.description)
  }
  if (state !== null) url.searchParams.set("state", state)
  return url.toString()
}

/**
 * Redirect an authorization failure back to the client. Caller must have
 * matched `redirectUri` against the registered set first — this helper trusts
 * it (`L2-MCP-31`).
 */
export function oauthErrorRedirect(input: {
  redirectUri: string
  failure: OAuthFailure
  state: string | null
}): NextResponse {
  const target = buildErrorRedirectUrl(
    input.redirectUri,
    input.failure,
    input.state
  )
  return NextResponse.redirect(target, {
    status: 302,
    headers: NO_STORE_HEADERS,
  })
}

/**
 * A fatal authorization error, rendered on our own origin as plain text. Used
 * when the request cannot be trusted enough to redirect anywhere: unknown
 * `client_id`, or a `redirect_uri` that isn't registered.
 */
export function fatalAuthorizeResponse(
  failure: OAuthFailure,
  status = 400
): NextResponse {
  const detail = failure.description ? `\n\n${failure.description}` : ""
  return new NextResponse(
    `Authorization request rejected: ${failure.error}${detail}\n`,
    {
      status,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        ...NO_STORE_HEADERS,
      },
    }
  )
}

/**
 * The kill-switch response. Plain `404` with no body detail — while the
 * connector is off (the `connector_config.enabled` flag, or the `MCP_ENABLED`
 * forced-off override) its surface simply does not exist (`L2-MCP-37`).
 */
export function connectorDisabledResponse(): NextResponse {
  return new NextResponse("Not Found", {
    status: 404,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      ...NO_STORE_HEADERS,
    },
  })
}

/** Over-limit response with `Retry-After`, per `L2-MCP-30`. */
export function rateLimitedResponse(retryAfterMs: number): NextResponse {
  return NextResponse.json(
    oauthErrorBody({
      error: "invalid_request",
      description: "Too many requests — try again shortly.",
    }),
    {
      status: 429,
      headers: {
        "Retry-After": String(Math.max(1, Math.ceil(retryAfterMs / 1000))),
        ...NO_STORE_HEADERS,
      },
    }
  )
}
