import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { validateAuthorizationRequest } from "./authorize"
import type { OAuthClientRecord } from "./clients"

/**
 * Authorization request validation. The load-bearing assertion is the fatal /
 * non-fatal split: an error may only be redirected to a URI already proven
 * registered (`L2-MCP-31`), and PKCE S256 is non-negotiable (`L2-MCP-26`).
 * The live host-allowlist re-check (`L2-MCP-49`) is asserted here too, since
 * that is the only thing that makes removing a host take effect immediately.
 * Only the client lookup and the settings read are stubbed — no database.
 */

const REGISTERED = "https://claude.ai/api/mcp/auth_callback"
const CHALLENGE = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"

const h = vi.hoisted(() => ({
  state: {
    client: null as unknown,
    redirectHosts: ["claude.ai"] as string[],
    settingsFail: false,
  },
}))

vi.mock("@workspace/db", async () => {
  process.env.DATABASE_URL ??= "postgres://test:test@127.0.0.1:5432/test"
  const actual =
    await vi.importActual<typeof import("@workspace/db")>("@workspace/db")
  return { ...actual, db: {} }
})

vi.mock("./clients", async () => {
  const actual = await vi.importActual<typeof import("./clients")>("./clients")
  return {
    ...actual,
    findClientByClientId: async () => h.state.client,
  }
})

vi.mock("./connector-config", async () => {
  const actual =
    await vi.importActual<typeof import("./connector-config")>(
      "./connector-config"
    )
  return {
    ...actual,
    getConnectorSettings: async () => {
      if (h.state.settingsFail) throw new Error("db down")
      return { dcrMode: "off" as const, redirectHosts: h.state.redirectHosts }
    },
  }
})

function client(overrides: Partial<OAuthClientRecord> = {}): OAuthClientRecord {
  return {
    id: "client-row-1",
    clientId: "public-client-id",
    clientSecretHash: null,
    clientName: "Claude",
    origin: "manual",
    createdByUserId: "owner-1",
    allowLoopbackPorts: false,
    redirectUris: [REGISTERED],
    grantTypes: ["authorization_code", "refresh_token"],
    scopes: ["account", "dashboard", "users.view", "settings"],
    tokenEndpointAuthMethod: "none",
    createdAt: new Date(),
    lastUsedAt: null,
    ...overrides,
  }
}

function params(overrides: Record<string, string | null> = {}) {
  const base: Record<string, string | null> = {
    response_type: "code",
    client_id: "public-client-id",
    redirect_uri: REGISTERED,
    code_challenge: CHALLENGE,
    code_challenge_method: "S256",
    state: "xyz",
    scope: "account users.view",
  }
  const merged = { ...base, ...overrides }
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(merged)) {
    if (value !== null) search.set(key, value)
  }
  return search
}

