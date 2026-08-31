import { beforeEach, describe, expect, it, vi } from "vitest"

import {
  clearConnectorSettingsCache,
  CONNECTOR_SETTINGS_CACHE_TTL_MS,
  getCachedConnectorSettings,
  getConnectorSettings,
  isDcrMode,
  isHostAllowed,
  isLoopbackHost,
  isValidHostEntry,
  saveConnectorSettings,
} from "./connector-config"

/**
 * The owner-managed connector settings (`L2-MCP-25`, `L2-MCP-47`, `L2-MCP-48`),
 * the host rules the whole redirect-URI defence rests on (`L2-MCP-49`), and the
 * short-TTL read cache the enabled gate depends on (`L2-MCP-54`). The allowlist
 * logic is pure; only the read-or-create round trip touches the (stubbed)
 * Drizzle client, whose reads are counted so the cache can be proven.
 */

const h = vi.hoisted(() => {
  const state = {
    rows: [] as unknown[],
    insertReturning: [] as unknown[],
    inserted: [] as Array<Record<string, unknown>>,
    updated: [] as Array<Record<string, unknown>>,
    reads: 0,
  }

  const db = {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => {
            state.reads += 1
            return state.rows
          },
        }),
      }),
    }),
    insert: () => ({
      values: (values: Record<string, unknown>) => {
        state.inserted.push(values)
        return {
          onConflictDoNothing: () => ({
            returning: async () => state.insertReturning,
          }),
          onConflictDoUpdate: (config: { set: Record<string, unknown> }) => {
            state.updated.push(config.set)
            return Promise.resolve([])
          },
        }
      },
    }),
  }

  return {
    db,
    state,
    reset() {
      state.rows = []
      state.insertReturning = []
      state.inserted = []
      state.updated = []
      state.reads = 0
    },
  }
})

vi.mock("@workspace/db", async () => {
  process.env.DATABASE_URL ??= "postgres://test:test@127.0.0.1:5432/test"
  const actual =
    await vi.importActual<typeof import("@workspace/db")>("@workspace/db")
  return { ...actual, db: h.db }
})

beforeEach(() => {
  h.reset()
  clearConnectorSettingsCache()
})

describe("isHostAllowed", () => {
  const allowlist = ["claude.ai", "claude.com"]

  it("allows a listed host, case-insensitively", () => {
    expect(isHostAllowed("claude.ai", allowlist)).toBe(true)
    expect(isHostAllowed("CLAUDE.AI", allowlist)).toBe(true)
    expect(isHostAllowed("claude.ai", ["Claude.AI"])).toBe(true)
    expect(isHostAllowed("  claude.ai  ", allowlist)).toBe(true)
  })

  it("refuses a host that is not listed", () => {
    expect(isHostAllowed("evil.example", allowlist)).toBe(false)
    expect(isHostAllowed("", allowlist)).toBe(false)
    expect(isHostAllowed("claude.ai", [])).toBe(false)
  })

  it("never matches on a substring or a suffix", () => {
    // The whole point of an exact match: neither of these is claude.ai.
    expect(isHostAllowed("notclaude.ai", allowlist)).toBe(false)
    expect(isHostAllowed("claude.ai.evil.example", allowlist)).toBe(false)
    expect(isHostAllowed("evil-claude.ai", allowlist)).toBe(false)
    expect(isHostAllowed("ai", allowlist)).toBe(false)
    // A subdomain must be listed in its own right.
    expect(isHostAllowed("console.claude.ai", allowlist)).toBe(false)
    // A trailing root dot is a different string, and stays refused.
    expect(isHostAllowed("claude.ai.", allowlist)).toBe(false)
  })

  it("always allows loopback, listed or not", () => {
    expect(isHostAllowed("localhost", [])).toBe(true)
    expect(isHostAllowed("127.0.0.1", [])).toBe(true)
    expect(isHostAllowed("LOCALHOST", [])).toBe(true)
  })

  it("does not treat near-loopback hosts as loopback", () => {
    for (const host of [
      "localhost.evil.example",
      "notlocalhost",
      "127.0.0.2",
      "[::1]",
      "0.0.0.0",
    ]) {
      expect(isHostAllowed(host, [])).toBe(false)
    }
  })
})

