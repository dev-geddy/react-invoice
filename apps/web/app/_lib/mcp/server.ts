import { McpServer } from "@modelcontextprotocol/server"

import type { McpAuthContext } from "@/app/_lib/oauth/types"

import { visibleTools } from "./tools"

/**
 * `buildMcpServer` — one fresh `McpServer` per request (`L2-MCP-01`),
 * registering only the tools `ctx` is allowed (`L2-MCP-02`, `L2-MCP-20`).
 * Server identity mirrors `apps/web/package.json`'s `version`; bump both
 * together.
 *
 * @spec L2-MCP-02
 */
const SERVER_VERSION = "1.0.0"

export function buildMcpServer(ctx: McpAuthContext): McpServer {
  const server = new McpServer({ name: "backflip", version: SERVER_VERSION })
  for (const tool of visibleTools(ctx)) tool.register(server, ctx)
  return server
}
