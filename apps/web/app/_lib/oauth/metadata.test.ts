import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { GET as authorizationServerMetadata } from "@/app/api/oauth/authorization-server-metadata/route"
import { GET as protectedResourceMetadata } from "@/app/api/oauth/protected-resource-metadata/route"

/**
 * The two discovery documents (`L2-MCP-10`, `L2-MCP-11`). A Claude client
 * bootstraps the whole connector from these, so their shape is a contract:
 * wrong `issuer`/`resource` and the flow either never starts or produces
 * tokens bound to the wrong audience (`L2-MCP-33`). Also locks the kill switch
 * (`L2-MCP-37`).
 */

const ORIGIN = "https://app.example.com"

const h = vi.hoisted(() => ({
  state: { enabled: true, dcrMode: "off" as "off" | "allowlist" | "open" },
}))

vi.mock("@workspace/db", async () => {
  process.env.DATABASE_URL ??= "postgres://test:test@127.0.0.1:5432/test"
  const actual =
    await vi.importActual<typeof import("@workspace/db")>("@workspace/db")
  return { ...actual, db: {} }
})

vi.mock("@/app/_lib/oauth/connector-config", async () => {
  const actual = await vi.importActual<
    typeof import("@/app/_lib/oauth/connector-config")
  >("@/app/_lib/oauth/connector-config")
  const settings = () => ({
    enabled: h.state.enabled,
    dcrMode: h.state.dcrMode,
    redirectHosts: ["claude.ai"],
  })
  return {
    ...actual,
    getConnectorSettings: async () => settings(),
    // The enabled gate reads through the cache (`L2-MCP-54`).
    getCachedConnectorSettings: async () => settings(),
  }
})

beforeEach(() => {
  h.state.enabled = true
  h.state.dcrMode = "off"
  vi.stubEnv("AUTH_URL", `${ORIGIN}/`)
  vi.stubEnv("MCP_ENABLED", undefined)
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("authorization server metadata", () => {
  it("404s while the connector is disabled", async () => {
    h.state.enabled = false
    expect((await authorizationServerMetadata()).status).toBe(404)
  })

  it("advertises every endpoint on the issuer origin", async () => {
    h.state.dcrMode = "open"
    const res = await authorizationServerMetadata()
    expect(res.status).toBe(200)
    expect(res.headers.get("cache-control")).toBe("public, max-age=3600")

    const doc = await res.json()
    expect(doc).toEqual({
      issuer: ORIGIN,
      authorization_endpoint: `${ORIGIN}/api/oauth/authorize`,
      token_endpoint: `${ORIGIN}/api/oauth/token`,
      registration_endpoint: `${ORIGIN}/api/oauth/register`,
      revocation_endpoint: `${ORIGIN}/api/oauth/revoke`,
      scopes_supported: ["account", "dashboard", "users.view", "settings"],
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code", "refresh_token"],
      code_challenge_methods_supported: ["S256"],
      token_endpoint_auth_methods_supported: [
        "none",
        "client_secret_post",
        "client_secret_basic",
      ],
      revocation_endpoint_auth_methods_supported: ["none"],
    })
  })

  it("omits the registration endpoint while DCR is off", async () => {
    // Advertising a route that answers 404 sends clients down a flow that
    // cannot complete (`L2-MCP-47`).
    const doc = await (await authorizationServerMetadata()).json()
    expect(doc.registration_endpoint).toBeUndefined()
    expect(doc.token_endpoint).toBe(`${ORIGIN}/api/oauth/token`)
  })

  it("advertises registration in allowlist mode", async () => {
    h.state.dcrMode = "allowlist"
    const doc = await (await authorizationServerMetadata()).json()
    expect(doc.registration_endpoint).toBe(`${ORIGIN}/api/oauth/register`)
  })

  it("never advertises plain PKCE or implicit", async () => {
    const doc = await (await authorizationServerMetadata()).json()
    expect(doc.code_challenge_methods_supported).not.toContain("plain")
    expect(doc.grant_types_supported).not.toContain("implicit")
    expect(doc.scopes_supported).not.toContain("users.edit")
  })
})

describe("protected resource metadata", () => {
  it("404s while the connector is disabled", async () => {
    h.state.enabled = false
    expect((await protectedResourceMetadata()).status).toBe(404)
  })

  it("points at the MCP endpoint and back at the issuer", async () => {
    const res = await protectedResourceMetadata()
    expect(res.status).toBe(200)
    expect(res.headers.get("cache-control")).toBe("public, max-age=3600")

    await expect(res.json()).resolves.toEqual({
      resource: `${ORIGIN}/api/mcp`,
      authorization_servers: [ORIGIN],
      scopes_supported: ["account", "dashboard", "users.view", "settings"],
      bearer_methods_supported: ["header"],
    })
  })

  it("agrees with the authorization server document on the issuer", async () => {
    const as = await (await authorizationServerMetadata()).json()
    const prm = await (await protectedResourceMetadata()).json()
    expect(prm.authorization_servers).toEqual([as.issuer])
    expect(prm.resource.startsWith(as.issuer)).toBe(true)
  })
})
