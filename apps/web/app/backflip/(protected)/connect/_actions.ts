"use server"

import { revalidatePath } from "next/cache"
import { notFound, redirect } from "next/navigation"

import { requireCapability } from "@/app/_lib/auth/guard"
import { validateAuthorizationRequest } from "@/app/_lib/oauth/authorize"
import { findClientByClientId } from "@/app/_lib/oauth/clients"
import { createAuthorizationCode } from "@/app/_lib/oauth/codes"
import { isMcpEnabled } from "@/app/_lib/oauth/config"
import { grantableScopes } from "@/app/_lib/oauth/scopes"
import { revokeGrant } from "@/app/_lib/oauth/tokens"

/**
 * Server actions behind the OAuth consent screen (`/backflip/connect`) and the
 * account page's connected-clients list. Every action re-checks the session
 * and re-validates from the raw authorize query params (carried through the
 * consent form as hidden fields) — the form fields are only the transport,
 * never trusted directly for anything security-relevant.
 *
 * @spec L2-MCP-13, L2-MCP-14, L2-MCP-17, L2-MCP-25, L2-MCP-26, L2-MCP-31,
 *       L2-MCP-37, L2-MCP-38
 */

/**
 * The kill switch, re-asserted per action. A server action is invocable
 * directly by POSTing its action id — it does NOT inherit the consent page's
 * `isMcpEnabled()` guard, so without this a connector that was disabled after
 * clients had registered could still be handed a fresh authorization code
 * (`L2-MCP-37`). `isMcpEnabled()` is DB-backed (short-TTL cached) and async
 * now that enablement is an owner toggle rather than a static env read
 * (`L2-MCP-25`) — this must still run, and 404, before any session or DB
 * work in every caller below, which is the security property under test in
 * `_actions.test.ts`.
 */
async function requireConnectorEnabled(): Promise<void> {
  if (!(await isMcpEnabled())) notFound()
}

/** Raw `/api/oauth/authorize` query keys carried through the consent form. */
const AUTHORIZE_PARAM_KEYS = [
  "response_type",
  "client_id",
  "redirect_uri",
  "code_challenge",
  "code_challenge_method",
  "state",
  "scope",
  "resource",
] as const

function paramsFromForm(formData: FormData): URLSearchParams {
  const usp = new URLSearchParams()
  for (const key of AUTHORIZE_PARAM_KEYS) {
    const value = formData.get(key)
    if (typeof value === "string" && value) usp.set(key, value)
  }
  return usp
}

/**
 * Approve the authorization request. Re-validates the params from scratch,
 * mints a code scoped to `requested ∩ grantableScopes(role)`, and redirects
 * back to the client's redirect URI with `code` (+ `state` when present).
 *
 * If re-validation now fails fatally (e.g. the client was deleted between
 * render and submit), we bounce back to `/backflip/connect` — never to a
 * client-supplied URI we haven't just validated (`L2-MCP-31`).
 */
export async function approveAuthorization(formData: FormData): Promise<void> {
  await requireConnectorEnabled()
  const sessionUser = await requireCapability("account")
  const usp = paramsFromForm(formData)
  const result = await validateAuthorizationRequest(usp)

  if (!result.ok) {
    if (result.fatal) redirect(`/backflip/connect?${usp.toString()}`)

    const url = new URL(result.redirectUri)
    url.searchParams.set("error", result.failure.error)
    if (result.failure.description) {
      url.searchParams.set("error_description", result.failure.description)
    }
    if (result.state) url.searchParams.set("state", result.state)
    redirect(url.toString())
  }

  const { request, clientDbId } = result
  const granted = grantableScopes(sessionUser.role ?? "teammate")
  const scopes = request.scopes.filter((s) => granted.includes(s))

  // Nothing left to grant (role changed since render, or a stale form) — deny
  // rather than mint an empty-scope code.
  if (scopes.length === 0) {
    const url = new URL(request.redirectUri)
    url.searchParams.set("error", "access_denied")
    url.searchParams.set(
      "error_description",
      "Your role doesn't grant any of the requested access."
    )
    if (request.state) url.searchParams.set("state", request.state)
    redirect(url.toString())
  }

  const code = await createAuthorizationCode({
    clientDbId,
    userId: sessionUser.id,
    redirectUri: request.redirectUri,
    scopes,
    resource: request.resource,
    codeChallenge: request.codeChallenge,
    codeChallengeMethod: request.codeChallengeMethod,
  })

  const url = new URL(request.redirectUri)
  url.searchParams.set("code", code)
  if (request.state) url.searchParams.set("state", request.state)
  redirect(url.toString())
}

/**
 * Deny the authorization request. Re-validates (so we still never redirect to
 * an unregistered URI) then redirects back with `error=access_denied`.
 */
export async function denyAuthorization(formData: FormData): Promise<void> {
  await requireConnectorEnabled()
  await requireCapability("account")
  const usp = paramsFromForm(formData)
  const result = await validateAuthorizationRequest(usp)

  if (!result.ok) {
    if (result.fatal) redirect(`/backflip/connect?${usp.toString()}`)

    const url = new URL(result.redirectUri)
    url.searchParams.set("error", "access_denied")
    if (result.state) url.searchParams.set("state", result.state)
    redirect(url.toString())
  }

  const url = new URL(result.request.redirectUri)
  url.searchParams.set("error", "access_denied")
  if (result.request.state) url.searchParams.set("state", result.request.state)
  redirect(url.toString())
}

/**
 * Disconnect a connected client from the signed-in user's account
 * (`/backflip/account`, `L2-MCP-17`). The form only carries the client's
 * public `clientId` (already shown in the UI); the DB id used to scope the
 * revoke is re-resolved server-side, and the revoke itself is always scoped to
 * `session.user.id` — never a client-supplied user id (`L2-AUTH-27`).
 */
export async function disconnectConnection(formData: FormData): Promise<void> {
  await requireConnectorEnabled()
  const sessionUser = await requireCapability("account")
  const clientId = String(formData.get("clientId") ?? "")
  if (!clientId) return

  const client = await findClientByClientId(clientId)
  if (!client) return

  await revokeGrant({ userId: sessionUser.id, clientDbId: client.id })
  revalidatePath("/backflip/account")
}
