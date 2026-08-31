import { createHash, timingSafeEqual } from "node:crypto"

import { db, generateToken, hashToken, oauthAuthCodes } from "@workspace/db"
import { and, eq, isNull } from "drizzle-orm"

import { AUTH_CODE_TTL_SEC } from "./config"
import { parseScopes } from "./scopes"
import { revokeTokenFamily } from "./tokens"
import type { McpScope, OAuthFailure } from "./types"

/**
 * PKCE authorization codes: mint at consent, consume once at the token
 * endpoint. Hash-only storage — the raw code exists solely in the redirect back
 * to the client (`L2-MCP-28`).
 *
 * The code row's own `id` doubles as the `familyId` of every token minted from
 * it, which is what lets a replayed code revoke exactly the lineage it created
 * (`L2-MCP-32`) without a second link table.
 *
 * @spec L2-MCP-22, L2-MCP-26, L2-MCP-32
 */

/** Deliberately identical for every failure mode — no oracle (`L2-MCP-41`). */
const INVALID_GRANT: OAuthFailure = {
  error: "invalid_grant",
  description: "The authorization code is invalid, expired or already used.",
}

/** RFC 7636 §4.1: 43–128 chars from the unreserved set. */
const VERIFIER_PATTERN = /^[A-Za-z0-9\-._~]{43,128}$/

/** A base64url S256 challenge is always 43 chars, but stay permissive on shape. */
const CHALLENGE_PATTERN = /^[A-Za-z0-9\-._~]{43,128}$/

/**
 * Whether `codeChallenge` is `base64url(sha256(codeVerifier))` (RFC 7636 S256).
 * `plain` is never accepted anywhere in this server (`L2-MCP-26`). Compared in
 * constant time — the challenge is attacker-supplied at authorize time.
 */
export function verifyPkceS256(
  codeVerifier: string,
  codeChallenge: string
): boolean {
  if (!VERIFIER_PATTERN.test(codeVerifier)) return false
  if (!CHALLENGE_PATTERN.test(codeChallenge)) return false

  const expected = Buffer.from(
    createHash("sha256").update(codeVerifier).digest("base64url")
  )
  const actual = Buffer.from(codeChallenge)
  if (expected.length !== actual.length) return false
  return timingSafeEqual(expected, actual)
}

/** Whether a code challenge is well-formed enough to accept at authorize time. */
export function isValidCodeChallenge(value: string): boolean {
  return CHALLENGE_PATTERN.test(value)
}

/**
 * Mint an authorization code for an approved consent. Returns the RAW code —
 * put it in the redirect back to the client; only its hash is persisted.
 * Lives for 60 seconds (`L2-MCP-24`).
 */
export async function createAuthorizationCode(input: {
  clientDbId: string
  userId: string
  redirectUri: string
  scopes: McpScope[]
  resource: string | null
  codeChallenge: string
  codeChallengeMethod: "S256"
}): Promise<string> {
  const raw = generateToken()

  await db.insert(oauthAuthCodes).values({
    codeHash: hashToken(raw),
    clientId: input.clientDbId,
    userId: input.userId,
    redirectUri: input.redirectUri,
    scopes: input.scopes,
    resource: input.resource,
    codeChallenge: input.codeChallenge,
    codeChallengeMethod: input.codeChallengeMethod,
    expiresAt: new Date(Date.now() + AUTH_CODE_TTL_SEC * 1000),
  })

  return raw
}

export type ConsumedAuthorizationCode = {
  userId: string
  scopes: McpScope[]
  resource: string | null
  /**
   * `familyId` to issue the first token pair under, so a later replay of this
   * code can revoke exactly the tokens it produced (`L2-MCP-32`).
   */
  familyId: string
}

/**
 * Validate and burn an authorization code. Succeeds only for a live, unused
 * code bound to this client and this exact redirect URI, with a matching PKCE
 * verifier.
 *
 * A code that was already consumed is treated as an attack: the token family it
 * minted is revoked before the generic failure is returned (`L2-MCP-32`).
 * Every other failure leaves the row untouched — a wrong-verifier attempt must
 * not burn a still-valid code.
 */
export async function consumeAuthorizationCode(input: {
  code: string
  clientDbId: string
  redirectUri: string
  codeVerifier: string
}): Promise<
  | ({ ok: true } & ConsumedAuthorizationCode)
  | { ok: false; failure: OAuthFailure }
> {
  if (!input.code) return { ok: false, failure: INVALID_GRANT }

  const [row] = await db
    .select()
    .from(oauthAuthCodes)
    .where(eq(oauthAuthCodes.codeHash, hashToken(input.code)))

  if (!row) return { ok: false, failure: INVALID_GRANT }

  if (row.consumedAt) {
    await revokeTokenFamily(row.id)
    return { ok: false, failure: INVALID_GRANT }
  }

  if (row.clientId !== input.clientDbId) {
    return { ok: false, failure: INVALID_GRANT }
  }
  if (row.redirectUri !== input.redirectUri) {
    return { ok: false, failure: INVALID_GRANT }
  }
  if (row.expiresAt.getTime() <= Date.now()) {
    return { ok: false, failure: INVALID_GRANT }
  }
  if (row.codeChallengeMethod !== "S256") {
    return { ok: false, failure: INVALID_GRANT }
  }
  if (!verifyPkceS256(input.codeVerifier, row.codeChallenge)) {
    return { ok: false, failure: INVALID_GRANT }
  }

  // Compare-and-set: the loser of two concurrent exchanges updates no row and
  // is handled as a replay, family revocation included.
  const consumed = await db
    .update(oauthAuthCodes)
    .set({ consumedAt: new Date() })
    .where(
      and(eq(oauthAuthCodes.id, row.id), isNull(oauthAuthCodes.consumedAt))
    )
    .returning({ id: oauthAuthCodes.id })

  if (consumed.length === 0) {
    await revokeTokenFamily(row.id)
    return { ok: false, failure: INVALID_GRANT }
  }

  return {
    ok: true,
    userId: row.userId,
    scopes: parseScopes(row.scopes.join(" ")),
    resource: row.resource,
    familyId: row.id,
  }
}
