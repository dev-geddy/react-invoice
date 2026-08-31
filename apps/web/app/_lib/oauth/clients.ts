import { db, generateToken, oauthClients } from "@workspace/db"
import bcrypt from "bcryptjs"
import { desc, eq } from "drizzle-orm"

import {
  getConnectorSettings,
  isHostAllowed,
  isLoopbackHost,
} from "./connector-config"
import {
  MCP_SCOPES,
  type ClientAuthMethod,
  type McpScope,
  type OAuthFailure,
} from "./types"

/**
 * The OAuth client registry.
 *
 * Two kinds of client live here (`oauth_client.origin`):
 * - `manual` — created by an owner in the settings UI. The default path: the
 *   owner pastes the id (and, for web clients, the secret) into Claude's
 *   *Add custom connector → Advanced settings*.
 * - `dynamic` — RFC 7591 self-registration, only when an owner has switched
 *   `dcrMode` on (`L2-MCP-47`). Always public, no secret.
 *
 * Every redirect URI, whichever kind registered it, must sit on the owner's
 * host allowlist (`L2-MCP-49`) — enforced here at creation and again at
 * authorize time against the live list.
 *
 * @spec L2-MCP-12, L2-MCP-21, L2-MCP-31, L2-MCP-49, L2-MCP-50, L2-MCP-51,
 *       L2-MCP-52
 */

export type OAuthClientRecord = typeof oauthClients.$inferSelect

/** The only grant types this authorization server implements. */
const SUPPORTED_GRANT_TYPES = ["authorization_code", "refresh_token"] as const

/** Generous but bounded, so a registration can't be used to store blobs. */
const MAX_REDIRECT_URI_LENGTH = 2048

/** Bounds on a manually created client's metadata. */
const MAX_CLIENT_NAME_LENGTH = 200
const MAX_REDIRECT_URIS = 10

/** Same cost factor as password hashing (`_lib/auth`) — this is a credential. */
const BCRYPT_COST = 12

/**
 * Whether a redirect URI is acceptable to register or to be redirected to.
 * Requires an absolute `https` URL — or `http` on `localhost`/`127.0.0.1`, the
 * only case where plaintext is safe because the request never leaves the host.
 * A fragment is rejected outright: the authorization response appends its own
 * query and a fragment would let a client smuggle one past the exact match.
 */
export function isValidRedirectUri(uri: string): boolean {
  if (typeof uri !== "string") return false
  const value = uri.trim()
  if (!value || value.length > MAX_REDIRECT_URI_LENGTH) return false
  // A bare trailing "#" parses to an empty `hash`; reject on the raw string too.
  if (value.includes("#")) return false

  let url: URL
  try {
    url = new URL(value)
  } catch {
    return false
  }

  // Embedded credentials would end up in logs and referrers.
  if (url.username || url.password) return false
  if (url.protocol === "https:") return true
  if (url.protocol === "http:") return isLoopbackHost(url.hostname)
  return false
}

/**
 * The host of a redirect URI, for the allowlist check. `null` when the value
 * isn't a parseable absolute URL — callers treat that as "not allowed".
 */
export function redirectUriHost(uri: string): string | null {
  try {
    return new URL(uri).hostname.toLowerCase()
  } catch {
    return null
  }
}

/**
 * Parsed loopback redirect URI, or `null` if it is not one. Used only by the
 * port-agnostic comparison below, so the loopback test is deliberately narrow:
 * plain `http` on exactly `localhost` / `127.0.0.1`. `[::1]`, `127.0.0.2` and
 * `localhost.evil.example` are NOT loopback here — treating them as such would
 * relax matching for hosts an attacker can influence.
 */
function parseLoopbackUri(
  uri: string
): { hostname: string; pathname: string; search: string } | null {
  let url: URL
  try {
    url = new URL(uri)
  } catch {
    return null
  }
  if (url.protocol !== "http:") return null
  if (url.username || url.password || url.hash) return null
  if (!isLoopbackHost(url.hostname)) return null
  return {
    hostname: url.hostname.toLowerCase(),
    pathname: url.pathname,
    search: url.search,
  }
}

