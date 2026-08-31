import bcrypt from "bcryptjs"
import type { NextAuthConfig } from "next-auth"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

/**
 * Auth.js provider/callback behaviour that e2e cannot reach (the Google OAuth
 * round-trip and the per-request revocation check). Locks:
 * - L2-AUTH-10/11/14 — `signIn`: Google only for pre-registered emails.
 * - L2-AUTH-36 — `jwt` revalidates `tokenVersion`; `session` drops `user`.
 * - L2-AUTH-09 — credentials `authorize` uses bcrypt, never plaintext.
 * - L2-AUTH-05/33/34 — provider composition per auth-mode flags.
 *
 * The real config object is captured by mocking the `NextAuth()` entry point,
 * so the callbacks under test are the shipped ones.
 */

const findFirst = vi.fn()
const captured: { config?: NextAuthConfig } = {}

vi.mock("@auth/drizzle-adapter", () => ({ DrizzleAdapter: () => ({}) }))

vi.mock("@workspace/db", async () => {
  const schema = await vi.importActual<typeof import("@workspace/db/schema")>(
    "@workspace/db/schema"
  )
  return { ...schema, db: { query: { users: { findFirst } } } }
})

vi.mock("next-auth", () => ({
  default: (config: NextAuthConfig) => {
    captured.config = config
    return { handlers: {}, auth: vi.fn(), signIn: vi.fn(), signOut: vi.fn() }
  },
}))

type Callbacks = NonNullable<NextAuthConfig["callbacks"]>
type SignInArgs = Parameters<NonNullable<Callbacks["signIn"]>>[0]
type JwtArgs = Parameters<NonNullable<Callbacks["jwt"]>>[0]
type SessionArgs = Parameters<NonNullable<Callbacks["session"]>>[0]
type Authorize = (creds: Record<string, unknown>) => Promise<unknown>

type EnvOverrides = {
  AUTH_GOOGLE_ID?: string
  AUTH_GOOGLE_SECRET?: string
  AUTH_CREDENTIALS_ENABLED?: string
}

async function loadConfig(env: EnvOverrides = {}): Promise<NextAuthConfig> {
  vi.resetModules()
  vi.stubEnv("AUTH_GOOGLE_ID", env.AUTH_GOOGLE_ID)
  vi.stubEnv("AUTH_GOOGLE_SECRET", env.AUTH_GOOGLE_SECRET)
  vi.stubEnv("AUTH_CREDENTIALS_ENABLED", env.AUTH_CREDENTIALS_ENABLED)
  captured.config = undefined
  await import("@/app/_lib/auth")
  if (!captured.config) throw new Error("NextAuth() config was not captured")
  return captured.config
}

function providerIds(config: NextAuthConfig): string[] {
  return config.providers.map((p) => {
    const provider = p as unknown as { id?: string; type?: string }
    return provider.id ?? provider.type ?? "unknown"
  })
}

type CredentialsProvider = {
  type?: string
  authorize?: Authorize
  // Auth.js keeps the user-supplied config here and merges it at init time.
  options?: { authorize?: Authorize }
}

function credentialsAuthorize(config: NextAuthConfig): Authorize {
  const provider = config.providers.find(
    (p) => (p as unknown as CredentialsProvider).type === "credentials"
  ) as unknown as CredentialsProvider | undefined
  const authorize = provider?.options?.authorize ?? provider?.authorize
  if (!authorize) throw new Error("credentials provider not found")
  return authorize
}

const PASSWORD = "correct-horse-battery"
const HASH = bcrypt.hashSync(PASSWORD, 4)

const USER_ROW = {
  id: "user-1",
  email: "owner@example.com",
  name: "Owner",
  image: null,
  role: "owner" as const,
  tokenVersion: 3,
  passwordHash: HASH,
}

let config: NextAuthConfig

