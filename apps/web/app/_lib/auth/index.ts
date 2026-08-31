import { DrizzleAdapter } from "@auth/drizzle-adapter"
import {
  accounts,
  db,
  sessions,
  users,
  verificationTokens,
} from "@workspace/db"
import bcrypt from "bcryptjs"
import { eq } from "drizzle-orm"
import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import Google from "next-auth/providers/google"

import { createRateLimiter } from "@/app/_lib/rate-limit"
import { isCredentialsEnabled, isGoogleConfigured } from "./config"
import "./types"

/**
 * Failed-login throttle. Keyed on client IP + normalized email; only failures
 * count and a success clears the key. Blocked attempts return the same generic
 * `null` as a bad password (no lockout signal, no enumeration). In-process only
 * (see `rate-limit.ts`) — one pm2 process / container per instance.
 */
const LOGIN_MAX_ATTEMPTS = 10
const LOGIN_WINDOW_MS = 15 * 60_000
const loginRateLimiter = createRateLimiter({
  max: LOGIN_MAX_ATTEMPTS,
  windowMs: LOGIN_WINDOW_MS,
})

/**
 * A real (cost-12) bcrypt hash compared against when the account doesn't exist
 * or has no password, so login response time doesn't reveal whether an email is
 * registered (timing-based user enumeration). Computed once, lazily, on the
 * first login attempt (keeps it off module-load / test-import paths).
 */
let dummyHashCache: string | undefined
function dummyPasswordHash(): string {
  return (dummyHashCache ??= bcrypt.hashSync(
    "no-such-account-timing-equalizer",
    12
  ))
}

/**
 * Best-effort client IP from the proxy's forwarded headers (edge sets these).
 * The LAST `x-forwarded-for` hop is the one our own proxy appended; earlier
 * hops are caller-supplied, so keying the throttle on them would let a
 * credential-stuffer rotate the header and never hit the cap.
 */
function clientIp(request?: Request): string {
  const fwd = request?.headers?.get?.("x-forwarded-for")
  if (fwd) {
    const hops = fwd.split(",")
    const last = hops[hops.length - 1]!.trim()
    if (last) return last
  }
  return request?.headers?.get?.("x-real-ip")?.trim() || "unknown"
}

/** Normalize an email for lookup/compare — matches how every write path stores it. */
function normalizeEmail(value: string): string {
  return value.trim().toLowerCase()
}

/**
 * Auth.js (v5) config. Two providers:
 * - Credentials — email + password against `user.passwordHash` (bcrypt).
 * - Google — OAuth, but ONLY for emails already registered on the platform
 *   (enforced in the `signIn` callback). Links to the existing user by email.
 *
 * Session strategy is JWT (required by the Credentials provider). The Drizzle
 * adapter persists OAuth accounts. Runs on the Node runtime (uses `pg`).
 *
 * @spec L2-AUTH-02, L2-AUTH-05, L2-AUTH-09, L2-AUTH-10, L2-AUTH-11, L2-AUTH-36, L2-AUTH-40, L2-AUTH-41, L2-AUTH-43
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  session: { strategy: "jwt" },
  trustHost: true,
  pages: { signIn: "/backflip/login" },
  // Auth.js logs internally-caught errors (e.g. authorize/adapter failures)
  // with a full stack even when the response itself is a normal 200/redirect.
  // Compact that to name + message so dev logs stay readable.
  logger: {
    error: (error) => console.error(`[auth] ${error.name}: ${error.message}`),
    warn: (code) => console.warn(`[auth] ${code}`),
  },
  providers: [
    // Google only when configured; Credentials unless disabled (Google-only mode).
    ...(isGoogleConfigured()
      ? [Google({ allowDangerousEmailAccountLinking: true })]
      : []),
    ...(isCredentialsEnabled()
      ? [
          Credentials({
            credentials: {
              email: { label: "Email", type: "email" },
              password: { label: "Password", type: "password" },
            },
            authorize: async (creds, request) => {
              const rawEmail =
                typeof creds?.email === "string" ? creds.email : ""
              const password =
                typeof creds?.password === "string" ? creds.password : ""
              if (!rawEmail || !password) return null
              const email = normalizeEmail(rawEmail)

              // Throttle brute-force / credential-stuffing per IP+email.
              const rlKey = `${clientIp(request as Request | undefined)}:${email}`
              if (loginRateLimiter.blocked(rlKey)) return null

              const user = await db.query.users.findFirst({
                where: eq(users.email, email),
              })

              // Always run one bcrypt.compare (dummy hash when there's no real
              // one) so an unknown / OAuth-only email can't be distinguished by
              // response time. Enumeration via content is already closed.
              const ok = await bcrypt.compare(
                password,
                user?.passwordHash ?? dummyPasswordHash()
              )
              if (!user?.passwordHash || !ok) {
                loginRateLimiter.hit(rlKey)
                return null
              }

              loginRateLimiter.reset(rlKey)
              return {
                id: user.id,
                email: user.email,
                name: user.name,
                image: user.image,
                role: user.role,
                tokenVersion: user.tokenVersion,
              }
            },
          }),
        ]
      : []),
  ],
  callbacks: {
    // Google: reject unless the OAuth email is verified AND a user with that
    // email already exists. The `email_verified` gate stops an attacker who
    // controls an account asserting an unverified address from linking into a
    // pre-registered user (`allowDangerousEmailAccountLinking` is on).
    signIn: async ({ account, user, profile }) => {
      if (account?.provider !== "google") return true
      if (profile?.email_verified !== true) return false
      const rawEmail = user?.email ?? profile?.email
      if (!rawEmail) return false
      const existing = await db.query.users.findFirst({
        where: eq(users.email, normalizeEmail(rawEmail)),
      })
      return Boolean(existing)
    },
    jwt: async ({ token, user }) => {
      // Sign-in: stamp identity + the current token version into the JWT.
      if (user) {
        token.id = user.id
        token.role = user.role
        token.tokenVersion = user.tokenVersion ?? 0
        token.invalid = false
        return token
      }
      // Subsequent requests: revalidate against the DB so a password/email
      // change (which bumps tokenVersion) forces re-login everywhere.
      if (token.id) {
        const current = await db.query.users.findFirst({
          where: eq(users.id, token.id),
          columns: { role: true, tokenVersion: true },
        })
        if (
          !current ||
          (current.tokenVersion ?? 0) !== (token.tokenVersion ?? 0)
        ) {
          token.invalid = true
        } else {
          token.role = current.role
        }
      }
      return token
    },
    session: async ({ session, token }) => {
      // Revoked/stale JWT → drop identity so guards treat it as unauthenticated.
      if (token.invalid) {
        session.user = undefined as unknown as typeof session.user
        return session
      }
      if (token.id) session.user.id = token.id
      if (token.role) session.user.role = token.role
      return session
    },
  },
})
