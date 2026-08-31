import { mcpResourceUrl } from "./config"
import {
  findClientByClientId,
  redirectUriAllowed,
  redirectUriHost,
  type OAuthClientRecord,
} from "./clients"
import { getConnectorSettings, isHostAllowed } from "./connector-config"
import { isValidCodeChallenge } from "./codes"
import { parseScopes } from "./scopes"
import {
  MCP_SCOPES,
  type AuthorizationRequest,
  type OAuthFailure,
} from "./types"

/**
 * Validation of an `/api/oauth/authorize` request. Shared by the route (which
 * hands a valid request to the consent screen) and by `/backflip/connect`
 * itself, which re-validates before minting a code — the consent page must
 * never trust the query string it was handed.
 *
 * The three-way result encodes the one rule that matters: an error may only be
 * redirected to a `redirect_uri` we have already proven is registered. Anything
 * upstream of that proof is `fatal` and renders on our own origin
 * (`L2-MCP-31`, `L2-MCP-40`).
 *
 * @spec L2-MCP-13, L2-MCP-26, L2-MCP-31, L2-MCP-33, L2-MCP-34, L2-MCP-40,
 *       L2-MCP-49
 */

export type AuthorizeValidation =
  | { ok: true; request: AuthorizationRequest; clientDbId: string }
  /** Render on OUR origin — the redirect target isn't trustworthy. */
  | { ok: false; fatal: true; failure: OAuthFailure }
  /** Redirect the error back to the (validated) client. */
  | {
      ok: false
      fatal: false
      redirectUri: string
      state: string | null
      failure: OAuthFailure
    }

const fatal = (failure: OAuthFailure): AuthorizeValidation => ({
  ok: false,
  fatal: true,
  failure,
})

/**
 * Validate an authorization request end to end. Order is deliberate: client and
 * redirect URI first (fatal, never redirected), everything else after (returned
 * to the client as an OAuth error redirect).
 *
 * Scope handling: unknown scopes are dropped; an explicit `scope` that contains
 * nothing we offer is `invalid_scope`; an absent `scope` means "everything this
 * server offers", which the consent screen then intersects with the signed-in
 * user's capabilities (`L2-MCP-34`) — the role isn't known here.
 */
export async function validateAuthorizationRequest(
  params: URLSearchParams
): Promise<AuthorizeValidation> {
  const clientId = params.get("client_id")?.trim() ?? ""
  if (!clientId) {
    return fatal({
      error: "invalid_request",
      description: "Missing client_id.",
    })
  }

  let client: OAuthClientRecord | null
  try {
    client = await findClientByClientId(clientId)
  } catch {
    return fatal({ error: "server_error", description: "Lookup failed." })
  }
  if (!client) {
    return fatal({ error: "invalid_client", description: "Unknown client." })
  }

  const redirectUri = params.get("redirect_uri")?.trim() ?? ""
  if (!redirectUri) {
    return fatal({
      error: "invalid_request",
      description: "Missing redirect_uri.",
    })
  }
  if (!redirectUriAllowed(client, redirectUri)) {
    return fatal({
      error: "invalid_request",
      description: "The redirect_uri is not registered for this client.",
    })
  }

  // Second, live enforcement of the host allowlist (`L2-MCP-49`). Registration
  // already checked it, but the owner may have removed the host since — which
  // must break that client on its very next attempt, not whenever its tokens
  // happen to expire. Fatal: a de-allowlisted host is exactly the destination
  // we must never bounce a user to, so the error renders on our origin.
  let allowedHosts: string[]
  try {
    allowedHosts = (await getConnectorSettings()).redirectHosts
  } catch {
    return fatal({ error: "server_error", description: "Lookup failed." })
  }
  const host = redirectUriHost(redirectUri)
  if (!host || !isHostAllowed(host, allowedHosts)) {
    return fatal({
      error: "invalid_request",
      description: "The redirect_uri host is not allowed on this server.",
    })
  }

  // Past this point the target is proven registered, so errors go back to it.
  const state = params.get("state")
  const reject = (failure: OAuthFailure): AuthorizeValidation => ({
    ok: false,
    fatal: false,
    redirectUri,
    state,
    failure,
  })

  if (params.get("response_type") !== "code") {
    // `unsupported_response_type` isn't in this server's error vocabulary; the
    // code grant is the only flow implemented, so it's a parameter error.
    return reject({
      error: "invalid_request",
      description: "response_type must be code.",
    })
  }

  const codeChallenge = params.get("code_challenge")?.trim() ?? ""
  const codeChallengeMethod = params.get("code_challenge_method")?.trim() ?? ""
  // PKCE is mandatory and S256-only. A missing method defaults to `plain` in
  // RFC 7636, so silence is a rejection, not a default (`L2-MCP-26`).
  if (codeChallengeMethod !== "S256") {
    return reject({
      error: "invalid_request",
      description: "code_challenge_method must be S256.",
    })
  }
  if (!isValidCodeChallenge(codeChallenge)) {
    return reject({
      error: "invalid_request",
      description: "A valid S256 code_challenge is required.",
    })
  }

  const rawScope = params.get("scope")
  const scopes = rawScope === null ? [...MCP_SCOPES] : parseScopes(rawScope)
  if (scopes.length === 0) {
    return reject({
      error: "invalid_scope",
      description: "No supported scope was requested.",
    })
  }

  // RFC 8707: if the client names an audience it must be ours, or the token it
  // ends up with would be bound to a resource we don't serve (`L2-MCP-33`).
  const rawResource = params.get("resource")
  let resource: string | null = null
  if (rawResource !== null && rawResource !== "") {
    const expected = mcpResourceUrl()
    if (rawResource.replace(/\/+$/, "") !== expected) {
      return reject({
        error: "invalid_request",
        description: "Unknown resource.",
      })
    }
    resource = expected
  }

  const request: AuthorizationRequest = {
    clientId: client.clientId,
    clientName: client.clientName,
    redirectUri,
    scopes,
    state,
    codeChallenge,
    codeChallengeMethod: "S256",
    resource,
  }

  return { ok: true, request, clientDbId: client.id }
}
