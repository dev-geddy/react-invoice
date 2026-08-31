import { randomUUID } from "node:crypto"

import {
  db,
  generateToken,
  hashToken,
  oauthClients,
  oauthTokens,
  users,
} from "@workspace/db"
import { and, eq, gt, isNull } from "drizzle-orm"

import { ACCESS_TOKEN_TTL_SEC, REFRESH_TOKEN_TTL_SEC } from "./config"
import { grantableScopes, intersectScopes, parseScopes } from "./scopes"
import {
  MCP_SCOPES,
  type IssuedTokens,
  type McpScope,
  type OAuthFailure,
  type OAuthGrant,
} from "./types"

/**
 * Access + refresh token lifecycle: issue, rotate-with-reuse-detection, revoke,
 * and the per-client grant listing the account UI renders.
 *
 * Storage is hash-only (`L2-MCP-28`) — the raw token exists in exactly one HTTP
 * response and is never written down. Every token also snapshots the user's
 * `tokenVersion`, which is what makes a password change kill a connector
 * (`L2-MCP-29`), and carries the `resource` audience it was issued for
 * (`L2-MCP-33`).
 *
 * @spec L2-MCP-23, L2-MCP-27, L2-MCP-28, L2-MCP-29, L2-MCP-33, L2-MCP-34
 */

/** Generic failure — never says whether a token existed (`L2-MCP-41`). */
const INVALID_GRANT: OAuthFailure = {
  error: "invalid_grant",
  description: "The grant is invalid, expired or has been revoked.",
}

/**
 * Mint an access + refresh pair for one grant.
 *
 * Scopes are intersected with what the user's **current** role may grant before
 * anything is written, so a demotion between consent and exchange narrows the
 * token rather than being ignored (`L2-MCP-34`). `familyId` groups every token
 * descended from one authorization code; pass the existing one when rotating so
 * reuse detection can revoke the whole lineage.
 *
 * Throws only when the user has disappeared — callers map that to a generic
 * `server_error`/`invalid_grant`.
 */
export async function issueTokenPair(input: {
  userId: string
  clientDbId: string
  scopes: McpScope[]
  resource: string | null
  familyId?: string
  parentId?: string | null
}): Promise<IssuedTokens> {
  const [user] = await db
    .select({ role: users.role, tokenVersion: users.tokenVersion })
    .from(users)
    .where(eq(users.id, input.userId))

  if (!user) throw new Error("Cannot issue tokens for an unknown user")

  const scopes = intersectScopes(input.scopes, grantableScopes(user.role))
  const familyId = input.familyId ?? randomUUID()
  const parentId = input.parentId ?? null
  const accessToken = generateToken()
  const refreshToken = generateToken()
  const now = Date.now()

  await db.insert(oauthTokens).values([
    {
      type: "access",
      tokenHash: hashToken(accessToken),
      clientId: input.clientDbId,
      userId: input.userId,
      scopes,
      resource: input.resource,
      familyId,
      parentId,
      userTokenVersion: user.tokenVersion,
      expiresAt: new Date(now + ACCESS_TOKEN_TTL_SEC * 1000),
    },
    {
      type: "refresh",
      tokenHash: hashToken(refreshToken),
      clientId: input.clientDbId,
      userId: input.userId,
      scopes,
      resource: input.resource,
      familyId,
      parentId,
      userTokenVersion: user.tokenVersion,
      expiresAt: new Date(now + REFRESH_TOKEN_TTL_SEC * 1000),
    },
  ])

  return {
    accessToken,
    refreshToken,
    expiresIn: ACCESS_TOKEN_TTL_SEC,
    scopes,
  }
}

/**
 * Exchange a refresh token for a fresh pair. OAuth 2.1 rotation: the presented
 * token is revoked in the same step, so it works exactly once.
 *
 * Reuse detection (`L2-MCP-27`): presenting an already-rotated or revoked
 * refresh token — or one belonging to a different client, or one whose user
 * has since bumped `tokenVersion` — revokes the entire family. A leaked token
 * therefore kills the grant instead of quietly living alongside it.
 */
