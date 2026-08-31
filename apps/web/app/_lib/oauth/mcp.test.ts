import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { POST as mcp } from "@/app/api/mcp/route"

/**
 * The unauthenticated edge of `/api/mcp` (`L2-MCP-54`, `L2-MCP-37`).
 *
 * Three properties, in the order the route enforces them: a disabled connector
 * is a `404` and never a `401`; a bearer-less request gets the discovery
 * challenge for free; and that free path is capped per IP so it cannot be
 * sprayed. The challenge must be indistinguishable from the one an invalid
 * token gets — otherwise the cheap path becomes an oracle for "nothing was
 * looked up here".
 */

const ORIGIN = "https://app.example.com"

const h = vi.hoisted(() => ({
  state: { enabled: true },
  db: {
    // Shape `verifyAccessToken` walks: no row ⇒ an unknown token.
    select: () => ({
      from: () => ({
        innerJoin: () => ({ where: async () => [] }),
      }),
    }),
  },
}))

vi.mock("@workspace/db", async () => {
  process.env.DATABASE_URL ??= "postgres://test:test@127.0.0.1:5432/test"
  const actual =
    await vi.importActual<typeof import("@workspace/db")>("@workspace/db")
  return { ...actual, db: h.db }
})

vi.mock("@/app/_lib/oauth/connector-config", () => ({
  getCachedConnectorSettings: async () => ({
    enabled: h.state.enabled,
    dcrMode: "off" as const,
    redirectHosts: [],
  }),
}))

vi.mock("@/app/_lib/mcp/server", () => ({
  buildMcpServer: () => {
    throw new Error("no tool server should be built on an unauthenticated path")
  },
}))

/** One request from `ip`, with whatever `Authorization` header (if any). */
function call(ip: string, authorization?: string): Promise<Response> {
  const headers: Record<string, string> = { "x-forwarded-for": ip }
  if (authorization) headers.authorization = authorization
  return mcp(
    new Request(`${ORIGIN}/api/mcp`, {
      method: "POST",
      headers,
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
    })
  )
}

/** Everything a caller can observe, for byte-for-byte comparison. */
async function fingerprint(response: Response) {
  return {
    status: response.status,
    headers: [...response.headers.entries()].sort(),
    body: await response.text(),
  }
}

beforeEach(() => {
  h.state.enabled = true
  vi.stubEnv("AUTH_URL", `${ORIGIN}/`)
  vi.stubEnv("MCP_ENABLED", undefined)
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("the enabled gate runs first", () => {
  it("404s a bearer-less request rather than challenging it", async () => {
    h.state.enabled = false
    const response = await call("203.0.113.1")

    expect(response.status).toBe(404)
    // A 401 here would confirm the route exists on a deployment that never
    // switched the connector on (`L2-MCP-37`).
    expect(response.headers.get("www-authenticate")).toBeNull()
  })

  it("404s a request that carries a token, too", async () => {
    h.state.enabled = false
    const response = await call("203.0.113.2", "Bearer whatever")

    expect(response.status).toBe(404)
    expect(response.headers.get("www-authenticate")).toBeNull()
  })

  it("stays off when the environment forces it off, whatever the toggle says", async () => {
    vi.stubEnv("MCP_ENABLED", "false")
    expect((await call("203.0.113.3")).status).toBe(404)
  })
})

describe("the anonymous challenge", () => {
  it("points a client at the protected-resource metadata", async () => {
    const response = await call("203.0.113.10")

    expect(response.status).toBe(401)
    expect(response.headers.get("www-authenticate")).toBe(
      `Bearer resource_metadata="${ORIGIN}/.well-known/oauth-protected-resource", error="invalid_token"`
    )
    expect(response.headers.get("cache-control")).toBe("no-store")
    await expect(response.json()).resolves.toEqual({ error: "invalid_token" })
  })

  it("is indistinguishable from the answer to an invalid token", async () => {
    // Otherwise the free short-circuit tells a prober that no token lookup
    // happened — i.e. something about which tokens this server holds.
    const anonymous = await fingerprint(await call("203.0.113.11"))
    const invalidToken = await fingerprint(
      await call("203.0.113.12", "Bearer not-a-real-token")
    )

    expect(anonymous).toEqual(invalidToken)
  })

  it("treats an Authorization header with no bearer credential as anonymous", async () => {
    const anonymous = await fingerprint(await call("203.0.113.13"))
    for (const header of ["Basic dXNlcjpwYXNz", "Bearer", "Bearer   "]) {
      expect(await fingerprint(await call("203.0.113.14", header))).toEqual(
        anonymous
      )
    }
  })
})

describe("the bearer-less cap", () => {
  it("answers 429 with Retry-After once the IP is over the cap, not 401", async () => {
    const ip = "203.0.113.20"
    for (let i = 0; i < 60; i += 1) {
      expect((await call(ip)).status).toBe(401)
    }

    const response = await call(ip)
    expect(response.status).toBe(429)
    expect(Number(response.headers.get("retry-after"))).toBeGreaterThan(0)
    // Being throttled is not an invitation to restart the OAuth flow.
    expect(response.headers.get("www-authenticate")).toBeNull()
  })

  it("caps per IP, using the hop the proxy appended", async () => {
    const ip = "203.0.113.21"
    for (let i = 0; i < 61; i += 1) await call(`1.2.3.4, ${ip}`)
    expect((await call(`5.6.7.8, ${ip}`)).status).toBe(429)

    // A forged prefix cannot mint a fresh bucket, but a real peer is untouched.
    expect((await call("203.0.113.22")).status).toBe(401)
  })

  it("is not consumed by requests that do carry a token", async () => {
    const ip = "203.0.113.23"
    for (let i = 0; i < 100; i += 1) {
      expect((await call(ip, `Bearer token-${i}`)).status).toBe(401)
    }
    expect((await call(ip)).status).toBe(401)
  })
})
