import { describe, expect, it } from "vitest"

import type { McpAuthContext, McpScope } from "@/app/_lib/oauth/types"

import { TOOL_DEFS, visibleTools } from "./index"

/**
 * Locks tool visibility = token scopes ∩ role capabilities (`L2-MCP-20`,
 * `L2-MCP-43`). Pure — no SDK, no database.
 */
function ctx(role: McpAuthContext["role"], scopes: McpScope[]): McpAuthContext {
  return {
    userId: "u1",
    role,
    clientId: "client-1",
    clientName: "Claude",
    scopes,
    tokenId: "token-1",
    expiresAt: new Date("2030-01-01"),
  }
}

const ALL_SCOPES: McpScope[] = [
  "account",
  "dashboard",
  "users.view",
  "settings",
]

describe("visibleTools", () => {
  it("registers every tool for TOOL_DEFS", () => {
    expect(TOOL_DEFS.map((t) => t.name).sort()).toEqual(
      [
        "get_dashboard_summary",
        "get_platform_status",
        "get_user",
        "list_users",
        "whoami",
      ].sort()
    )
  })

  it("an owner with every scope sees all five tools", () => {
    const names = visibleTools(ctx("owner", ALL_SCOPES)).map((t) => t.name)
    expect(names.sort()).toEqual(
      [
        "whoami",
        "list_users",
        "get_user",
        "get_platform_status",
        "get_dashboard_summary",
      ].sort()
    )
  })

  it("a teammate with every scope sees only whoami + get_dashboard_summary", () => {
    // Role capability gates it even though the token carries every scope —
    // teammate lacks users.view and settings entirely.
    const names = visibleTools(ctx("teammate", ALL_SCOPES)).map((t) => t.name)
    expect(names.sort()).toEqual(["get_dashboard_summary", "whoami"].sort())
    expect(names).not.toContain("list_users")
    expect(names).not.toContain("get_user")
    expect(names).not.toContain("get_platform_status")
  })

  it("an admin with every scope sees users.view tools but not settings", () => {
    const names = visibleTools(ctx("admin", ALL_SCOPES)).map((t) => t.name)
    expect(names.sort()).toEqual(
      ["whoami", "list_users", "get_user", "get_dashboard_summary"].sort()
    )
    expect(names).not.toContain("get_platform_status")
  })

  it("an owner missing a scope on the token loses that tool despite role capability", () => {
    // Token scope ∩ role capability — role alone is not enough.
    const names = visibleTools(ctx("owner", ["account", "dashboard"])).map(
      (t) => t.name
    )
    expect(names.sort()).toEqual(["whoami", "get_dashboard_summary"].sort())
  })

  it("an empty scope list yields no tools regardless of role", () => {
    expect(visibleTools(ctx("owner", []))).toEqual([])
  })
})