export async function rotateRefreshToken(input: {
  refreshToken: string
  clientDbId: string
}): Promise<
  { ok: true; tokens: IssuedTokens } | { ok: false; failure: OAuthFailure }
> {
  if (!input.refreshToken) return { ok: false, failure: INVALID_GRANT }

  const [row] = await db
    .select()
    .from(oauthTokens)
    .where(eq(oauthTokens.tokenHash, hashToken(input.refreshToken)))

  if (!row || row.type !== "refresh")
    return { ok: false, failure: INVALID_GRANT }

  // Replay of a rotated/revoked token — the grant is considered compromised.
  if (row.revokedAt) {
    await revokeTokenFamily(row.familyId)
    return { ok: false, failure: INVALID_GRANT }
  }

  // Wrong client holding a valid refresh token is a leak, not a mistake.
  if (row.clientId !== input.clientDbId) {
    await revokeTokenFamily(row.familyId)
    return { ok: false, failure: INVALID_GRANT }
  }

  // Natural expiry: no family revocation, nothing was compromised.
  if (row.expiresAt.getTime() <= Date.now()) {
    return { ok: false, failure: INVALID_GRANT }
  }

  const [user] = await db
    .select({ role: users.role, tokenVersion: users.tokenVersion })
    .from(users)
    .where(eq(users.id, row.userId))

  // Deleted user, or a credential change since issue (`L2-MCP-29`): the grant
  // is dead — tear the family down so a stale refresh can't resurrect it.
  if (!user || user.tokenVersion !== row.userTokenVersion) {
    await revokeTokenFamily(row.familyId)
    return { ok: false, failure: INVALID_GRANT }
  }

  const scopes = intersectScopes(
    parseScopes(row.scopes.join(" ")),
    grantableScopes(user.role)
  )
  if (scopes.length === 0) {
    await revokeTokenFamily(row.familyId)
    return { ok: false, failure: INVALID_GRANT }
  }

  // Conditional revoke = the rotation's compare-and-set. Two concurrent uses of
  // the same token: one updates a row, the loser sees 0 and is treated as reuse.
  // The timestamp is reused (not re-`new Date()`d) below so the re-check can
  // recognise this row's own expected revocation and exclude it.
  const rotationTimestamp = new Date()
  const rotated = await db
    .update(oauthTokens)
    .set({ revokedAt: rotationTimestamp, lastUsedAt: rotationTimestamp })
    .where(and(eq(oauthTokens.id, row.id), isNull(oauthTokens.revokedAt)))
    .returning({ id: oauthTokens.id })

  if (rotated.length === 0) {
    await revokeTokenFamily(row.familyId)
    return { ok: false, failure: INVALID_GRANT }
  }

  let tokens: IssuedTokens
  try {
    tokens = await issueTokenPair({
      userId: row.userId,
      clientDbId: row.clientId,
      scopes,
      resource: row.resource,
      familyId: row.familyId,
      parentId: row.id,
    })
  } catch {
    return { ok: false, failure: INVALID_GRANT }
  }

  // Resurrection-race re-check: `issueTokenPair` above is a separate statement
  // from the CAS, so a `revokeGrant`/`revokeTokenFamily` landing in between
  // only revokes rows that existed at that instant — the pair just inserted
  // would otherwise be born un-revoked (e.g. Disconnect racing a stolen
  // client's refresh). Re-read the family and fail closed if anything other
  // than this row's own expected revocation happened at/after
  // `rotationTimestamp` — that can only be a family-wide revoke landing
  // concurrently, since ordinary rotation history is strictly older.
  const familyRows = await db
    .select({ id: oauthTokens.id, revokedAt: oauthTokens.revokedAt })
    .from(oauthTokens)
    .where(eq(oauthTokens.familyId, row.familyId))

  if (
    familyRevokedConcurrently(
      familyRows.filter((r) => r.id !== row.id),
      rotationTimestamp
    )
  ) {
    await revokeTokenFamily(row.familyId)
    return { ok: false, failure: INVALID_GRANT }
  }

  return { ok: true, tokens }
}

/** A family member's id + revocation state, as read back for the re-check. */
export type FamilyTokenRow = { id: string; revokedAt: Date | null }

