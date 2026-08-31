import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  consumeUserToken,
  countRecentTokens,
  createUserToken,
  RATE_LIMIT,
  type UserTokenType,
} from "@/app/_lib/auth/tokens"

/**
 * Recovery-token invariants. Locks L2-AUTH-29 (one live token per purpose,
 * 60-min TTL, hash-only storage, single use), L2-AUTH-31 and L2-AUTH-37
 * (per-account rate-limit shape). The Drizzle client is replaced by a
 * recording stub; the hashing and token generation are the real ones.
 */

const h = vi.hoisted(() => {
  const inserts: Array<Record<string, unknown>> = []
  const updates: Array<{ set: Record<string, unknown>; where: unknown }> = []
  const selects: Array<{ projection: unknown; where: unknown }> = []
  const ops: string[] = []
  const state = { rows: [] as unknown[] }

  const db = {
    insert: () => ({
      values: async (values: Record<string, unknown>) => {
        ops.push("insert")
        inserts.push(values)
      },
    }),
    update: () => ({
      set: (set: Record<string, unknown>) => ({
        where: async (where: unknown) => {
          ops.push("update")
          updates.push({ set, where })
        },
      }),
    }),
    select: (projection?: unknown) => ({
      from: () => ({
        where: async (where: unknown) => {
          ops.push("select")
          selects.push({ projection, where })
          return state.rows
        },
      }),
    }),
  }

  return {
    db,
    inserts,
    updates,
    selects,
    ops,
    state,
    reset() {
      inserts.length = 0
      updates.length = 0
      selects.length = 0
      ops.length = 0
      state.rows = []
    },
  }
})

vi.mock("@workspace/db", async () => {
  process.env.DATABASE_URL ??= "postgres://test:test@127.0.0.1:5432/test"
  const actual =
    await vi.importActual<typeof import("@workspace/db")>("@workspace/db")
  return { ...actual, db: h.db }
})

/** Every primitive reachable from a Drizzle condition, for asserting on SQL params. */
function reachable(
  input: unknown,
  depth = 0,
  seen = new Set<object>()
): unknown[] {
  if (depth > 8) return []
  if (input === null || typeof input !== "object") return [input]
  if (input instanceof Date) return [input]
  if (seen.has(input)) return []
  seen.add(input)
  return Object.values(input as Record<string, unknown>).flatMap((v) =>
    reachable(v, depth + 1, seen)
  )
}

const stringsIn = (where: unknown) =>
  reachable(where).filter((v): v is string => typeof v === "string")

const datesIn = (where: unknown) =>
  reachable(where).filter((v): v is Date => v instanceof Date)

const HEX_64 = /^[0-9a-f]{64}$/

function row(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "token-1",
    userId: "user-1",
    type: "password_reset" as UserTokenType,
    tokenHash: "hash",
    newEmail: null,
    expiresAt: new Date(Date.now() + 60_000),
    consumedAt: null,
    createdAt: new Date(),
    ...overrides,
  }
}

beforeEach(() => {
  h.reset()
})

afterEach(() => {
  vi.useRealTimers()
})

describe("createUserToken (L2-AUTH-29)", () => {
  it("invalidates outstanding tokens of the same type before minting", async () => {
    await createUserToken({ userId: "user-1", type: "password_reset" })

    expect(h.ops).toEqual(["update", "insert"])
    const [invalidation] = h.updates
    expect(invalidation!.set.consumedAt).toBeInstanceOf(Date)
    expect(stringsIn(invalidation!.where)).toEqual(
      expect.arrayContaining(["user-1", "password_reset"])
    )
  })

  it("stores only the hash — the raw token never reaches the database", async () => {
    const raw = await createUserToken({
      userId: "user-1",
      type: "password_reset",
    })

    const values = h.inserts[0]!
    expect(raw.length).toBeGreaterThan(20)
    expect(values.tokenHash).not.toBe(raw)
    expect(values.tokenHash).toMatch(HEX_64)
    expect(Object.values(values)).not.toContain(raw)
  })

  it("mints a distinct token each time", async () => {
    const first = await createUserToken({
      userId: "user-1",
      type: "password_reset",
    })
    const second = await createUserToken({
      userId: "user-1",
      type: "password_reset",
    })

    expect(first).not.toBe(second)
    expect(h.inserts[0]!.tokenHash).not.toBe(h.inserts[1]!.tokenHash)
  })

  it("expires 60 minutes out for both token types", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"))

    for (const type of ["password_reset", "email_change"] as UserTokenType[]) {
      await createUserToken({ userId: "user-1", type })
    }

    for (const values of h.inserts) {
      expect((values.expiresAt as Date).toISOString()).toBe(
        "2026-01-01T01:00:00.000Z"
      )
    }
  })

  it("records the pending address for email_change only", async () => {
    await createUserToken({
      userId: "user-1",
      type: "email_change",
      newEmail: "new@example.com",
    })
    await createUserToken({ userId: "user-1", type: "password_reset" })

    expect(h.inserts[0]).toMatchObject({
      type: "email_change",
      newEmail: "new@example.com",
    })
    expect(h.inserts[1]).toMatchObject({
      type: "password_reset",
      newEmail: null,
    })
  })
})

