import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { POST as register } from "@/app/api/oauth/register/route"

/**
 * The dynamic-registration gate (`L2-MCP-12`, `L2-MCP-47`, `L2-MCP-49`).
 *
 * Off is the default and must look exactly like a route that does not exist:
 * a `404`, before the body is read and before any rate-limit budget is spent.
 * When an owner does switch registration on, `allowlist` still bounds where an
 * authorization response may land. Both the settings read and the client
 * insert are stubbed — no database.
 */

const h = vi.hoisted(() => ({
  state: {
    enabled: true,
    dcrMode: "off" as "off" | "allowlist" | "open",
    fail: false,
  },
  registered: [] as Array<Record<string, unknown>>,
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
  return {
    ...actual,
    getConnectorSettings: async () => {
      if (h.state.fail) throw new Error("db down")
      return {
        enabled: h.state.enabled,
        dcrMode: h.state.dcrMode,
        redirectHosts: ["claude.ai", "claude.com"],
      }
    },
    // The enabled gate reads through the cache (`L2-MCP-54`).
    getCachedConnectorSettings: async () => ({
      enabled: h.state.enabled,
      dcrMode: h.state.dcrMode,
      redirectHosts: ["claude.ai", "claude.com"],
    }),
  }
})

vi.mock("@/app/_lib/oauth/clients", async () => {
  const actual = await vi.importActual<
    typeof import("@/app/_lib/oauth/clients")
  >("@/app/_lib/oauth/clients")
  return {
    ...actual,
    registerClient: async (input: Record<string, unknown>) => {
      h.registered.push(input)
      return {
        clientId: "generated-client-id",
        clientName: input.clientName,
        redirectUris: input.redirectUris,
        grantTypes: ["authorization_code", "refresh_token"],
        scopes: ["account"],
        tokenEndpointAuthMethod: "none",
        createdAt: new Date(),
      }
    },
  }
})

function post(body: unknown, ip: string): Request {
  return new Request("https://app.example.com/api/oauth/register", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": ip,
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  })
}

const VALID_BODY = {
  client_name: "Claude",
  redirect_uris: ["https://claude.ai/api/mcp/auth_callback"],
}

beforeEach(() => {
  h.state.enabled = true
  h.state.dcrMode = "off"
  h.state.fail = false
  h.registered.length = 0
  vi.stubEnv("MCP_ENABLED", undefined)
  vi.stubEnv("AUTH_URL", "https://app.example.com")
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("dynamic registration gate", () => {
  it("404s while the connector itself is disabled", async () => {
    h.state.enabled = false
    h.state.dcrMode = "open"
    expect((await register(post(VALID_BODY, "10.0.0.1"))).status).toBe(404)
  })

  it("404s while the env override forces the connector off", async () => {
    vi.stubEnv("MCP_ENABLED", "false")
    h.state.dcrMode = "open"
    expect((await register(post(VALID_BODY, "10.0.0.11"))).status).toBe(404)
  })

  it("404s by default, with a valid body", async () => {
    const res = await register(post(VALID_BODY, "10.0.0.2"))
    expect(res.status).toBe(404)
    expect(h.registered).toHaveLength(0)
  })

  it("404s without reading the body at all", async () => {
    // Malformed JSON would be a 400 if the gate ran after parsing — the gate's
    // response must not distinguish this route from a missing one.
    const res = await register(post("{not json", "10.0.0.3"))
    expect(res.status).toBe(404)
  })

  it("fails closed when the settings cannot be read", async () => {
    h.state.fail = true
    h.state.dcrMode = "open"
    expect((await register(post(VALID_BODY, "10.0.0.4"))).status).toBe(404)
  })

  it("spends no rate-limit budget while it is off", async () => {
    // The limiter allows 10/hour per IP; a gate that ran after it would have
    // exhausted the bucket here and answered 429 instead of registering.
    for (let attempt = 0; attempt < 12; attempt++) {
      expect((await register(post(VALID_BODY, "10.0.0.5"))).status).toBe(404)
    }
    h.state.dcrMode = "open"
    expect((await register(post(VALID_BODY, "10.0.0.5"))).status).toBe(201)
  })
})

describe("dynamic registration — allowlist mode", () => {
  beforeEach(() => {
    h.state.dcrMode = "allowlist"
  })

  it("registers a client whose redirect host is listed", async () => {
    const res = await register(post(VALID_BODY, "10.0.1.1"))
    expect(res.status).toBe(201)
    await expect(res.json()).resolves.toMatchObject({
      client_id: "generated-client-id",
      token_endpoint_auth_method: "none",
    })
  })

  it("refuses a host that is not on the allowlist", async () => {
    const res = await register(
      post(
        { client_name: "Phisher", redirect_uris: ["https://evil.example/cb"] },
        "10.0.1.2"
      )
    )
    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toMatchObject({
      error: "invalid_redirect_uri",
    })
    expect(h.registered).toHaveLength(0)
  })

  it("refuses the whole request if any one URI is off-list", async () => {
    const res = await register(
      post(
        {
          client_name: "Mixed",
          redirect_uris: [
            "https://claude.ai/api/mcp/auth_callback",
            "https://evil.example/cb",
          ],
        },
        "10.0.1.3"
      )
    )
    expect(res.status).toBe(400)
    expect(h.registered).toHaveLength(0)
  })

  it("allows loopback without the host being listed", async () => {
    const res = await register(
      post(
        { client_name: "Native", redirect_uris: ["http://127.0.0.1:8080/cb"] },
        "10.0.1.4"
      )
    )
    expect(res.status).toBe(201)
  })
})

describe("dynamic registration — open mode", () => {
  it("accepts any valid redirect host", async () => {
    h.state.dcrMode = "open"
    const res = await register(
      post(
        { client_name: "Anyone", redirect_uris: ["https://other.example/cb"] },
        "10.0.2.1"
      )
    )
    expect(res.status).toBe(201)
    expect(h.registered).toHaveLength(1)
  })
})