beforeEach(() => {
  h.state.client = client()
  h.state.redirectHosts = ["claude.ai"]
  h.state.settingsFail = false
  vi.stubEnv("AUTH_URL", "https://app.example.com")
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("validateAuthorizationRequest — fatal (never redirect)", () => {
  it("rejects a missing client_id on our origin", async () => {
    const result = await validateAuthorizationRequest(
      params({ client_id: null })
    )
    expect(result).toMatchObject({ ok: false, fatal: true })
  })

  it("rejects an unknown client on our origin", async () => {
    h.state.client = null
    const result = await validateAuthorizationRequest(params())
    expect(result).toMatchObject({
      ok: false,
      fatal: true,
      failure: { error: "invalid_client" },
    })
  })

  it("never redirects to an unregistered redirect_uri", async () => {
    const result = await validateAuthorizationRequest(
      params({ redirect_uri: "https://evil.example/cb" })
    )
    expect(result).toMatchObject({ ok: false, fatal: true })
  })

  it("rejects a redirect_uri that is only a prefix match", async () => {
    const result = await validateAuthorizationRequest(
      params({ redirect_uri: `${REGISTERED}/../evil` })
    )
    expect(result).toMatchObject({ ok: false, fatal: true })
  })

  it("rejects a missing redirect_uri rather than guessing one", async () => {
    const result = await validateAuthorizationRequest(
      params({ redirect_uri: null })
    )
    expect(result).toMatchObject({ ok: false, fatal: true })
  })

  it("breaks a registered client once its host leaves the allowlist", async () => {
    // The client and its redirect URI are unchanged — only the owner's list is.
    h.state.redirectHosts = ["claude.com"]
    const result = await validateAuthorizationRequest(params())
    expect(result).toMatchObject({
      ok: false,
      fatal: true,
      failure: { error: "invalid_request" },
    })
  })

  it("fails closed when the allowlist cannot be read", async () => {
    h.state.settingsFail = true
    const result = await validateAuthorizationRequest(params())
    expect(result).toMatchObject({
      ok: false,
      fatal: true,
      failure: { error: "server_error" },
    })
  })
})

describe("validateAuthorizationRequest — redirected errors", () => {
  it("rejects a non-code response_type back to the client", async () => {
    const result = await validateAuthorizationRequest(
      params({ response_type: "token" })
    )
    expect(result).toMatchObject({
      ok: false,
      fatal: false,
      redirectUri: REGISTERED,
      state: "xyz",
      failure: { error: "invalid_request" },
    })
  })

  it("rejects a missing code_challenge", async () => {
    const result = await validateAuthorizationRequest(
      params({ code_challenge: null })
    )
    expect(result).toMatchObject({ ok: false, fatal: false })
  })

  it("rejects the plain PKCE method, and an absent method", async () => {
    for (const method of ["plain", "S512", null]) {
      const result = await validateAuthorizationRequest(
        params({ code_challenge_method: method })
      )
      expect(result).toMatchObject({ ok: false, fatal: false })
    }
  })

  it("rejects a scope request that contains nothing we offer", async () => {
    const result = await validateAuthorizationRequest(
      params({ scope: "users.edit root" })
    )
    expect(result).toMatchObject({
      ok: false,
      fatal: false,
      failure: { error: "invalid_scope" },
    })
  })

  it("rejects a resource that is not this MCP endpoint", async () => {
    const result = await validateAuthorizationRequest(
      params({ resource: "https://app.example.com/api/other" })
    )
    expect(result).toMatchObject({ ok: false, fatal: false })
  })

  it("carries a null state through when the client sent none", async () => {
    const result = await validateAuthorizationRequest(
      params({ state: null, response_type: "token" })
    )
    expect(result).toMatchObject({ ok: false, fatal: false, state: null })
  })
})

describe("validateAuthorizationRequest — success", () => {
  it("returns the validated request and the client's db id", async () => {
    const result = await validateAuthorizationRequest(params())
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.clientDbId).toBe("client-row-1")
    expect(result.request).toEqual({
      clientId: "public-client-id",
      clientName: "Claude",
      redirectUri: REGISTERED,
      scopes: ["account", "users.view"],
      state: "xyz",
      codeChallenge: CHALLENGE,
      codeChallengeMethod: "S256",
      resource: null,
    })
  })

  it("drops unknown scopes instead of failing the request", async () => {
    const result = await validateAuthorizationRequest(
      params({ scope: "account users.edit offline_access" })
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.request.scopes).toEqual(["account"])
  })

  it("treats an absent scope as every offered scope", async () => {
    const result = await validateAuthorizationRequest(params({ scope: null }))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.request.scopes).toEqual([
      "account",
      "dashboard",
      "users.view",
      "settings",
    ])
  })

  it("accepts an ephemeral loopback port for a native client, unlisted host and all", async () => {
    h.state.redirectHosts = []
    h.state.client = client({
      allowLoopbackPorts: true,
      redirectUris: ["http://127.0.0.1:8080/callback"],
    })
    const result = await validateAuthorizationRequest(
      params({ redirect_uri: "http://127.0.0.1:54321/callback" })
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.request.redirectUri).toBe("http://127.0.0.1:54321/callback")
  })

  it("accepts and normalizes the MCP resource indicator", async () => {
    const result = await validateAuthorizationRequest(
      params({ resource: "https://app.example.com/api/mcp/" })
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.request.resource).toBe("https://app.example.com/api/mcp")
  })
})
