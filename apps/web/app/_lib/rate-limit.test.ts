import { describe, expect, it } from "vitest"

import { createRateLimiter } from "./rate-limit"

/**
 * Locks the fixed-window limiter used by the login throttle (`L2-AUTH-40`) and
 * the AI test endpoint (`L2-AI-22`). A controllable clock keeps it deterministic.
 */
function clock(start = 0) {
  let t = start
  return { now: () => t, advance: (ms: number) => (t += ms) }
}

describe("createRateLimiter", () => {
  it("blocks only once the cap is reached within the window", () => {
    const c = clock()
    const rl = createRateLimiter({ max: 3, windowMs: 1000, now: c.now })

    expect(rl.blocked("k")).toBe(false)
    rl.hit("k")
    rl.hit("k")
    expect(rl.blocked("k")).toBe(false) // 2 < 3
    rl.hit("k")
    expect(rl.blocked("k")).toBe(true) // 3 >= 3
  })

  it("resets after the window elapses", () => {
    const c = clock()
    const rl = createRateLimiter({ max: 1, windowMs: 1000, now: c.now })

    rl.hit("k")
    expect(rl.blocked("k")).toBe(true)
    c.advance(1000)
    expect(rl.blocked("k")).toBe(false)
  })

  it("reset() clears a key immediately (success path)", () => {
    const c = clock()
    const rl = createRateLimiter({ max: 1, windowMs: 1000, now: c.now })

    rl.hit("k")
    expect(rl.blocked("k")).toBe(true)
    rl.reset("k")
    expect(rl.blocked("k")).toBe(false)
  })

  it("tracks keys independently", () => {
    const c = clock()
    const rl = createRateLimiter({ max: 1, windowMs: 1000, now: c.now })

    rl.hit("a")
    expect(rl.blocked("a")).toBe(true)
    expect(rl.blocked("b")).toBe(false)
  })

  it("reports time remaining until the window resets", () => {
    const c = clock()
    const rl = createRateLimiter({ max: 1, windowMs: 1000, now: c.now })

    rl.hit("k")
    c.advance(400)
    expect(rl.retryAfterMs("k")).toBe(600)
    expect(rl.retryAfterMs("absent")).toBe(0)
  })
})