/**
 * Whether `redirectUri` may be redirected to for this client.
 *
 * Default: exact, full-string match against the registered set. No prefix, no
 * wildcard, no normalization — anything looser is the classic open-redirect /
 * token-theft hole (`L2-MCP-31`).
 *
 * One relaxation, per client and off by default: with `allowLoopbackPorts` a
 * loopback URI matches port-agnostically (`L2-MCP-51`) — scheme, host, path and
 * query must still be identical, only the port is ignored. Native clients
 * (Claude Code) listen on an ephemeral port chosen at run time, so exact
 * matching cannot work for them. Both sides must be loopback: an `https` URI
 * never takes this path.
 */
export function redirectUriAllowed(
  client: OAuthClientRecord,
  redirectUri: string
): boolean {
  if (!redirectUri) return false
  if (client.redirectUris.some((registered) => registered === redirectUri)) {
    return true
  }
  if (!client.allowLoopbackPorts) return false

  const candidate = parseLoopbackUri(redirectUri)
  if (!candidate) return false

  return client.redirectUris.some((registered) => {
    const known = parseLoopbackUri(registered)
    if (!known) return false
    return (
      known.hostname === candidate.hostname &&
      known.pathname === candidate.pathname &&
      known.search === candidate.search
    )
  })
}

/**
 * Register a public client (RFC 7591). The caller (the DCR route) has already
 * validated the metadata *and* enforced the host allowlist for the current
 * `dcrMode`; this narrows it again to what the server actually supports:
 * unknown grant types are dropped, and the auth method is pinned to `"none"`
 * regardless of what was asked for.
 *
 * Dynamic clients never get a secret: the OAuth 2.1 / MCP profile registers
 * Claude as a public client proving possession with PKCE (`L2-MCP-26`), and
 * requiring a secret would break DCR outright. They also never get
 * `allowLoopbackPorts` — that relaxation is an owner's explicit decision.
 */
export async function registerClient(input: {
  clientName: string
  redirectUris: string[]
  grantTypes?: string[]
  scopes?: McpScope[]
  tokenEndpointAuthMethod?: string
}): Promise<OAuthClientRecord> {
  const grantTypes = SUPPORTED_GRANT_TYPES.filter((grant) =>
    (input.grantTypes ?? SUPPORTED_GRANT_TYPES).includes(grant)
  )

  const [row] = await db
    .insert(oauthClients)
    .values({
      clientId: generateToken(),
      clientSecretHash: null,
      clientName: input.clientName,
      origin: "dynamic",
      createdByUserId: null,
      allowLoopbackPorts: false,
      redirectUris: input.redirectUris,
      grantTypes: grantTypes.length ? grantTypes : [...SUPPORTED_GRANT_TYPES],
      scopes: input.scopes?.length ? input.scopes : [...MCP_SCOPES],
      tokenEndpointAuthMethod: "none",
    })
    .returning()

  if (!row) throw new Error("Client registration returned no row")
  return row
}

/**
 * Create a client by hand, from the owner's settings tab (`L2-MCP-50`).
 *
 * Secret policy (`L2-MCP-52`):
 * - `allowLoopbackPorts: false` (a web client such as claude.ai) → a secret is
 *   ALWAYS generated. There is no opt-out: the credential lives on the client's
 *   server, so it is a real control.
 * - `allowLoopbackPorts: true` (a native client such as Claude Code) → NO
 *   secret. Per RFC 8252 §8.5 a native app ships on the user's machine and
 *   cannot keep one; issuing a secret there is false assurance, not a control.
 *   PKCE alone protects it, as it does for every public client.
 *
 * The raw secret is returned exactly once and never stored — only its bcrypt
 * hash goes to the database, at the same cost factor as user passwords.
 *
 * Throws on invalid input: a missing name, a redirect URI that isn't a valid
 * absolute URI, or one whose host is not on the live allowlist (`L2-MCP-49`).
 */