describe("consumeUserToken (L2-AUTH-29, L2-AUTH-31)", () => {
  it("looks the token up by hash, never by the raw value", async () => {
    const raw = await createUserToken({
      userId: "user-1",
      type: "password_reset",
    })
    const storedHash = h.inserts[0]!.tokenHash as string
    h.state.rows = []

    await consumeUserToken({ rawToken: raw, type: "password_reset" })

    const lookup = stringsIn(h.selects[0]!.where)
    expect(lookup).toContain(storedHash)
    expect(lookup).not.toContain(raw)
  })

  it("consumes a valid token once and marks it consumed", async () => {
    h.state.rows = [row({ userId: "user-9", newEmail: "new@example.com" })]

    const result = await consumeUserToken({
      rawToken: "raw",
      type: "password_reset",
    })

    expect(result).toEqual({ userId: "user-9", newEmail: "new@example.com" })
    expect(h.updates).toHaveLength(1)
    expect(h.updates[0]!.set.consumedAt).toBeInstanceOf(Date)
    expect(stringsIn(h.updates[0]!.where)).toContain("token-1")
  })

  const rejected: Array<[string, ReturnType<typeof row> | null]> = [
    ["no matching row", null],
    ["a different token type", row({ type: "email_change" })],
    ["an already-consumed token", row({ consumedAt: new Date() })],
    ["an expired token", row({ expiresAt: new Date(Date.now() - 1) })],
  ]

  for (const [name, stored] of rejected) {
    it(`rejects ${name} without consuming anything`, async () => {
      h.state.rows = stored ? [stored] : []

      await expect(
        consumeUserToken({ rawToken: "raw", type: "password_reset" })
      ).resolves.toBeNull()
      expect(h.updates).toHaveLength(0)
    })
  }

  it("rejects an empty token without querying", async () => {
    await expect(
      consumeUserToken({ rawToken: "", type: "password_reset" })
    ).resolves.toBeNull()
    expect(h.ops).toEqual([])
  })

  it("does not consume a token belonging to another user", async () => {
    h.state.rows = [row({ userId: "owner-of-token", type: "email_change" })]

    await expect(
      consumeUserToken({
        rawToken: "raw",
        type: "email_change",
        userId: "someone-else",
      })
    ).resolves.toBeNull()
    expect(h.updates).toHaveLength(0) // token left valid for its real owner
  })

  it("consumes when the userId matches the token owner", async () => {
    h.state.rows = [
      row({
        userId: "user-9",
        type: "email_change",
        newEmail: "new@example.com",
      }),
    ]

    await expect(
      consumeUserToken({
        rawToken: "raw",
        type: "email_change",
        userId: "user-9",
      })
    ).resolves.toEqual({ userId: "user-9", newEmail: "new@example.com" })
    expect(h.updates).toHaveLength(1)
  })
})

describe("rate limit (L2-AUTH-37)", () => {
  it("caps recovery requests at 3 per 15 minutes", () => {
    expect(RATE_LIMIT).toEqual({ max: 3, windowMinutes: 15 })
  })

  it("counts tokens minted inside the window, scoped to user + type", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-01-01T12:00:00.000Z"))
    h.state.rows = [{ id: "a" }, { id: "b" }]

    const count = await countRecentTokens({
      userId: "user-1",
      type: "password_reset",
      withinMinutes: RATE_LIMIT.windowMinutes,
    })

    expect(count).toBe(2)
    const { where } = h.selects[0]!
    expect(stringsIn(where)).toEqual(
      expect.arrayContaining(["user-1", "password_reset"])
    )
    expect(datesIn(where).map((d) => d.toISOString())).toContain(
      "2026-01-01T11:45:00.000Z"
    )
  })
})
