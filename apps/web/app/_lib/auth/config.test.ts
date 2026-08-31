import { afterEach, describe, expect, it, vi } from "vitest"

import {
  isCredentialsEnabled,
  isGoogleConfigured,
} from "@/app/_lib/auth/config"

/**
 * Auth-mode flags. Locks L2-AUTH-33 (both Google vars required) and the
 * L2-AUTH-34 fail-safe: disabling credentials only counts when Google works,
 * so a deployment can never end up with zero sign-in methods.
 */

type Env = {
  AUTH_GOOGLE_ID?: string
  AUTH_GOOGLE_SECRET?: string
  AUTH_CREDENTIALS_ENABLED?: string
}

function stubEnv(env: Env) {
  vi.stubEnv("AUTH_GOOGLE_ID", env.AUTH_GOOGLE_ID)
  vi.stubEnv("AUTH_GOOGLE_SECRET", env.AUTH_GOOGLE_SECRET)
  vi.stubEnv("AUTH_CREDENTIALS_ENABLED", env.AUTH_CREDENTIALS_ENABLED)
}

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("isGoogleConfigured", () => {
  const cases: Array<[string, Env, boolean]> = [
    [
      "both id and secret set",
      { AUTH_GOOGLE_ID: "id", AUTH_GOOGLE_SECRET: "secret" },
      true,
    ],
    ["id only", { AUTH_GOOGLE_ID: "id" }, false],
    ["secret only", { AUTH_GOOGLE_SECRET: "secret" }, false],
    ["neither", {}, false],
    ["empty strings", { AUTH_GOOGLE_ID: "", AUTH_GOOGLE_SECRET: "" }, false],
    [
      "id set, secret empty",
      { AUTH_GOOGLE_ID: "id", AUTH_GOOGLE_SECRET: "" },
      false,
    ],
  ]

  for (const [name, env, expected] of cases) {
    it(`${name} → ${expected}`, () => {
      stubEnv(env)
      expect(isGoogleConfigured()).toBe(expected)
    })
  }
})

describe("isCredentialsEnabled", () => {
  const google = { AUTH_GOOGLE_ID: "id", AUTH_GOOGLE_SECRET: "secret" }

  const cases: Array<[string, Env, boolean]> = [
    ["unset flag, no Google", {}, true],
    ["unset flag, Google configured", { ...google }, true],
    [
      '"false" + Google configured → Google-only',
      { ...google, AUTH_CREDENTIALS_ENABLED: "false" },
      false,
    ],
    [
      '"false" without Google → ignored (fail-safe)',
      { AUTH_CREDENTIALS_ENABLED: "false" },
      true,
    ],
    [
      '"false" with half-configured Google → ignored',
      { AUTH_GOOGLE_ID: "id", AUTH_CREDENTIALS_ENABLED: "false" },
      true,
    ],
    [
      '"true" + Google configured',
      { ...google, AUTH_CREDENTIALS_ENABLED: "true" },
      true,
    ],
    [
      '"FALSE" is not "false"',
      { ...google, AUTH_CREDENTIALS_ENABLED: "FALSE" },
      true,
    ],
    ['"0" is not "false"', { ...google, AUTH_CREDENTIALS_ENABLED: "0" }, true],
  ]

  for (const [name, env, expected] of cases) {
    it(`${name} → ${expected}`, () => {
      stubEnv(env)
      expect(isCredentialsEnabled()).toBe(expected)
    })
  }

  it("never leaves a deployment without a sign-in method", () => {
    for (const flag of [undefined, "false", "true"]) {
      for (const g of [{}, google]) {
        stubEnv({ ...g, AUTH_CREDENTIALS_ENABLED: flag })
        expect(isCredentialsEnabled() || isGoogleConfigured()).toBe(true)
      }
    }
  })
})
