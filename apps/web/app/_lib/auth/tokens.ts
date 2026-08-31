import { and, eq, gte, isNull } from "drizzle-orm"

import { db, generateToken, hashToken, userTokens } from "@workspace/db"

/**
 * Single-use, time-boxed tokens for recovery flows + per-account rate limiting.
 *
 * @spec L2-AUTH-29, L2-AUTH-37
 */

export type UserTokenType = "password_reset" | "email_change"

/** Default lifetimes (minutes) for one-time tokens. */
const TTL_MINUTES: Record<UserTokenType, number> = {
  password_reset: 60,
  email_change: 60,
}

/**
 * Mint a single-use token for `userId`. Any un-consumed token of the same type
 * for that user is invalidated first (one live token per purpose). Returns the
 * RAW token — put it in the emailed link; only its hash is persisted.
 */
export async function createUserToken(params: {
  userId: string
  type: UserTokenType
  /** Pending address, for `email_change` only. */
  newEmail?: string
}): Promise<string> {
  const { userId, type, newEmail } = params

  // Invalidate any outstanding tokens of this type (mark consumed).
  await db
    .update(userTokens)
    .set({ consumedAt: new Date() })
    .where(
      and(
        eq(userTokens.userId, userId),
        eq(userTokens.type, type),
        isNull(userTokens.consumedAt)
      )
    )

  const raw = generateToken()
  const expiresAt = new Date(Date.now() + TTL_MINUTES[type] * 60_000)

  await db.insert(userTokens).values({
    userId,
    type,
    tokenHash: hashToken(raw),
    newEmail: newEmail ?? null,
    expiresAt,
  })

  return raw
}

export type ConsumedToken = {
  userId: string
  newEmail: string | null
}

/**
 * Validate + consume a raw token. Succeeds only if a matching row exists, is of
 * the given `type`, is un-consumed, not expired, and — when `userId` is given —
 * belongs to that user. Marks it consumed (single use) and returns its
 * `userId`/`newEmail`. Any failure → null WITHOUT marking it consumed, so a
 * wrong-owner attempt can't burn a victim's still-valid token.
 */
export async function consumeUserToken(params: {
  rawToken: string
  type: UserTokenType
  /** When set, the token must belong to this user or it is left untouched. */
  userId?: string
}): Promise<ConsumedToken | null> {
  const { rawToken, type, userId } = params
  if (!rawToken) return null

  const [row] = await db
    .select()
    .from(userTokens)
    .where(eq(userTokens.tokenHash, hashToken(rawToken)))

  if (!row) return null
  if (row.type !== type) return null
  if (row.consumedAt) return null
  if (row.expiresAt.getTime() < Date.now()) return null
  if (userId && row.userId !== userId) return null

  await db
    .update(userTokens)
    .set({ consumedAt: new Date() })
    .where(eq(userTokens.id, row.id))

  return { userId: row.userId, newEmail: row.newEmail }
}

/**
 * How many tokens of `type` were minted for `userId` within the last
 * `withinMinutes`. Counts by `createdAt` (invalidated/consumed rows still
 * count) — used to rate-limit reset/email-change requests per account.
 */
export async function countRecentTokens(params: {
  userId: string
  type: UserTokenType
  withinMinutes: number
}): Promise<number> {
  const cutoff = new Date(Date.now() - params.withinMinutes * 60_000)
  const rows = await db
    .select({ id: userTokens.id })
    .from(userTokens)
    .where(
      and(
        eq(userTokens.userId, params.userId),
        eq(userTokens.type, params.type),
        gte(userTokens.createdAt, cutoff)
      )
    )
  return rows.length
}

/** Per-account request cap and window for recovery flows. */
export const RATE_LIMIT = { max: 3, windowMinutes: 15 } as const