export async function createManualClient(input: {
  clientName: string
  redirectUris: string[]
  allowLoopbackPorts?: boolean
  createdByUserId: string
}): Promise<{ client: OAuthClientRecord; clientSecret: string | null }> {
  const clientName = input.clientName?.trim() ?? ""
  if (!clientName) throw new Error("A client name is required.")
  if (clientName.length > MAX_CLIENT_NAME_LENGTH) {
    throw new Error("The client name is too long.")
  }

  const uris = Array.isArray(input.redirectUris) ? input.redirectUris : []
  if (uris.length === 0)
    throw new Error("At least one redirect URI is required.")
  if (uris.length > MAX_REDIRECT_URIS) {
    throw new Error(`At most ${MAX_REDIRECT_URIS} redirect URIs are allowed.`)
  }

  const settings = await getConnectorSettings()
  const redirectUris: string[] = []
  for (const raw of uris) {
    const uri = typeof raw === "string" ? raw.trim() : ""
    if (!uri) continue
    if (!isValidRedirectUri(uri)) {
      throw new Error(
        `Not a valid redirect URI: ${uri.slice(0, 100)} — it must be an absolute https URL (or http on localhost) with no fragment.`
      )
    }
    const host = redirectUriHost(uri)
    if (!host || !isHostAllowed(host, settings.redirectHosts)) {
      throw new Error(
        `The host ${host ?? uri.slice(0, 100)} is not on the redirect-host allowlist.`
      )
    }
    if (!redirectUris.includes(uri)) redirectUris.push(uri)
  }
  if (redirectUris.length === 0) {
    throw new Error("At least one redirect URI is required.")
  }

  const allowLoopbackPorts = input.allowLoopbackPorts === true
  const clientSecret = allowLoopbackPorts ? null : generateToken()
  const clientSecretHash = clientSecret
    ? await bcrypt.hash(clientSecret, BCRYPT_COST)
    : null

  const [row] = await db
    .insert(oauthClients)
    .values({
      clientId: generateToken(),
      clientSecretHash,
      clientName,
      origin: "manual",
      createdByUserId: input.createdByUserId,
      allowLoopbackPorts,
      redirectUris,
      grantTypes: [...SUPPORTED_GRANT_TYPES],
      scopes: [...MCP_SCOPES],
      tokenEndpointAuthMethod: clientSecretHash ? "client_secret_post" : "none",
    })
    .returning()

  if (!row) throw new Error("Client creation returned no row")
  return { client: row, clientSecret }
}

/**
 * Every registered client, newest first — the settings tab's list.
 *
 * The rows carry `clientSecretHash`. Never render it or hand it to a client
 * component: it is a credential digest, and nothing in the UI needs more than
 * `isConfidentialClient()` (`L2-MCP-35`).
 */
export async function listClients(): Promise<OAuthClientRecord[]> {
  return db.select().from(oauthClients).orderBy(desc(oauthClients.createdAt))
}

/**
 * Whether this client authenticates with a secret at the token endpoint — the
 * safe thing for the settings UI to show instead of the hash itself.
 */
export function isConfidentialClient(client: OAuthClientRecord): boolean {
  return client.clientSecretHash !== null
}

/**
 * Delete a client by its row id. Codes, tokens and grants cascade with it
 * (`oauth_auth_code` / `oauth_token` reference it `on delete cascade`), so
 * deletion is also the hard disconnect for everyone who authorized it.
 */
export async function deleteClient(clientDbId: string): Promise<void> {
  if (!clientDbId) return
  await db.delete(oauthClients).where(eq(oauthClients.id, clientDbId))
}

/**
 * A real bcrypt hash to compare against when there is nothing to verify — an
 * unknown `client_id` or a public client. Without it, "no such client" would
 * answer in microseconds while "wrong secret" takes ~250 ms, which is a
 * client-existence oracle for an unauthenticated caller (`L2-MCP-41`).
 * Computed once, lazily, so importing this module stays cheap.
 */
let dummyHashCache: string | undefined
function dummyClientSecretHash(): string {
  return (dummyHashCache ??= bcrypt.hashSync(
    "no-such-client-timing-equalizer",
    BCRYPT_COST
  ))
}

/**
 * Verify a presented `client_secret` against a client's stored bcrypt hash.
 * Constant-time in bcrypt's own comparison, and constant-*work*: a public
 * client (no hash) still runs one comparison before returning false.
 */
export async function verifyClientSecret(
  client: OAuthClientRecord,
  secret: string
): Promise<boolean> {
  const stored = client.clientSecretHash
  const ok = await bcrypt.compare(
    secret ?? "",
    stored ?? dummyClientSecretHash()
  )
  return stored !== null && ok
}

/**
 * Burn the same bcrypt comparison when no client row was found, so an unknown
 * `client_id` costs what a wrong secret costs. Result is deliberately ignored.
 */
export async function equalizeClientAuthTiming(secret: string): Promise<void> {
  await bcrypt.compare(secret ?? "", dummyClientSecretHash())
}

