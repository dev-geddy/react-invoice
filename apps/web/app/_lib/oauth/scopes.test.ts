import { describe, expect, it } from "vitest"

import { MCP_SCOPES } from "./types"
import {
  formatScopes,
  grantableScopes,
  intersectScopes,
  isMcpScope,
  parseScopes,
  SCOPE_LABELS,
} from "./scopes"

/**
 * Scopes are capabilities (`L2-MCP-18`) and the grantable set is decided by the
 * consenting user's role (`L2-MCP-34`). These are the pure halves of both.
 */

describe("isMcpScope", () => {
  it("accepts exactly the grantable scopes", () => {
    for (const scope of MCP_SCOPES) expect(isMcpScope(scope)).toBe(true)
    // Deliberately not grantable — the connector is read-only in this phase.
    expect(isMcpScope("users.edit")).toBe(false)
    expect(isMcpScope("")).toBe(false)
    expect(isMcpScope(null)).toBe(false)
    expect(isMcpScope(["account"])).toBe(false)
  })
})

describe("parseScopes", () => {
  it("splits on whitespace and drops unknown scopes", () => {
    expect(parseScopes("account users.view offline_access")).toEqual([
      "account",
      "users.view",
    ])
  })

  it("dedupes and returns a canonical order regardless of input order", () => {
    expect(parseScopes("settings account account settings")).toEqual([
      "account",
      "settings",
    ])
    expect(parseScopes("users.view dashboard")).toEqual([
      "dashboard",
      "users.view",
    ])
  })

  it("treats absent/blank input as no scopes", () => {
    expect(parseScopes(null)).toEqual([])
    expect(parseScopes(undefined)).toEqual([])
    expect(parseScopes("")).toEqual([])
    expect(parseScopes("   ")).toEqual([])
  })

  it("never yields a scope the server does not offer", () => {
    expect(parseScopes("users.edit admin root")).toEqual([])
  })

  it("round-trips through formatScopes", () => {
    const scopes = parseScopes("settings dashboard")
    expect(formatScopes(scopes)).toBe("dashboard settings")
    expect(parseScopes(formatScopes(scopes))).toEqual(scopes)
  })
})

describe("grantableScopes", () => {
  it("mirrors the role capability model", () => {
    expect(grantableScopes("owner")).toEqual([
      "account",
      "dashboard",
      "users.view",
      "settings",
    ])
    expect(grantableScopes("admin")).toEqual([
      "account",
      "dashboard",
      "users.view",
    ])
    expect(grantableScopes("teammate")).toEqual(["account", "dashboard"])
  })

  it("never offers settings or users.view to a teammate", () => {
    expect(grantableScopes("teammate")).not.toContain("users.view")
    expect(grantableScopes("teammate")).not.toContain("settings")
  })
})

describe("intersectScopes", () => {
  it("keeps only what both sides hold, in canonical order", () => {
    expect(
      intersectScopes(
        ["settings", "users.view", "account"],
        grantableScopes("admin")
      )
    ).toEqual(["account", "users.view"])
  })

  it("narrows to nothing when the role lost every requested capability", () => {
    expect(intersectScopes(["settings"], grantableScopes("teammate"))).toEqual(
      []
    )
  })
})

describe("SCOPE_LABELS", () => {
  it("has plain-language copy for every grantable scope", () => {
    for (const scope of MCP_SCOPES) {
      const label = SCOPE_LABELS[scope]
      expect(label.title.length).toBeGreaterThan(0)
      expect(label.description.length).toBeGreaterThan(0)
    }
  })
})