/**
 * Pure decision for the rotation race re-check (`L2-MCP-27`, resurrection
 * fix): true when some *other* row in the family was revoked at-or-after our
 * own rotation timestamp. That can only mean a family-wide revoke
 * (`revokeGrant`/`revokeTokenFamily`) landed concurrently with the CAS +
 * issue above — a row revoked strictly before `since` is ordinary rotation
 * history (an earlier refresh in the same family), not a race. No database;
 * callers pass in what they already read back.
 */
export function familyRevokedConcurrently(
  otherRows: FamilyTokenRow[],
  since: Date
): boolean {
  return otherRows.some(
    (r) => r.revokedAt !== null && r.revokedAt.getTime() >= since.getTime()
  )
}

/**
 * Revoke whatever grant a raw token belongs to (RFC 7009). Revoking any token
 * of a grant revokes the whole refresh family — a client asking to disconnect
 * means the connection, not one string. Unknown tokens are a silent no-op, so
 * the endpoint reveals nothing.
 */
export async function revokeRawToken(raw: string): Promise<void> {
  if (!raw) return
  const [row] = await db
    .select({ familyId: oauthTokens.familyId })
    .from(oauthTokens)
    .where(eq(oauthTokens.tokenHash, hashToken(raw)))
  if (!row) return
  await revokeTokenFamily(row.familyId)
}

/** Revoke every live token descended from one authorization code. */
export async function revokeTokenFamily(familyId: string): Promise<void> {
  if (!familyId) return
  await db
    .update(oauthTokens)
    .set({ revokedAt: new Date() })
    .where(
      and(eq(oauthTokens.familyId, familyId), isNull(oauthTokens.revokedAt))
    )
}

/**
 * Disconnect a client for one user: revokes every live token of that grant,
 * across families. Backs the account UI's Disconnect action (`L2-MCP-17`).
 */
export async function revokeGrant(input: {
  userId: string
  clientDbId: string
}): Promise<void> {
  await db
    .update(oauthTokens)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(oauthTokens.userId, input.userId),
        eq(oauthTokens.clientId, input.clientDbId),
        isNull(oauthTokens.revokedAt)
      )
    )
}

/**
 * The user's connected clients, one row per client: union of the scopes still
 * live, earliest connection, most recent use. Only un-revoked, un-expired
 * tokens count, so a disconnected or lapsed client drops off the list.
 */
export async function listGrants(userId: string): Promise<OAuthGrant[]> {
  const rows = await db
    .select({
      clientId: oauthClients.clientId,
      clientName: oauthClients.clientName,
      scopes: oauthTokens.scopes,
      createdAt: oauthTokens.createdAt,
      lastUsedAt: oauthTokens.lastUsedAt,
    })
    .from(oauthTokens)
    .innerJoin(oauthClients, eq(oauthTokens.clientId, oauthClients.id))
    .where(
      and(
        eq(oauthTokens.userId, userId),
        isNull(oauthTokens.revokedAt),
        gt(oauthTokens.expiresAt, new Date())
      )
    )

  const grants = new Map<string, OAuthGrant>()
  for (const row of rows) {
    const existing = grants.get(row.clientId)
    const scopes = parseScopes(row.scopes.join(" "))
    if (!existing) {
      grants.set(row.clientId, {
        clientId: row.clientId,
        clientName: row.clientName,
        scopes,
        connectedAt: row.createdAt,
        lastUsedAt: row.lastUsedAt,
      })
      continue
    }
    // Union, kept in canonical order.
    const merged = new Set<McpScope>([...existing.scopes, ...scopes])
    existing.scopes = MCP_SCOPES.filter((scope) => merged.has(scope))
    if (row.createdAt < existing.connectedAt)
      existing.connectedAt = row.createdAt
    if (
      row.lastUsedAt &&
      (!existing.lastUsedAt || row.lastUsedAt > existing.lastUsedAt)
    ) {
      existing.lastUsedAt = row.lastUsedAt
    }
  }

  return [...grants.values()].sort(
    (a, b) => b.connectedAt.getTime() - a.connectedAt.getTime()
  )
}