/** How a token request presented itself. `secret === null` = public client. */
export type ClientAuthentication =
  | {
      ok: true
      clientId: string
      secret: string | null
      method: ClientAuthMethod
    }
  | { ok: false; failure: OAuthFailure }

/**
 * Decode one HTTP Basic credential pair per RFC 6749 §2.3.1: both halves are
 * form-urlencoded before base64, so they are URL-decoded here. A value that
 * isn't valid percent-encoding is taken literally rather than rejected — real
 * clients differ on whether they encode at all, and our own secrets are
 * base64url, which both readings decode identically.
 */
function decodeBasicField(value: string): string {
  try {
    return decodeURIComponent(value.replace(/\+/g, " "))
  } catch {
    return value
  }
}

/**
 * Read the client's identity and (optional) secret off a token request,
 * accepting `client_secret_post` (form fields) and `client_secret_basic`
 * (Authorization header) — `L2-MCP-52`.
 *
 * Pure — no db, no bcrypt. Presenting two methods at once is rejected
 * (RFC 6749 §2.3, OAuth 2.1 §3.2.1); so is a Basic `client_id` that disagrees
 * with the body's. Whether the client is actually *allowed* to present a secret
 * is decided later, against the stored record.
 */
export function parseClientAuthentication(input: {
  authorizationHeader: string | null
  form: URLSearchParams
}): ClientAuthentication {
  const formClientId = input.form.get("client_id")?.trim() ?? ""
  const formSecret = input.form.get("client_secret") ?? ""
  const header = input.authorizationHeader?.trim() ?? ""

  let basic: { clientId: string; secret: string } | null = null
  if (header) {
    const [scheme, ...rest] = header.split(/\s+/)
    if (scheme?.toLowerCase() !== "basic") {
      return {
        ok: false,
        failure: {
          error: "invalid_client",
          description: "Unsupported client authentication method.",
        },
      }
    }
    let decoded: string
    try {
      decoded = Buffer.from(rest.join(""), "base64").toString("utf8")
    } catch {
      decoded = ""
    }
    const separator = decoded.indexOf(":")
    if (separator < 0) {
      return {
        ok: false,
        failure: {
          error: "invalid_client",
          description: "Malformed Basic credentials.",
        },
      }
    }
    basic = {
      clientId: decodeBasicField(decoded.slice(0, separator)).trim(),
      secret: decodeBasicField(decoded.slice(separator + 1)),
    }
    if (!basic.clientId || !basic.secret) {
      return {
        ok: false,
        failure: {
          error: "invalid_client",
          description: "Malformed Basic credentials.",
        },
      }
    }
  }

  if (basic && formSecret) {
    return {
      ok: false,
      failure: {
        error: "invalid_request",
        description: "Use only one client authentication method.",
      },
    }
  }
  if (basic && formClientId && formClientId !== basic.clientId) {
    return {
      ok: false,
      failure: {
        error: "invalid_client",
        description: "Client authentication failed.",
      },
    }
  }

  const clientId = basic?.clientId ?? formClientId
  if (!clientId) {
    return {
      ok: false,
      failure: { error: "invalid_client", description: "Missing client_id." },
    }
  }

  if (basic) {
    return {
      ok: true,
      clientId,
      secret: basic.secret,
      method: "client_secret_basic",
    }
  }
  if (formSecret) {
    return {
      ok: true,
      clientId,
      secret: formSecret,
      method: "client_secret_post",
    }
  }
  return { ok: true, clientId, secret: null, method: "none" }
}

/** Look up a client by its public `client_id`. Unknown id → null, never throws. */
export async function findClientByClientId(
  clientId: string
): Promise<OAuthClientRecord | null> {
  if (!clientId) return null
  const [row] = await db
    .select()
    .from(oauthClients)
    .where(eq(oauthClients.clientId, clientId))
  return row ?? null
}

/**
 * Best-effort `lastUsedAt` stamp, for the account UI's "last used" column.
 * Never throws: telemetry must not fail a token exchange or a tool call.
 */
export async function touchClient(clientDbId: string): Promise<void> {
  try {
    await db
      .update(oauthClients)
      .set({ lastUsedAt: new Date() })
      .where(eq(oauthClients.id, clientDbId))
  } catch {
    // Ignored on purpose.
  }
}
