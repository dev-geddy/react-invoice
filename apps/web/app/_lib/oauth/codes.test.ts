import { createHash, randomBytes } from "node:crypto"

import { describe, expect, it, vi } from "vitest"

import { isValidCodeChallenge, verifyPkceS256 } from "./codes"

/**
 * PKCE S256 verification (`L2-MCP-26`) — the only proof of possession a public
 * client has. Pure crypto; the Drizzle client is stubbed away so this needs no
 * database.
 */

vi.mock("@workspace/db", async () => {
  process.env.DATABASE_URL ??= "postgres://test:test@127.0.0.1:5432/test"
  const actual =
    await vi.importActual<typeof import("@workspace/db")>("@workspace/db")
  return { ...actual, db: {} }
})

/** RFC 7636 Appendix B reference pair. */
const RFC_VERIFIER = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"
const RFC_CHALLENGE = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"

const challengeFor = (verifier: string) =>
  createHash("sha256").update(verifier).digest("base64url")

describe("verifyPkceS256", () => {
  it("matches the RFC 7636 reference vector", () => {
    expect(verifyPkceS256(RFC_VERIFIER, RFC_CHALLENGE)).toBe(true)
  })

  it("accepts freshly generated verifier/challenge pairs", () => {
    for (let i = 0; i < 20; i++) {
      const verifier = randomBytes(32).toString("base64url")
      expect(verifyPkceS256(verifier, challengeFor(verifier))).toBe(true)
    }
  })

  it("rejects a mismatching verifier", () => {
    const other = randomBytes(32).toString("base64url")
    expect(verifyPkceS256(other, RFC_CHALLENGE)).toBe(false)
    expect(verifyPkceS256(RFC_VERIFIER, challengeFor(other))).toBe(false)
  })

  it("rejects the plain method — the verifier is never the challenge", () => {
    expect(verifyPkceS256(RFC_VERIFIER, RFC_VERIFIER)).toBe(false)
  })

  it("rejects verifiers outside the RFC 7636 shape", () => {
    expect(verifyPkceS256("", RFC_CHALLENGE)).toBe(false)
    // 42 chars — one below the minimum.
    const short = "a".repeat(42)
    expect(verifyPkceS256(short, challengeFor(short))).toBe(false)
    // 129 chars — one above the maximum.
    const long = "a".repeat(129)
    expect(verifyPkceS256(long, challengeFor(long))).toBe(false)
    // Characters outside the unreserved set.
    const bad = `${"a".repeat(42)}/`
    expect(verifyPkceS256(bad, challengeFor(bad))).toBe(false)
  })

  it("rejects a malformed challenge without throwing", () => {
    expect(verifyPkceS256(RFC_VERIFIER, "")).toBe(false)
    expect(verifyPkceS256(RFC_VERIFIER, "short")).toBe(false)
    expect(verifyPkceS256(RFC_VERIFIER, `${RFC_CHALLENGE}=`)).toBe(false)
  })
})

describe("isValidCodeChallenge", () => {
  it("accepts a base64url S256 digest and rejects junk", () => {
    expect(isValidCodeChallenge(RFC_CHALLENGE)).toBe(true)
    expect(isValidCodeChallenge("")).toBe(false)
    expect(isValidCodeChallenge("too-short")).toBe(false)
    expect(isValidCodeChallenge(`${RFC_CHALLENGE}+/`)).toBe(false)
  })
})
