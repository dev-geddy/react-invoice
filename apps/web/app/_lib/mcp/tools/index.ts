import type { McpServer } from "@modelcontextprotocol/server"

import { can } from "@/app/_lib/auth/permissions"
import type { McpAuthContext, McpScope } from "@/app/_lib/oauth/types"

import { DASHBOARD_SCOPE, registerDashboardSummary } from "./dashboard"
import { PLATFORM_SCOPE, registerPlatformStatus } from "./platform"
import { registerGetUser, registerListUsers, USERS_SCOPE } from "./users"
import { registerWhoami, WHOAMI_SCOPE } from "./whoami"

/**
 * The read-only tool surface (phase 1) and the pure scope/capability filter
 * that decides which of them a given request may see.
 *
 * @spec L2-MCP-04, L2-MCP-05, L2-MCP-06, L2-MCP-07, L2-MCP-08, L2-MCP-20
 */

export type ToolDef = {
  name: string
  scope: McpScope
  register: (server: McpServer, ctx: McpAuthContext) => void
}

export const TOOL_DEFS: ToolDef[] = [
  { name: "whoami", scope: WHOAMI_SCOPE, register: registerWhoami },
  { name: "list_users", scope: USERS_SCOPE, register: registerListUsers },
  { name: "get_user", scope: USERS_SCOPE, register: registerGetUser },
  {
    name: "get_platform_status",
    scope: PLATFORM_SCOPE,
    register: registerPlatformStatus,
  },
  {
    name: "get_dashboard_summary",
    scope: DASHBOARD_SCOPE,
    register: registerDashboardSummary,
  },
]

/**
 * Tool visibility = token scopes ∩ role capabilities (`L2-MCP-20`). A tool
 * failing this filter is never registered, so it never appears in
 * `tools/list` and a direct call resolves as "unknown tool". Pure — no SDK
 * or DB involved, so registration behavior is unit-testable directly.
 */
export function visibleTools(ctx: McpAuthContext): ToolDef[] {
  return TOOL_DEFS.filter(
    (tool) => ctx.scopes.includes(tool.scope) && can(ctx.role, tool.scope)
  )
}
