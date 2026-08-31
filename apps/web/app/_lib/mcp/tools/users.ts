import { db, users } from "@workspace/db"
import { count, desc, eq, ilike, or } from "drizzle-orm"
import { z } from "zod"

import type { CallToolResult, McpServer } from "@modelcontextprotocol/server"

import { can } from "@/app/_lib/auth/permissions"
import type { McpAuthContext } from "@/app/_lib/oauth/types"

/**
 * `list_users` + `get_user` — read-only user directory lookups. Scope
 * `users.view`. Columns are selected explicitly everywhere: never
 * `passwordHash`, never anything beyond `id/name/email/role/emailVerified/
 * createdAt` (`L2-MCP-35`).
 *
 * @spec L2-MCP-05, L2-MCP-06, L2-MCP-09, L2-MCP-34, L2-MCP-36
 */
export const USERS_SCOPE = "users.view" as const

function toolResult(data: Record<string, unknown>): CallToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
    structuredContent: data,
  }
}

function toolError(message: string): CallToolResult {
  return { content: [{ type: "text", text: message }], isError: true }
}

function scopeError(ctx: McpAuthContext): CallToolResult | null {
  // Re-checked on every call, not just at registration (`L2-MCP-34`).
  if (!ctx.scopes.includes(USERS_SCOPE) || !can(ctx.role, USERS_SCOPE)) {
    return toolError("This connection no longer has the users.view scope.")
  }
  return null
}

// ---------------------------------------------------------------------------
// list_users
// ---------------------------------------------------------------------------

export const LIST_USERS_DEFAULT_LIMIT = 25
export const LIST_USERS_MAX_LIMIT = 100
/** Above this, the raw literal no longer fits Postgres' bigint OFFSET and the query errors instead of just paging past the end. */
export const LIST_USERS_MAX_OFFSET = Number.MAX_SAFE_INTEGER

const listUsersInputSchema = z.object({
  limit: z.number().int().optional(),
  offset: z.number().int().optional(),
  query: z.string().optional(),
})

export type ListUsersInput = z.infer<typeof listUsersInputSchema>
export type ListUsersArgs = { limit: number; offset: number; query?: string }

/**
 * Bounds + defaults for `list_users` — always bounded, never an unbounded
 * table dump (`L2-MCP-36`). Pure so the clamping rule is unit-testable
 * without a database.
 */
export function clampListUsersArgs(input: ListUsersInput): ListUsersArgs {
  const limit = Math.min(
    Math.max(Math.trunc(input.limit ?? LIST_USERS_DEFAULT_LIMIT), 1),
    LIST_USERS_MAX_LIMIT
  )
  const offset = Math.min(
    Math.max(Math.trunc(input.offset ?? 0), 0),
    LIST_USERS_MAX_OFFSET
  )
  const query = input.query?.trim()
  return { limit, offset, query: query ? query : undefined }
}

async function handleListUsers(
  ctx: McpAuthContext,
  rawArgs: ListUsersInput
): Promise<CallToolResult> {
  const scoped = scopeError(ctx)
  if (scoped) return scoped

  const { limit, offset, query } = clampListUsersArgs(rawArgs)
  const filter = query
    ? or(ilike(users.email, `%${query}%`), ilike(users.name, `%${query}%`))
    : undefined

  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      emailVerified: users.emailVerified,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(filter)
    .orderBy(desc(users.createdAt))
    .limit(limit)
    .offset(offset)

  const [totalRow] = await db
    .select({ value: count() })
    .from(users)
    .where(filter)

  return toolResult({
    users: rows.map((u) => ({ ...u, emailVerified: Boolean(u.emailVerified) })),
    total: totalRow?.value ?? 0,
    limit,
    offset,
  })
}

export function registerListUsers(
  server: McpServer,
  ctx: McpAuthContext
): void {
  server.registerTool(
    "list_users",
    {
      title: "List users",
      description:
        "Bounded, paginated user directory. `query` matches email or name " +
        "case-insensitively. `limit` is 1-100 (default 25), `offset` >= 0.",
      inputSchema: listUsersInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    (args) => handleListUsers(ctx, args)
  )
}

// ---------------------------------------------------------------------------
// get_user
// ---------------------------------------------------------------------------

const getUserInputSchema = z.object({
  userId: z.string().trim().optional(),
  email: z.string().trim().optional(),
})

export type GetUserInput = z.infer<typeof getUserInputSchema>
export type GetUserSelector =
  { kind: "userId"; value: string } | { kind: "email"; value: string }

/**
 * Exactly one of `userId`/`email` is required — pure rule, unit-tested
 * directly. Returns `{ error }` rather than throwing so the handler can turn
 * it into a tool-level error result, never a 500 (`L2-MCP-06`).
 */
export function resolveGetUserSelector(
  input: GetUserInput
): GetUserSelector | { error: string } {
  const hasId = Boolean(input.userId)
  const hasEmail = Boolean(input.email)
  if (hasId === hasEmail) {
    return { error: "Provide exactly one of userId or email." }
  }
  return hasId
    ? { kind: "userId", value: input.userId as string }
    : { kind: "email", value: input.email as string }
}

async function handleGetUser(
  ctx: McpAuthContext,
  rawArgs: GetUserInput
): Promise<CallToolResult> {
  const scoped = scopeError(ctx)
  if (scoped) return scoped

  const selector = resolveGetUserSelector(rawArgs)
  if ("error" in selector) return toolError(selector.error)

  const [row] = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      emailVerified: users.emailVerified,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(
      selector.kind === "userId"
        ? eq(users.id, selector.value)
        : eq(users.email, selector.value)
    )
    .limit(1)

  if (!row) return toolError("No user found for that userId/email.")

  return toolResult({ ...row, emailVerified: Boolean(row.emailVerified) })
}

export function registerGetUser(server: McpServer, ctx: McpAuthContext): void {
  server.registerTool(
    "get_user",
    {
      title: "Get user",
      description:
        "Look up one user by `userId` or `email` (exactly one required). " +
        "Not found returns a tool error, not a failure.",
      inputSchema: getUserInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    (args) => handleGetUser(ctx, args)
  )
}
