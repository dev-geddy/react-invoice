/**
 * Auth-mode flags derived from environment. Server-only (reads non-public env);
 * import from server components / actions / the Auth.js config, never a client
 * component. Pass the resolved booleans to client UI as props instead.
 *
 * @spec L2-AUTH-33
 */

/** Google OAuth is usable when both client id and secret are present. */
export function isGoogleConfigured(): boolean {
  return Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET)
}

/**
 * Whether email + password (Credentials) login is enabled.
 *
 * Set `AUTH_CREDENTIALS_ENABLED=false` to run Google-only. As a safety net this
 * only takes effect when Google is actually configured — otherwise credentials
 * stay on so a misconfigured deployment can never lock everyone out.
 */
export function isCredentialsEnabled(): boolean {
  const explicitlyDisabled = process.env.AUTH_CREDENTIALS_ENABLED === "false"
  return !(explicitlyDisabled && isGoogleConfigured())
}
