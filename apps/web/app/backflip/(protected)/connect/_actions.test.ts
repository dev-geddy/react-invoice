import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

/**
 * The connector kill switch on the consent/account server actions
 * (`L2-MCP-37`). A server action is POST-invocable by its action id and does
 * NOT inherit the `isMcpEnabled()` guard on `/backflip/connect`, so each action
 * has to assert the flag itself — otherwise a connector disabled after clients
 * had already registered could still be handed a fresh authorization code.
 *
 * `isMcpEnabled()` is DB-backed and async now that enablement is an owner
 * toggle rather than a static env read (`L2-MCP-25`); it's mocked directly
 * here rather than exercised end to end — its own resolution logic (DB flag
 * AND the `MCP_ENABLED=false` override) is covered by `_lib/oauth/config`'s
 * own tests. What this file asserts is the ordering property: the actions
 * must 404 on that flag *before* touching the session, every time.
 */

const NOT_FOUND = "NEXT_NOT_FOUND"

vi.mock("@workspace/db", async () => {
  process.env.DATABASE_URL ??= "postgres://test:test@127.0.0.1:5432/test"
  const actual =
    await vi.importActual<typeof import("@workspace/db")>("@workspace/db")
  return { ...actual, db: {} }
})

vi.mock("next/cache", () => ({ revalidatePath: () => {} }))

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error(NOT_FOUND)
  },
  redirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`)
  },
}))

const h = vi.hoisted(() => ({ guardCalls: 0, mcpEnabled: false }))

vi.mock("@/app/_lib/auth/guard", () => ({
  requireCapability: async () => {
    h.guardCalls++
    return { id: "user-1", role: "owner", email: "owner@example.com" }
  },
}))

vi.mock("@/app/_lib/oauth/config", async () => {
  const actual = await vi.importActual<
    typeof import("@/app/_lib/oauth/config")
  >("@/app/_lib/oauth/config")
  return { ...actual, isMcpEnabled: async () => h.mcpEnabled }
})

import {
  approveAuthorization,
  denyAuthorization,
  disconnectConnection,
} from "./_actions"

const ACTIONS: Array<[string, (formData: FormData) => Promise<void>]> = [
  ["approveAuthorization", approveAuthorization],
  ["denyAuthorization", denyAuthorization],
  ["disconnectConnection", disconnectConnection],
]

beforeEach(() => {
  h.guardCalls = 0
  h.mcpEnabled = false
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe.each(ACTIONS)("%s", (_name, action) => {
  it("404s while the connector is disabled, before touching the session", async () => {
    h.mcpEnabled = false
    await expect(action(new FormData())).rejects.toThrow(NOT_FOUND)
    expect(h.guardCalls).toBe(0)
  })

  it("runs the session check once the connector is enabled", async () => {
    h.mcpEnabled = true
    // Empty form → the action bails further down (fatal validation / no
    // clientId); all that matters here is that it got past the switch.
    await action(new FormData()).catch(() => {})
    expect(h.guardCalls).toBe(1)
  })
})
