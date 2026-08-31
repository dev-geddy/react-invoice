import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  ACCESS_TOKEN_TTL_SEC,
  AUTH_CODE_TTL_SEC,
  isMcpEnabled,
  isMcpForcedOff,
  issuerOrigin,
  mcpResourceUrl,
  protectedResourceMetadataUrl,
  REFRESH_TOKEN_TTL_SEC,
} from "./config"

/**
 * The master switch and the single origin every OAuth document is derived from.
 * Locks `L2-MCP-24` (lifetimes), `L2-MCP-25` (the owner's toggle plus the
 * forced-off env override) and `L2-MCP-37` (default off).
 *
 * The settings reader is stubbed: this file is about how the two inputs
 * combine, not about how the row is fetched (that is `connector-config.test.ts`).
 */

const h = vi.hoisted(() => ({
  state: { enabled: false, reads: 0, failing: false },
}))

vi.mock("./connector-config", () => ({
  getCachedConnectorSettings: async () => {
    h.state.reads += 1
    if (h.state.failing) throw new Error("database unreachable")
    return {
      enabled: h.state.enabled,
      dcrMode: "off" as const,
      redirectHosts: [],
    }
  },
}))

beforeEach(() => {
  h.state.enabled = false
  h.state.reads = 0
  h.state.failing = false
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("isMcpForcedOff", () => {
  it('is true for exactly "false" and nothing else', () => {
    vi.stubEnv("MCP_ENABLED", "false")
    expect(isMcpForcedOff()).toBe(true)
    for (const value of [undefined, "", "true", "FALSE", "0", "no"]) {
      vi.stubEnv("MCP_ENABLED", value)
      expect(isMcpForcedOff()).toBe(false)
    }
  })
})

describe("isMcpEnabled", () => {
  it("follows the database when the env override is unset", async () => {
    vi.stubEnv("MCP_ENABLED", undefined)

    h.state.enabled = true
    await expect(isMcpEnabled()).resolves.toBe(true)

    h.state.enabled = false
    await expect(isMcpEnabled()).resolves.toBe(false)
  })

  it("is off by default — no row, no connector", async () => {
    vi.stubEnv("MCP_ENABLED", undefined)
    await expect(isMcpEnabled()).resolves.toBe(false)
  })

  it("stays off when the env forces it off, whatever the database says", async () => {
    h.state.enabled = true
    vi.stubEnv("MCP_ENABLED", "false")
    await expect(isMcpEnabled()).resolves.toBe(false)
    // Forced off costs nothing: the switch is never even read.
    expect(h.state.reads).toBe(0)
  })

  it('does not treat MCP_ENABLED="true" as a way to force it on', async () => {
    // The env survives only as an override *off* (`L2-MCP-25`); an owner who
    // has not toggled the connector on must not get one from a stale deploy var.
    h.state.enabled = false
    vi.stubEnv("MCP_ENABLED", "true")
    await expect(isMcpEnabled()).resolves.toBe(false)
  })

  it("fails closed when the settings cannot be read", async () => {
    vi.stubEnv("MCP_ENABLED", undefined)
    h.state.failing = true
    await expect(isMcpEnabled()).resolves.toBe(false)
  })
})

describe("issuerOrigin", () => {
  it("reduces AUTH_URL to a bare origin", () => {
    vi.stubEnv("AUTH_URL", "https://app.example.com/")
    expect(issuerOrigin()).toBe("https://app.example.com")

    vi.stubEnv("AUTH_URL", "https://app.example.com/some/path?x=1")
    expect(issuerOrigin()).toBe("https://app.example.com")

    vi.stubEnv("AUTH_URL", "http://localhost:3070")
    expect(issuerOrigin()).toBe("http://localhost:3070")
  })

  it("falls back to the dev origin when AUTH_URL is unset outside production", () => {
    vi.stubEnv("AUTH_URL", undefined)
    vi.stubEnv("NODE_ENV", "development")
    expect(issuerOrigin()).toBe("http://localhost:3070")
  })

  it("throws in production rather than issuing against a guessed origin", () => {
    vi.stubEnv("AUTH_URL", undefined)
    vi.stubEnv("NODE_ENV", "production")
    expect(() => issuerOrigin()).toThrow()
  })
})

describe("derived URLs", () => {
  it("all hang off the same issuer origin", () => {
    vi.stubEnv("AUTH_URL", "https://app.example.com/")
    expect(mcpResourceUrl()).toBe("https://app.example.com/api/mcp")
    expect(protectedResourceMetadataUrl()).toBe(
      "https://app.example.com/.well-known/oauth-protected-resource"
    )
  })
})

describe("lifetimes", () => {
  it("match the contract (60s code, 60min access, 30d refresh)", () => {
    expect(AUTH_CODE_TTL_SEC).toBe(60)
    expect(ACCESS_TOKEN_TTL_SEC).toBe(60 * 60)
    expect(REFRESH_TOKEN_TTL_SEC).toBe(30 * 24 * 60 * 60)
  })
})