describe("isLoopbackHost", () => {
  it("matches exactly the two loopback names", () => {
    expect(isLoopbackHost("localhost")).toBe(true)
    expect(isLoopbackHost("127.0.0.1")).toBe(true)
    expect(isLoopbackHost("[::1]")).toBe(false)
    expect(isLoopbackHost("127.0.0.2")).toBe(false)
    expect(isLoopbackHost("localhost.evil.example")).toBe(false)
  })
})

describe("isValidHostEntry", () => {
  it("accepts a bare hostname", () => {
    expect(isValidHostEntry("claude.ai")).toBe(true)
    expect(isValidHostEntry("Claude.AI")).toBe(true)
    expect(isValidHostEntry(" claude.com ")).toBe(true)
    expect(isValidHostEntry("my-app.internal.example")).toBe(true)
    expect(isValidHostEntry("localhost")).toBe(true)
  })

  it("rejects anything that is not a bare hostname", () => {
    for (const value of [
      "",
      "   ",
      "https://claude.ai",
      "claude.ai:443",
      "claude.ai/callback",
      "claude.ai?x=1",
      "claude.ai#frag",
      "*.claude.ai",
      "user@claude.ai",
      "claude ai",
      "claude.ai.",
      ".claude.ai",
      "claude..ai",
      "-claude.ai",
      "claude.ai-",
      "claude_ai",
      `${"a".repeat(300)}.example`,
    ]) {
      expect(isValidHostEntry(value)).toBe(false)
    }
  })
})

describe("isDcrMode", () => {
  it("accepts the three modes and nothing else", () => {
    expect(isDcrMode("off")).toBe(true)
    expect(isDcrMode("allowlist")).toBe(true)
    expect(isDcrMode("open")).toBe(true)
    expect(isDcrMode("ON")).toBe(false)
    expect(isDcrMode(undefined)).toBe(false)
  })
})

describe("getConnectorSettings", () => {
  it("returns the stored row", async () => {
    h.state.rows = [
      { enabled: true, dcrMode: "open", redirectHosts: ["example.test"] },
    ]
    await expect(getConnectorSettings()).resolves.toEqual({
      enabled: true,
      dcrMode: "open",
      redirectHosts: ["example.test"],
    })
  })

  it("creates the row with safe defaults on first read", async () => {
    h.state.insertReturning = [
      {
        enabled: false,
        dcrMode: "off",
        redirectHosts: ["claude.ai", "claude.com"],
      },
    ]
    await expect(getConnectorSettings()).resolves.toEqual({
      enabled: false,
      dcrMode: "off",
      redirectHosts: ["claude.ai", "claude.com"],
    })
    expect(h.state.inserted[0]).toEqual({ kind: "mcp" })
  })

  it("falls back to disabled, registration-off defaults when nothing can be read", async () => {
    // Lost the insert race and the re-read still came back empty.
    await expect(getConnectorSettings()).resolves.toEqual({
      enabled: false,
      dcrMode: "off",
      redirectHosts: ["claude.ai", "claude.com"],
    })
  })

  it("reads anything but an explicit true as off", async () => {
    h.state.rows = [{ dcrMode: "off", redirectHosts: [] }]
    await expect(getConnectorSettings()).resolves.toMatchObject({
      enabled: false,
    })
  })
})

