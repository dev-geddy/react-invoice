import bcrypt from "bcryptjs"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { POST as token } from "@/app/api/oauth/token/route"
import type { OAuthClientRecord } from "./clients"

/**
 * Client authentication at the token endpoint (`L2-MCP-52`).
 *
 * The two branches that matter: a client WITH a stored secret must present a
 * valid one, and a client WITHOUT one must have a presented secret refused
 * rather than ignored — silently accepting it would tell a caller it had
 * authenticated when it had not. PKCE stays mandatory either way
 * (`L2-MCP-26`). Only the client lookup and the grant machinery are stubbed.
 */

const SECRET = "client-secret-value"
const CODE_FORM = {
  grant_type: "authorization_code",
  code: "auth-code",
  redirect_uri: "https://claude.ai/cb",
  code_verifier: "verifier-verifier-verifier-verifier-ver",
}

const h = vi.hoisted(() => ({
  state: { client: null as unknown },
  calls: { lookups: [] as string[], consumed: 0 },
}))

vi.mock("@workspace/db", async () => {
  process.env.DATABASE_URL ??= "postgres://test:test@127.0.0.1:5432/test"
  const actual =
    await vi.importActual<typeof import("@workspace/db")>("@workspace/db")
  return { ...actual, db: {} }
})

// The connector is on for these tests; the enabled gate reads through the
// settings cache (`L2-MCP-54`), never the database, on a normal request.
vi.mock("@/app/_lib/oauth/connector-config", () => ({
  getCachedConnectorSettings: async () => ({
    enabled: true,
    dcrMode: "off" as const,
    redirectHosts: [],
  }),
}))

vi.mock("@/app/_lib/oauth/clients", async () => {
  const actual = await vi.importActual<
    typeof import("@/app/_lib/oauth/clients")
  >("@/app/_lib/oauth/clients")
  return {
    ...actual,
    findClientByClientId: async (clientId: string) => {
      h.calls.lookups.push(clientId)
      return h.state.client
    },
    touchClient: async () => {},
  }
})

vi.mock("@/app/_lib/oauth/codes", async () => {
  const actual = await vi.importActual<typeof import("@/app/_lib/oauth/codes")>(
    "@/app/_lib/oauth/codes"
  )
  return {
    ...actual,
    consumeAuthorizationCode: async () => {
      h.calls.consumed += 1
      return {
        ok: true as const,
        userId: "user-1",
        scopes: ["account"],
        resource: null,
        familyId: "family-1",
      }
    },
  }
})

vi.mock("@/app/_lib/oauth/tokens", async () => {
  const actual = await vi.importActual<
    typeof import("@/app/_lib/oauth/tokens")
  >("@/app/_lib/oauth/tokens")
  return {
    ...actual,
    issueTokenPair: async () => ({
      accessToken: "access",
      refreshToken: "refresh",
      expiresIn: 3600,
      scopes: ["account"],
    }),
  }
})

function client(overrides: Partial<OAuthClientRecord> = {}): OAuthClientRecord {
  return {
    id: "client-row-1",
    clientId: "the-client-id",
    clientSecretHash: null,
    clientName: "Claude",
    origin: "manual",
    createdByUserId: "owner-1",
    allowLoopbackPorts: false,
    redirectUris: ["https://claude.ai/cb"],
    grantTypes: ["authorization_code", "refresh_token"],
    scopes: ["account"],
    tokenEndpointAuthMethod: "none",
    createdAt: new Date(),
    lastUsedAt: null,
    ...overrides,
  }
}

let confidentialHash: string

function post(
  fields: Record<string, string>,
  options: { ip: string; authorization?: string }
): Request {
  const headers: Record<string, string> = {
    "content-type": "application/x-www-form-urlencoded",
    "x-forwarded-for": options.ip,
  }
  if (options.authorization) headers.authorization = options.authorization
  return new Request("https://app.example.com/api/oauth/token", {
    method: "POST",
    headers,
    body: new URLSearchParams(fields).toString(),
  })
}

