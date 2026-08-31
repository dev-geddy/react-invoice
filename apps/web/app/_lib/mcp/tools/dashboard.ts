import { db, users } from "@workspace/db"
import { count, desc, isNotNull } from "drizzle-orm"
import { z } from "zod"

import type { CallToolResult, McpServer } from "@modelcontextprotocol/server"

import { can, ROLES } from "@/app/_lib/auth/permissions"
import type { McpAuthContext } from "@/app/_lib/oauth/types"

/**
 * `get_dashboard_summary` — user counts + recent signups. Scope `dashboard`.
 * Aggregated in SQL (counts, `limit 5`) rather than pulling the whole table
 * into memory.
 *
 * @spec L2-MCP-08, L2-MCP-09, L2-MCP-34
 */
export const DASHBOARD_SCOPE = "dashboard" as const

const inputSchema = z.object({})

function toolResult(data: Record<string, unknown>): CallToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
    structuredContent: data,
  }
}

function toolError(message: string): CallToolResult {
  return { content: [{ type: "text", text: message }], isError: true }
}

async function handle(ctx: McpAuthContext): Promise<CallToolResult> {
  if (
    !ctx.scopes.includes(DASHBOARD_SCOPE) ||
    !can(ctx.role, DASHBOARD_SCOPE)
  ) {
    return toolError("This connection no longer has the dashboard scope.")
  }

  const [totalRow] = await db.select({ value: count() }).from(users)
  const total = totalRow?.value ?? 0

  const roleRows = await db
    .select({ role: users.role, value: count() })
    .from(users)
    .groupBy(users.role)

  const byRole: Record<string, number> = Object.fromEntries(
    ROLES.map((r) => [r, 0])
  )
  for (const r of roleRows) byRole[r.role] = r.value

  const [verifiedRow] = await db
    .select({ value: count() })
    .from(users)
    .where(isNotNull(users.emailVerified))
  const verified = verifiedRow?.value ?? 0

  const recentSignups = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      createdAt: users.createdAt,
    })
    .from(users)
    .orderBy(desc(users.createdAt))
    .limit(5)

  return toolResult({
    total,
    byRole,
    verified,
    unverified: total - verified,
    recentSignups,
  })
}

export function registerDashboardSummary(
  server: McpServer,
  ctx: McpAuthContext
): void {
  server.registerTool(
    "get_dashboard_summary",
    {
      title: "Dashboard summary",
      description:
        "User counts (total + per role, verified vs unverified) and the 5 " +
        "most recent signups.",
      inputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    () => handle(ctx)
  )
}