describe("getCachedConnectorSettings", () => {
  beforeEach(() => {
    h.state.rows = [{ enabled: true, dcrMode: "off", redirectHosts: [] }]
  })

  it("serves a second read from the cache, without touching the database", async () => {
    await expect(getCachedConnectorSettings(0)).resolves.toMatchObject({
      enabled: true,
    })
    expect(h.state.reads).toBe(1)

    // The row changed underneath us — the cache must not notice yet.
    h.state.rows = [{ enabled: false, dcrMode: "off", redirectHosts: [] }]
    await expect(
      getCachedConnectorSettings(CONNECTOR_SETTINGS_CACHE_TTL_MS - 1)
    ).resolves.toMatchObject({ enabled: true })
    expect(h.state.reads).toBe(1)
  })

  it("re-reads once the TTL has passed", async () => {
    await getCachedConnectorSettings(0)
    h.state.rows = [{ enabled: false, dcrMode: "off", redirectHosts: [] }]

    await expect(
      getCachedConnectorSettings(CONNECTOR_SETTINGS_CACHE_TTL_MS)
    ).resolves.toMatchObject({ enabled: false })
    expect(h.state.reads).toBe(2)
  })

  it("collapses concurrent cold reads into one database round trip", async () => {
    const [a, b, c] = await Promise.all([
      getCachedConnectorSettings(0),
      getCachedConnectorSettings(0),
      getCachedConnectorSettings(0),
    ])
    expect([a, b, c].every((s) => s.enabled)).toBe(true)
    expect(h.state.reads).toBe(1)
  })

  it("does not cache a failed read", async () => {
    const failing = new Error("database unreachable")
    const original = h.db.select
    h.db.select = () => {
      throw failing
    }
    await expect(getCachedConnectorSettings(0)).rejects.toThrow(failing)

    h.db.select = original
    await expect(getCachedConnectorSettings(0)).resolves.toMatchObject({
      enabled: true,
    })
  })

  it("is cleared explicitly", async () => {
    await getCachedConnectorSettings(0)
    clearConnectorSettingsCache()
    await getCachedConnectorSettings(0)
    expect(h.state.reads).toBe(2)
  })
})

describe("saveConnectorSettings", () => {
  beforeEach(() => {
    h.state.rows = [
      { enabled: false, dcrMode: "off", redirectHosts: ["claude.ai"] },
    ]
  })

  it("normalizes and dedupes the host list", async () => {
    const saved = await saveConnectorSettings({
      redirectHosts: ["Claude.AI", " claude.ai ", "claude.com", ""],
    })
    expect(saved.redirectHosts).toEqual(["claude.ai", "claude.com"])
    expect(h.state.updated[0]).toMatchObject({
      redirectHosts: ["claude.ai", "claude.com"],
    })
  })

  it("keeps the fields the caller did not send", async () => {
    const saved = await saveConnectorSettings({ dcrMode: "allowlist" })
    expect(saved).toEqual({
      enabled: false,
      dcrMode: "allowlist",
      redirectHosts: ["claude.ai"],
    })
  })

  it("persists the master switch", async () => {
    const saved = await saveConnectorSettings({ enabled: true })
    expect(saved.enabled).toBe(true)
    expect(h.state.updated[0]).toMatchObject({ enabled: true })
  })

  it("refuses an unknown mode and a malformed host", async () => {
    await expect(
      saveConnectorSettings({ dcrMode: "everyone" as never })
    ).rejects.toThrow()
    await expect(
      saveConnectorSettings({ redirectHosts: ["https://claude.ai"] })
    ).rejects.toThrow()
    expect(h.state.updated).toHaveLength(0)
  })

  it("clears the cache, so the owner's toggle takes effect immediately", async () => {
    await getCachedConnectorSettings(0)
    expect(h.state.reads).toBe(1)

    h.state.rows = [
      { enabled: true, dcrMode: "off", redirectHosts: ["claude.ai"] },
    ]
    await saveConnectorSettings({ enabled: true })

    // Well inside the TTL, yet the next read sees the new state.
    await expect(getCachedConnectorSettings(1)).resolves.toMatchObject({
      enabled: true,
    })
  })
})
