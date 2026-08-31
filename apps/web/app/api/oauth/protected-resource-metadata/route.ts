import { NextResponse } from "next/server"

import {
  isMcpEnabled,
  issuerOrigin,
  mcpResourceUrl,
} from "@/app/_lib/oauth/config"
import {
  connectorDisabledResponse,
  METADATA_CACHE_HEADERS,
  oauthErrorResponse,
} from "@/app/_lib/oauth/errors"
import { MCP_SCOPES } from "@/app/_lib/oauth/types"

export const runtime = "nodejs"

/**
 * GET /.well-known/oauth-protected-resource (and the path-suffixed
 * `/.well-known/oauth-protected-resource/api/mcp`, both via rewrites in
 * `next.config.ts`) — RFC 9728 protected resource metadata.
 *
 * This is the document the `WWW-Authenticate` challenge points at: a client
 * that gets a `401` from `/api/mcp` reads it, learns which authorization server
 * governs the resource, and starts the OAuth flow there. `resource` must match
 * the audience bound into tokens (`L2-MCP-33`) — both come from
 * `mcpResourceUrl()`.
 *
 * Status codes: 200 · 404 connector disabled · 500 unconfigured issuer.
 *
 * @spec L2-MCP-11, L2-MCP-18, L2-MCP-33, L2-MCP-37
 */
export async function GET() {
  if (!(await isMcpEnabled())) return connectorDisabledResponse()

  let issuer: string
  let resource: string
  try {
    issuer = issuerOrigin()
    resource = mcpResourceUrl()
  } catch {
    return oauthErrorResponse({ error: "server_error" }, 500)
  }

  return NextResponse.json(
    {
      resource,
      authorization_servers: [issuer],
      scopes_supported: [...MCP_SCOPES],
      bearer_methods_supported: ["header"],
    },
    { status: 200, headers: METADATA_CACHE_HEADERS }
  )
}
