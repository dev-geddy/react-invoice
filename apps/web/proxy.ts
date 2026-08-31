import { getToken } from "next-auth/jwt"
import { NextResponse, type NextRequest } from "next/server"

/**
 * Admin auth boundary for the /backflip scope. Runs as a Next.js proxy
 * (the renamed `middleware` convention, Next 16+), on the edge runtime.
 *
 * Edge-safe: reads the Auth.js JWT via `getToken` (no db / node deps here).
 * - Unauthenticated request to a protected /backflip path → redirect to login
 *   with the original path in `from`.
 * - Login + recovery routes are public (the "already signed-in → dashboard"
 *   redirect is validity-aware, so it lives on the login page, not here).
 *
 * @spec L2-AUTH-01
 */

const LOGIN_PATH = "/backflip/login"

/**
 * Public auth routes within `/backflip` — reachable without a session. The
 * password-recovery routes must work logged-out (emailed links); the login
 * page always renders (it redirects already-signed-in users to the dashboard
 * itself, via `auth()` — the edge can't validate the JWT's token version
 * without a DB, so that decision lives node-side, not here).
 */
const PUBLIC_PATHS = new Set([
  LOGIN_PATH,
  "/backflip/forgot-password",
  "/backflip/reset-password",
])

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (PUBLIC_PATHS.has(pathname)) {
    return NextResponse.next()
  }

  // Behind a TLS-terminating proxy the edge request itself is plain http, so
  // getToken would look for the non-secure cookie name while Auth.js (which
  // trusts AUTH_URL) set `__Secure-authjs.session-token` — every session would
  // read as null and login would redirect-loop. Derive the secure-cookie hint
  // from AUTH_URL, not from the request protocol.
  const token = await getToken({
    req: request,
    secret: process.env.AUTH_SECRET,
    secureCookie: (process.env.AUTH_URL ?? "").startsWith("https://"),
  })

  if (!token) {
    const loginUrl = new URL(LOGIN_PATH, request.url)
    // Carry the query string, not just the path: /backflip/connect holds the
    // entire OAuth authorize request in its params and renders a fatal error
    // without them, so a logged-out connector handshake would dead-end
    // (`L2-MCP-42`). The login page still constrains `from` to /backflip/*,
    // so this cannot become an open redirect.
    loginUrl.searchParams.set("from", `${pathname}${request.nextUrl.search}`)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/backflip/:path*"],
}
