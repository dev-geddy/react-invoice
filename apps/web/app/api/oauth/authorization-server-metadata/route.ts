import { NextResponse } from "next/server"

import { isMcpEnabled, issuerOrigin } from "@/app/_lib/oauth/config"
import {
  connectorDisabledResponse,
  METADATA_CACHE_HEADERS,
  oauthErrorResponse,
} from "@/app/_lib/oauth/errors"
import { getConnectorSettings } from "@/app/_lib/oauth/connector-config"
import { MCP_SCOPES, type DcrMode } from "@/app/_lib/oauth/types"

// `issuerOrigin()` is a plain env read, but this route is served through the
// same node runtime as the rest of the OAuth surface.
export const runtime = "nodejs"

/**
 * GET /.well-known/oauth-authorization-server — RFC 8414 authorization server
 * metadata (reached through a rewrite in `next.config.ts`, so no dot-prefixed
 * app folder is needed).
 *
 * This document is how a Claude client discovers where to register, authorize
 * and exchange. Every URL is derived from `issuerOrigin()`, the same helper the
 * protected-resource document and the audience check use, so the issuer, the
 * resource and the endpoints can never disagree.
 *
 * What it advertises is a promise the rest of the server keeps: `S256` only
 * (`L2-MCP-26`), the client auth methods the token endpoint really accepts
 * (`L2-MCP-52`), and `registration_endpoint` only while dynamic registration is
 * switched on — advertising an endpoint that answers `404` would send clients
 * down a flow that cannot complete (`L2-MCP-47`).
 *
 * Status codes: 200 · 404 connector disabled · 500 unconfigured issuer.
 *
 * @spec L2-MCP-10, L2-MCP-18, L2-MCP-26, L2-MCP-37, L2-MCP-47, L2-MCP-52
 */
export async function GET() {
  if (!(await isMcpEnabled())) return connectorDisabledResponse()

  let issuer: string
  try {
    issuer = issuerOrigin()
  } catch {
    return oauthErrorResponse({ error: "server_error" }, 500)
  }

  // Fail closed: if the settings can't be read, advertise no registration
  // endpoint rather than one that may not exist. This document is cached for an
  // hour, so a mode change propagates to clients on that timescale — harmless
  // in both directions, since the route itself is the authority.
  let dcrMode: DcrMode = "off"
  try {
    dcrMode = (await getConnectorSettings()).dcrMode
  } catch {
    // Keep `off`.
  }

  return NextResponse.json(
    {
      issuer,
      authorization_endpoint: `${issuer}/api/oauth/authorize`,
      token_endpoint: `${issuer}/api/oauth/token`,
      ...(dcrMode === "off"
        ? {}
        : { registration_endpoint: `${issuer}/api/oauth/register` }),
      revocation_endpoint: `${issuer}/api/oauth/revoke`,
      scopes_supported: [...MCP_SCOPES],
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code", "refresh_token"],
      code_challenge_methods_supported: ["S256"],
      token_endpoint_auth_methods_supported: [
        "none",
        "client_secret_post",
        "client_secret_basic",
      ],
      revocation_endpoint_auth_methods_supported: ["none"],
    },
    { status: 200, headers: METADATA_CACHE_HEADERS }
  )
}
