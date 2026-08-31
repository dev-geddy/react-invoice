import { describe, expect, it } from "vitest"

import {
  buildErrorRedirectUrl,
  connectorDisabledResponse,
  fatalAuthorizeResponse,
  oauthErrorBody,
  oauthErrorResponse,
  rateLimitedResponse,
} from "./errors"

/**
 * Error shaping (`L2-MCP-40`) and the generic-body rule (`L2-MCP-41`): an OAuth
 * error must be machine-readable and must never leak internals or become an
 * open redirect.
 */

describe("oauthErrorBody", () => {
  it("omits error_description when there is none", () => {
    expect(oauthErrorBody({ error: "invalid_grant" })).toEqual({
      error: "invalid_grant",
    })
    expect(
      oauthErrorBody({ error: "invalid_scope", description: "Nope." })
    ).toEqual({ error: "invalid_scope", error_description: "Nope." })
  })
})

describe("oauthErrorResponse", () => {
  it("is a 400 JSON body with no-store by default", async () => {
    const res = oauthErrorResponse({ error: "invalid_request" })
    expect(res.status).toBe(400)
    expect(res.headers.get("cache-control")).toBe("no-store")
    await expect(res.json()).resolves.toEqual({ error: "invalid_request" })
  })

  it("honours an explicit status", () => {
    expect(oauthErrorResponse({ error: "server_error" }, 500).status).toBe(500)
  })
})

describe("buildErrorRedirectUrl", () => {
  it("appends error, description and state", () => {
    const url = new URL(
      buildErrorRedirectUrl(
        "https://claude.ai/api/mcp/auth_callback",
        { error: "access_denied", description: "Denied." },
        "abc123"
      )
    )
    expect(url.origin + url.pathname).toBe(
      "https://claude.ai/api/mcp/auth_callback"
    )
    expect(url.searchParams.get("error")).toBe("access_denied")
    expect(url.searchParams.get("error_description")).toBe("Denied.")
    expect(url.searchParams.get("state")).toBe("abc123")
  })

  it("omits state when the client never sent one", () => {
    const url = new URL(
      buildErrorRedirectUrl(
        "https://client.example/cb",
        { error: "invalid_scope" },
        null
      )
    )
    expect(url.searchParams.has("state")).toBe(false)
    expect(url.searchParams.has("error_description")).toBe(false)
  })

  it("preserves query parameters already on the registered URI", () => {
    const url = new URL(
      buildErrorRedirectUrl(
        "https://client.example/cb?tenant=acme",
        { error: "invalid_request" },
        null
      )
    )
    expect(url.searchParams.get("tenant")).toBe("acme")
    expect(url.searchParams.get("error")).toBe("invalid_request")
  })
})

describe("fatalAuthorizeResponse", () => {
  it("renders plain text on our own origin, never a redirect", async () => {
    const res = fatalAuthorizeResponse({
      error: "invalid_client",
      description: "Unknown client.",
    })
    expect(res.status).toBe(400)
    expect(res.headers.get("location")).toBeNull()
    expect(res.headers.get("content-type")).toContain("text/plain")
    await expect(res.text()).resolves.toContain("invalid_client")
  })
})

describe("connectorDisabledResponse", () => {
  it("is a bare 404 (`L2-MCP-37`)", async () => {
    const res = connectorDisabledResponse()
    expect(res.status).toBe(404)
    await expect(res.text()).resolves.toBe("Not Found")
  })
})

describe("rateLimitedResponse", () => {
  it("is a 429 with Retry-After in whole seconds, never below 1", () => {
    expect(rateLimitedResponse(4500).headers.get("retry-after")).toBe("5")
    expect(rateLimitedResponse(0).headers.get("retry-after")).toBe("1")
    expect(rateLimitedResponse(0).status).toBe(429)
  })
})
