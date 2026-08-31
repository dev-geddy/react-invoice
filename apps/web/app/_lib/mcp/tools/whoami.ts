import { db, users } from "@workspace/db"
import { eq } from "drizzle-orm"
import { z } from "zod"

import type { CallToolResult, McpServer } from "@modelcontextprotocol/server"

import { can } from "@/app/_lib/auth/permissions"
import type { McpAuthContext } from "@/app/_lib/oauth/types"

/**
 * `whoami` — identity check for the connected account. Scope `account`.
 *
 * @spec L2-MCP-04, L2-MCP-09, L2-MCP-34
 */
export const WHOAMI_SCOPE = "account" as const

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
  // Re-check scope + live role capability on every call, not just at
  // registration time (`L2-MCP-34`) — a demotion takes effect immediately.
  if (!ctx.scopes.includes(WHOAMI_SCOPE) || !can(ctx.role, WHOAMI_SCOPE)) {
    return toolError("This connection no longer has the account scope.")
  }

  const [row] = await db
    .select({ id: users.id, email: users.email, name: users.name })
    .from(users)
    .where(eq(users.id, ctx.userId))
    .limit(1)

  if (!row) return toolError("The connected account no longer exists.")

  return toolResult({
    id: row.id,
    email: row.email,
    name: row.name,
    role: ctx.role,
    scopes: ctx.scopes,
    client: ctx.clientName,
  })
}

/** Registers `whoami` on `server`, bound to this request's auth context. */
export function registerWhoami(server: McpServer, ctx: McpAuthContext): void {
  server.registerTool(
    "whoami",
    {
      title: "Who am I",
      description:
        "The connected Backflip account (id, email, name, role), the scopes " +
        "this connector was granted, and the connected client's name.",
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