beforeEach(async () => {
  confidentialHash ??= await bcrypt.hash(SECRET, 4)
  h.state.client = client()
  h.calls.lookups = []
  h.calls.consumed = 0
  vi.stubEnv("MCP_ENABLED", undefined)
  vi.stubEnv("AUTH_URL", "https://app.example.com")
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("token endpoint — confidential client", () => {
  beforeEach(() => {
    h.state.client = client({
      clientSecretHash: confidentialHash,
      tokenEndpointAuthMethod: "client_secret_post",
    })
  })

  it("accepts client_secret_post", async () => {
    const res = await token(
      post(
        { ...CODE_FORM, client_id: "the-client-id", client_secret: SECRET },
        { ip: "10.1.0.1" }
      )
    )
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toMatchObject({ access_token: "access" })
  })

  it("accepts client_secret_basic", async () => {
    const basic = Buffer.from(`the-client-id:${SECRET}`, "utf8").toString(
      "base64"
    )
    const res = await token(
      post(
        { ...CODE_FORM },
        { ip: "10.1.0.2", authorization: `Basic ${basic}` }
      )
    )
    expect(res.status).toBe(200)
  })

  it("refuses a wrong secret before touching the grant", async () => {
    const res = await token(
      post(
        { ...CODE_FORM, client_id: "the-client-id", client_secret: "nope" },
        { ip: "10.1.0.3" }
      )
    )
    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toMatchObject({ error: "invalid_client" })
    expect(h.calls.consumed).toBe(0)
  })

  it("refuses a missing secret", async () => {
    const res = await token(
      post({ ...CODE_FORM, client_id: "the-client-id" }, { ip: "10.1.0.4" })
    )
    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toMatchObject({ error: "invalid_client" })
    expect(h.calls.consumed).toBe(0)
  })

  it("still requires PKCE — a secret does not substitute for it", async () => {
    const res = await token(
      post(
        {
          ...CODE_FORM,
          code_verifier: "",
          client_id: "the-client-id",
          client_secret: SECRET,
        },
        { ip: "10.1.0.5" }
      )
    )
    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toMatchObject({
      error: "invalid_request",
    })
    expect(h.calls.consumed).toBe(0)
  })
})

describe("token endpoint — public client", () => {
  it("exchanges with PKCE and no secret", async () => {
    const res = await token(
      post({ ...CODE_FORM, client_id: "the-client-id" }, { ip: "10.2.0.1" })
    )
    expect(res.status).toBe(200)
  })

  it("refuses a presented secret rather than ignoring it", async () => {
    const res = await token(
      post(
        { ...CODE_FORM, client_id: "the-client-id", client_secret: SECRET },
        { ip: "10.2.0.2" }
      )
    )
    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toMatchObject({ error: "invalid_client" })
    expect(h.calls.consumed).toBe(0)
  })
})

describe("token endpoint — client identification", () => {
  it("answers an unknown client exactly as it answers a bad secret", async () => {
    h.state.client = null
    const unknown = await token(
      post(
        { ...CODE_FORM, client_id: "nope", client_secret: "whatever" },
        { ip: "10.3.0.1" }
      )
    )
    h.state.client = client({ clientSecretHash: confidentialHash })
    const badSecret = await token(
      post(
        { ...CODE_FORM, client_id: "the-client-id", client_secret: "whatever" },
        { ip: "10.3.0.2" }
      )
    )
    expect(unknown.status).toBe(badSecret.status)
    await expect(unknown.json()).resolves.toEqual(await badSecret.json())
  })

  it("rejects an unsupported grant type before any client lookup", async () => {
    const res = await token(
      post(
        {
          grant_type: "client_credentials",
          client_id: "the-client-id",
          client_secret: SECRET,
        },
        { ip: "10.3.0.3" }
      )
    )
    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toMatchObject({
      error: "unsupported_grant_type",
    })
    expect(h.calls.lookups).toHaveLength(0)
  })

  it("rejects two client authentication methods at once", async () => {
    const basic = Buffer.from(`the-client-id:${SECRET}`, "utf8").toString(
      "base64"
    )
    const res = await token(
      post(
        { ...CODE_FORM, client_id: "the-client-id", client_secret: SECRET },
        { ip: "10.3.0.4", authorization: `Basic ${basic}` }
      )
    )
    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toMatchObject({
      error: "invalid_request",
    })
    expect(h.calls.lookups).toHaveLength(0)
  })
})
