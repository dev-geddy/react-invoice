import { describe, expect, it } from "vitest"

import { clientIp, mcpChallengeLimiter } from "./limits"

/**
 * Limiter keying (`L2-MCP-30`) and the bearer-less cap on `/api/mcp`
 * (`L2-MCP-54`). The whole point of the caps on DCR, the token endpoint and the
 * anonymous challenge is that one caller cannot mint unlimited buckets, so the
 * key must come from a hop our own proxy wrote — never from one the caller
 * supplied. Header parsing is pure; the challenge cap uses real counters.
 */

const req = (headers: Record<string, string>) =>
  new Request("https://x/", { headers })

describe("clientIp", () => {
  it("ignores a forged leading hop and uses the one the proxy appended", () => {
    // nginx `$proxy_add_x_forwarded_for` / Caddy both append the peer they saw:
    // "<whatever the client sent>, <real peer>".
    expect(clientIp(req({ "x-forwarded-for": "1.2.3.4, 203.0.113.9" }))).toBe(
      "203.0.113.9"
    )
  })

  it("cannot be rotated by varying the forged prefix", () => {
    const keys = new Set(
      ["9.9.9.1", "9.9.9.2", "9.9.9.3"].map((forged) =>
        clientIp(req({ "x-forwarded-for": `${forged}, 203.0.113.9` }))
      )
    )
    expect([...keys]).toEqual(["203.0.113.9"])
  })

  it("survives a forged header that itself contains commas", () => {
    expect(
      clientIp(req({ "x-forwarded-for": "a, b, c, d, 203.0.113.9" }))
    ).toBe("203.0.113.9")
  })

  it("uses the only hop when the proxy is the first writer", () => {
    expect(clientIp(req({ "x-forwarded-for": "203.0.113.9" }))).toBe(
      "203.0.113.9"
    )
  })

  it("falls back to x-real-ip when x-forwarded-for is absent or blank", () => {
    expect(clientIp(req({ "x-real-ip": "203.0.113.9" }))).toBe("203.0.113.9")
    expect(
      clientIp(req({ "x-forwarded-for": " ", "x-real-ip": "203.0.113.9" }))
    ).toBe("203.0.113.9")
  })

  it("buckets header-less callers together rather than failing open", () => {
    expect(clientIp(req({}))).toBe("unknown")
  })
})

describe("mcpChallengeLimiter", () => {
  it("lets 60 bearer-less requests through per key, then blocks", () => {
    const key = "198.51.100.7"
    for (let i = 0; i < 60; i += 1) {
      expect(mcpChallengeLimiter.blocked(key)).toBe(false)
      mcpChallengeLimiter.hit(key)
    }
    expect(mcpChallengeLimiter.blocked(key)).toBe(true)
    // A blocked caller is told when to come back (`L2-MCP-30`).
    expect(mcpChallengeLimiter.retryAfterMs(key)).toBeGreaterThan(0)
    expect(mcpChallengeLimiter.retryAfterMs(key)).toBeLessThanOrEqual(
      5 * 60_000
    )
  })

  it("counts per key, so one prober cannot lock out other callers", () => {
    const noisy = "198.51.100.8"
    for (let i = 0; i < 60; i += 1) mcpChallengeLimiter.hit(noisy)
    expect(mcpChallengeLimiter.blocked(noisy)).toBe(true)
    expect(mcpChallengeLimiter.blocked("198.51.100.9")).toBe(false)
  })
})
