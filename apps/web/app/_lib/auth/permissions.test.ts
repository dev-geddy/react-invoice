import { describe, expect, it } from "vitest"
import {
  can,
  canAccessSettings,
  canEditUsers,
  canManageInvoice,
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
  "invoices",
]

// Contract L2-AUTH-21: owner = all 6, admin = dashboard/account/users.view/invoices,
// teammate = dashboard/account/invoices (invoices are shared, L2-INVOICE-05).
const GRANTED: Record<Role, Capability[]> = {
  owner: [
    "dashboard",
    "account",
    "users.view",
    "users.edit",
    "settings",
    "invoices",
  ],
  admin: ["dashboard", "account", "users.view", "invoices"],
  teammate: ["dashboard", "account", "invoices"],
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

describe("canManageInvoice", () => {
  it("lets the creator manage their own invoice, whatever their role", () => {
    expect(canManageInvoice("teammate", "u1", "u1")).toBe(true)
  })

  it("lets platform operators manage someone else's invoice", () => {
    expect(canManageInvoice("owner", "u1", "u2")).toBe(true)
    expect(canManageInvoice("admin", "u1", "u2")).toBe(true)
  })

  it("denies a teammate someone else's invoice", () => {
    expect(canManageInvoice("teammate", "u1", "u2")).toBe(false)
  })

  it("denies unknown roles and missing sessions", () => {
    expect(canManageInvoice("superuser", "u1", "u1")).toBe(false)
    expect(canManageInvoice(null, "u1", null)).toBe(false)
  })
})