beforeEach(async () => {
  findFirst.mockReset()
  findFirst.mockResolvedValue(undefined)
  config = await loadConfig()
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("providers (L2-AUTH-05, L2-AUTH-33, L2-AUTH-34)", () => {
  it("credentials only when Google is unconfigured", async () => {
    const ids = providerIds(await loadConfig())
    expect(ids).toContain("credentials")
    expect(ids).not.toContain("google")
  })

  it("both when Google is configured", async () => {
    const ids = providerIds(
      await loadConfig({ AUTH_GOOGLE_ID: "id", AUTH_GOOGLE_SECRET: "secret" })
    )
    expect(ids).toEqual(expect.arrayContaining(["google", "credentials"]))
  })

  it("Google-only when credentials are disabled AND Google is configured", async () => {
    const ids = providerIds(
      await loadConfig({
        AUTH_GOOGLE_ID: "id",
        AUTH_GOOGLE_SECRET: "secret",
        AUTH_CREDENTIALS_ENABLED: "false",
      })
    )
    expect(ids).toContain("google")
    expect(ids).not.toContain("credentials")
  })

  it("keeps credentials when disabled without Google (no lockout)", async () => {
    const ids = providerIds(
      await loadConfig({ AUTH_CREDENTIALS_ENABLED: "false" })
    )
    expect(ids).toContain("credentials")
  })

  it("uses a JWT session so revocation runs per request", () => {
    expect(config.session?.strategy).toBe("jwt")
  })
})

describe("signIn callback (L2-AUTH-10, L2-AUTH-11, L2-AUTH-14)", () => {
  const signIn = (
    args: Partial<{ account: unknown; user: unknown; profile: unknown }>
  ) => config.callbacks!.signIn!(args as unknown as SignInArgs)

  it("denies Google sign-in for an unknown email", async () => {
    findFirst.mockResolvedValue(undefined)
    await expect(
      signIn({
        account: { provider: "google" },
        user: { email: "stranger@example.com" },
        profile: { email_verified: true },
      })
    ).resolves.toBe(false)
    expect(findFirst).toHaveBeenCalledTimes(1)
  })

  it("allows Google sign-in for a pre-registered, verified email", async () => {
    findFirst.mockResolvedValue(USER_ROW)
    await expect(
      signIn({
        account: { provider: "google" },
        user: { email: USER_ROW.email },
        profile: { email_verified: true },
      })
    ).resolves.toBe(true)
  })

  it("denies Google sign-in when the email is not verified", async () => {
    findFirst.mockResolvedValue(USER_ROW)
    await expect(
      signIn({
        account: { provider: "google" },
        user: { email: USER_ROW.email },
        profile: { email: USER_ROW.email, email_verified: false },
      })
    ).resolves.toBe(false)
    expect(findFirst).not.toHaveBeenCalled()
  })

  it("falls back to the profile email when the user has none", async () => {
    findFirst.mockResolvedValue(USER_ROW)
    await expect(
      signIn({
        account: { provider: "google" },
        user: {},
        profile: { email: USER_ROW.email, email_verified: true },
      })
    ).resolves.toBe(true)
    expect(findFirst).toHaveBeenCalledTimes(1)
  })

  it("denies Google sign-in with no email at all", async () => {
    await expect(
      signIn({
        account: { provider: "google" },
        user: {},
        profile: { email_verified: true },
      })
    ).resolves.toBe(false)
    expect(findFirst).not.toHaveBeenCalled()
  })

  it("passes through non-Google providers without a lookup", async () => {
    for (const account of [{ provider: "credentials" }, null, undefined]) {
      await expect(
        signIn({ account, user: { email: USER_ROW.email } })
      ).resolves.toBe(true)
    }
    expect(findFirst).not.toHaveBeenCalled()
  })
})

describe("credentials authorize (L2-AUTH-09)", () => {
  const authorize = () => credentialsAuthorize(config)

  it("returns the session user for a correct password", async () => {
    findFirst.mockResolvedValue(USER_ROW)
    await expect(
      authorize()({ email: USER_ROW.email, password: PASSWORD })
    ).resolves.toEqual({
      id: USER_ROW.id,
      email: USER_ROW.email,
      name: USER_ROW.name,
      image: USER_ROW.image,
      role: USER_ROW.role,
      tokenVersion: USER_ROW.tokenVersion,
    })
  })

  it("never leaks the password hash into the session user", async () => {
    findFirst.mockResolvedValue(USER_ROW)
    const user = (await authorize()({
      email: USER_ROW.email,
      password: PASSWORD,
    })) as Record<string, unknown>
    expect(Object.keys(user)).not.toContain("passwordHash")
  })

  it("rejects a wrong password", async () => {
    findFirst.mockResolvedValue(USER_ROW)
    await expect(
      authorize()({ email: USER_ROW.email, password: "wrong" })
    ).resolves.toBeNull()
  })

  it("compares with bcrypt, never plaintext", async () => {
    findFirst.mockResolvedValue({ ...USER_ROW, passwordHash: PASSWORD })
    await expect(
      authorize()({ email: USER_ROW.email, password: PASSWORD })
    ).resolves.toBeNull()
  })

  it("rejects a user without a password hash (Google-only account)", async () => {
    for (const passwordHash of [null, undefined, ""]) {
      findFirst.mockResolvedValue({ ...USER_ROW, passwordHash })
      await expect(
        authorize()({ email: USER_ROW.email, password: PASSWORD })
      ).resolves.toBeNull()
    }
  })

  it("rejects an unknown email", async () => {
    findFirst.mockResolvedValue(undefined)
    await expect(
      authorize()({ email: "nobody@example.com", password: PASSWORD })
    ).resolves.toBeNull()
  })

  it("rejects blank input without touching the database", async () => {
    for (const creds of [
      {},
      { email: USER_ROW.email },
      { password: PASSWORD },
      { email: "", password: "" },
      { email: 1, password: 2 },
    ]) {
      await expect(authorize()(creds)).resolves.toBeNull()
    }
    expect(findFirst).not.toHaveBeenCalled()
  })
})

describe("jwt callback — session revocation (L2-AUTH-36)", () => {
  const jwt = (args: Partial<{ token: unknown; user: unknown }>) =>
    config.callbacks!.jwt!(args as unknown as JwtArgs)

  it("stamps identity and tokenVersion at sign-in without a DB read", async () => {
    const token = await jwt({ token: {}, user: USER_ROW })
    expect(token).toMatchObject({
      id: USER_ROW.id,
      role: USER_ROW.role,
      tokenVersion: USER_ROW.tokenVersion,
      invalid: false,
    })
    expect(findFirst).not.toHaveBeenCalled()
  })

  it("defaults a missing tokenVersion to 0 at sign-in", async () => {
    const token = await jwt({
      token: {},
      user: { ...USER_ROW, tokenVersion: undefined },
    })
    expect(token?.tokenVersion).toBe(0)
  })

  it("revalidates against the DB on every later request", async () => {
    findFirst.mockResolvedValue({ role: "owner", tokenVersion: 3 })
    const token = await jwt({ token: { id: USER_ROW.id, tokenVersion: 3 } })
    expect(findFirst).toHaveBeenCalledTimes(1)
    expect(token?.invalid).toBeFalsy()
  })

  it("refreshes the role from the DB", async () => {
    findFirst.mockResolvedValue({ role: "teammate", tokenVersion: 3 })
    const token = await jwt({
      token: { id: USER_ROW.id, role: "owner", tokenVersion: 3 },
    })
    expect(token?.role).toBe("teammate")
  })

  it("invalidates the token when tokenVersion no longer matches", async () => {
    findFirst.mockResolvedValue({ role: "owner", tokenVersion: 4 })
    const token = await jwt({
      token: { id: USER_ROW.id, role: "owner", tokenVersion: 3 },
    })
    expect(token?.invalid).toBe(true)
    expect(token?.role).toBe("owner")
  })

  it("invalidates the token when the user row is gone", async () => {
    findFirst.mockResolvedValue(undefined)
    const token = await jwt({ token: { id: USER_ROW.id, tokenVersion: 3 } })
    expect(token?.invalid).toBe(true)
  })

  it("treats a missing tokenVersion on either side as 0", async () => {
    findFirst.mockResolvedValue({ role: "owner", tokenVersion: null })
    const matching = await jwt({ token: { id: USER_ROW.id } })
    expect(matching?.invalid).toBeFalsy()

    findFirst.mockResolvedValue({ role: "owner", tokenVersion: 1 })
    const stale = await jwt({ token: { id: USER_ROW.id } })
    expect(stale?.invalid).toBe(true)
  })

  it("leaves an anonymous token alone", async () => {
    const token = await jwt({ token: {} })
    expect(token).toEqual({})
    expect(findFirst).not.toHaveBeenCalled()
  })
})

describe("session callback (L2-AUTH-36)", () => {
  const sessionCb = (args: Partial<{ session: unknown; token: unknown }>) =>
    config.callbacks!.session!(args as unknown as SessionArgs)

  it("drops user when the token was invalidated", async () => {
    const result = await sessionCb({
      session: { user: { id: USER_ROW.id, email: USER_ROW.email } },
      token: { id: USER_ROW.id, role: "owner", invalid: true },
    })
    expect(result.user).toBeUndefined()
  })

  it("projects id and role onto a valid session", async () => {
    const result = await sessionCb({
      session: { user: { email: USER_ROW.email } },
      token: { id: USER_ROW.id, role: "admin", invalid: false },
    })
    expect(result.user).toMatchObject({ id: USER_ROW.id, role: "admin" })
  })
})
