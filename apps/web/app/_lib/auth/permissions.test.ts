import { describe, expect, it } from "vitest"
import {
  can,
  canAccessSettings,
  canEditUsers,
  canViewUsers,
  type Capability,
  type Role,
} from "@/app/_lib/auth/permissions"

const ALL_CAPABILITIES: Capability[] = [
  "dashboard",
  "account",
  "users.view",
  "users.edit",
  "settings",
]

// Contract L2-AUTH-21: owner = all 5, admin = dashboard/account/users.view, teammate = dashboard/account.
const GRANTED: Record<Role, Capability[]> = {
  owner: ["dashboard", "account", "users.view", "users.edit", "settings"],
  admin: ["dashboard", "account", "users.view"],
  teammate: ["dashboard", "account"],
}

describe("can", () => {
  for (const role of Object.keys(GRANTED) as Role[]) {
    const granted = GRANTED[role]
    const denied = ALL_CAPABILITIES.filter((c) => !granted.includes(c))

    it(`grants ${role} exactly [${granted.join(", ")}]`, () => {
      for (const capability of granted) {
        expect(can(role, capability)).toBe(true)
      }
    })

    it(`denies ${role} [${denied.join(", ") || "none"}]`, () => {
      for (const capability of denied) {
        expect(can(role, capability)).toBe(false)
      }
    })
  }

  it("denies unknown, null, and undefined roles", () => {
    for (const capability of ALL_CAPABILITIES) {
      expect(can("superuser", capability)).toBe(false)
      expect(can(null, capability)).toBe(false)
      expect(can(undefined, capability)).toBe(false)
    }
  })
})

describe("canViewUsers", () => {
  it("true for owner/admin, false for teammate", () => {
    expect(canViewUsers("owner")).toBe(true)
    expect(canViewUsers("admin")).toBe(true)
    expect(canViewUsers("teammate")).toBe(false)
  })
})

describe("canEditUsers", () => {
  it("true only for owner", () => {
    expect(canEditUsers("owner")).toBe(true)
    expect(canEditUsers("admin")).toBe(false)
    expect(canEditUsers("teammate")).toBe(false)
  })
})

describe("canAccessSettings", () => {
  it("true only for owner", () => {
    expect(canAccessSettings("owner")).toBe(true)
    expect(canAccessSettings("admin")).toBe(false)
    expect(canAccessSettings("teammate")).toBe(false)
  })
})
