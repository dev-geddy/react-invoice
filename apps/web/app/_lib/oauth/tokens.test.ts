import { describe, expect, it, vi } from "vitest"

import { familyRevokedConcurrently, type FamilyTokenRow } from "./tokens"

/**
 * Rotation resurrection-race re-check (`L2-MCP-27`): a `revokeGrant`/
 * `revokeTokenFamily` landing between the refresh CAS and `issueTokenPair`
 * only revokes rows that existed at that instant, so the freshly-minted pair
 * would otherwise be born un-revoked. `familyRevokedConcurrently` is the pure
 * decision — no database.
 */

vi.mock("@workspace/db", async () => {
  process.env.DATABASE_URL ??= "postgres://test:test@127.0.0.1:5432/test"
  const actual =
    await vi.importActual<typeof import("@workspace/db")>("@workspace/db")
  return { ...actual, db: {} }
})

const since = new Date("2026-01-01T00:00:00.000Z")
const before = new Date(since.getTime() - 1000)
const after = new Date(since.getTime() + 1000)

describe("familyRevokedConcurrently", () => {
  it("is false when no other row is revoked", () => {
    const rows: FamilyTokenRow[] = [
      { id: "access-1", revokedAt: null },
      { id: "refresh-2", revokedAt: null },
    ]
    expect(familyRevokedConcurrently(rows, since)).toBe(false)
  })

  it("is false for ordinary rotation history revoked strictly before `since`", () => {
    const rows: FamilyTokenRow[] = [
      { id: "refresh-0", revokedAt: before },
      { id: "access-1", revokedAt: null },
    ]
    expect(familyRevokedConcurrently(rows, since)).toBe(false)
  })

  it("is true when another row was revoked exactly at `since`", () => {
    const rows: FamilyTokenRow[] = [{ id: "access-1", revokedAt: since }]
    expect(familyRevokedConcurrently(rows, since)).toBe(true)
  })

  it("is true when another row was revoked after `since` — the resurrection race", () => {
    // Simulates: Disconnect (revokeGrant) lands between our CAS and our
    // issueTokenPair, revoking whatever else was live in the family at that
    // moment — the exact scenario this re-check exists to catch.
    const rows: FamilyTokenRow[] = [
      { id: "access-1", revokedAt: after },
      { id: "refresh-2", revokedAt: null },
    ]
    expect(familyRevokedConcurrently(rows, since)).toBe(true)
  })

  it("ignores an empty set of other rows", () => {
    expect(familyRevokedConcurrently([], since)).toBe(false)
  })
})
