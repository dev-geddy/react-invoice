import { connectorConfig, db } from "@workspace/db"
import { eq } from "drizzle-orm"

import { DCR_MODES, type ConnectorSettings, type DcrMode } from "./types"

/**
 * Owner-managed connector settings: the master switch, the dynamic-registration
 * mode and the redirect-host allowlist (`L2-MCP-25`, `L2-MCP-47`, `L2-MCP-48`).
 *
 * The latter two exist because open Dynamic Client Registration hands any
 * anonymous caller a `client_id` with an attacker-chosen `redirect_uri` — a
 * phishing primitive on our own domain, even though no data moves without a
 * human consenting. Default `dcrMode: "off"` removes it; the allowlist bounds
 * where an authorization response may ever land (`L2-MCP-49`).
 *
 * Stored as a single row keyed `kind = "mcp"`, created on first read — there is
 * no seed migration, so a fresh deployment is safe by default rather than
 * unconfigured (`enabled: false`, `dcrMode: "off"`).
 *
 * Two readers: `getConnectorSettings()` always hits the database and is what
 * the admin UI and the registration gate use; `getCachedConnectorSettings()`
 * serves the per-request enabled gate from a short-TTL in-process cache
 * (`L2-MCP-54`).
 *
 * @spec L2-MCP-25, L2-MCP-47, L2-MCP-48, L2-MCP-49, L2-MCP-54
 */

export type { ConnectorSettings, DcrMode } from "./types"

/** The single settings row this module owns. */
const CONFIG_KIND = "mcp"

/** Claude's two callback origins — the only hosts a stock install needs. */
const DEFAULT_REDIRECT_HOSTS = ["claude.ai", "claude.com"] as const

/** Bounds on owner input: a hostname is at most 253 chars (RFC 1035). */
const MAX_HOST_LENGTH = 253
const MAX_REDIRECT_HOSTS = 50

/**
 * Hosts that are always permissible, listed or not (`L2-MCP-49`): a loopback
 * address resolves on the user's own machine, so it cannot be pointed at an
 * attacker remotely. Exact strings only — `127.0.0.2`, `[::1]` and anything
 * merely *containing* "localhost" (`localhost.evil.example`) are ordinary
 * remote hosts and must go through the allowlist like everything else.
 */
const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1"])

/**
 * A hostname label: alphanumeric, inner dashes allowed, 1–63 chars. Applied per
 * dot-separated label, so an empty label or a trailing dot is rejected.
 */
const HOST_LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/

/** Settings used when the row cannot be read — the safest possible posture. */
const DEFAULT_SETTINGS: ConnectorSettings = {
  enabled: false,
  dcrMode: "off",
  redirectHosts: [...DEFAULT_REDIRECT_HOSTS],
}

/**
 * How long a read of the settings row is reused in this process (`L2-MCP-54`).
 * Short on purpose: it only has to make the enabled gate free for a burst of
 * unauthenticated traffic, not to keep the row out of the database.
 */
export const CONNECTOR_SETTINGS_CACHE_TTL_MS = 30_000

/** Whether `value` is one of the three registration modes. */
export function isDcrMode(value: unknown): value is DcrMode {
  return (
    typeof value === "string" &&
    (DCR_MODES as readonly string[]).includes(value)
  )
}

/** Whether `host` is a loopback address (`localhost` / `127.0.0.1`), exactly. */
export function isLoopbackHost(host: string): boolean {
  return LOOPBACK_HOSTS.has(host.trim().toLowerCase())
}

/**
 * Whether a redirect URI's host may be used. Case-insensitive **exact** match
 * against the allowlist — never a suffix or substring match, so `notclaude.ai`
 * and `claude.ai.evil.example` are not `claude.ai`, and a subdomain must be
 * listed in its own right. Loopback is allowed unconditionally (`L2-MCP-49`).
 *
 * Pure: the caller supplies the live allowlist.
 */
export function isHostAllowed(host: string, allowlist: string[]): boolean {
  const normalized = host.trim().toLowerCase()
  if (!normalized) return false
  if (isLoopbackHost(normalized)) return true
  return allowlist.some((entry) => entry.trim().toLowerCase() === normalized)
}

/**
 * Whether an allowlist entry an owner typed is a bare hostname. A scheme, port,
 * path, wildcard, credential or whitespace is rejected rather than silently
 * trimmed: `*.claude.ai` accepted as `claude.ai` would be a wildcard the owner
 * believes they configured, and `claude.ai/x` would match nothing at all.
 */
export function isValidHostEntry(value: string): boolean {
  if (typeof value !== "string") return false
  const host = value.trim().toLowerCase()
  if (!host || host.length > MAX_HOST_LENGTH) return false
  // Cheap explicit rejects before the label check, so the intent is readable.
  if (/[:/?#*@\s\\]/.test(host)) return false
  const labels = host.split(".")
  return labels.every((label) => HOST_LABEL.test(label))
}

/** Map a `connector_config` row onto the settings shape. */
function toSettings(
  row: typeof connectorConfig.$inferSelect
): ConnectorSettings {
  return {
    // Anything but an explicit `true` is off — a column that somehow reads null
    // must not switch the connector on (`L2-MCP-25`).
    enabled: row.enabled === true,
    dcrMode: isDcrMode(row.dcrMode) ? row.dcrMode : "off",
    redirectHosts: [...row.redirectHosts],
  }
}

/** Read the single settings row, if it exists yet. */
async function readRow(): Promise<ConnectorSettings | null> {
  const [row] = await db
    .select()
    .from(connectorConfig)
    .where(eq(connectorConfig.kind, CONFIG_KIND))
    .limit(1)
  return row ? toSettings(row) : null
}

/**
 * Read the connector settings, creating the row with defaults on first use.
 * Never returns null — a caller always has a concrete mode and allowlist to
 * enforce.
 *
 * Throws only if the database is unreachable. Every caller treats that as
 * fail-closed (no registration, no authorization), never as "allow".
 */
export async function getConnectorSettings(): Promise<ConnectorSettings> {
  const existing = await readRow()
  if (existing) return existing

  const [created] = await db
    .insert(connectorConfig)
    .values({ kind: CONFIG_KIND })
    .onConflictDoNothing({ target: connectorConfig.kind })
    .returning()
  if (created) return toSettings(created)

  // Lost the race to a concurrent first read — re-read rather than guess.
  return (await readRow()) ?? { ...DEFAULT_SETTINGS }
}

/** The cached row, and the read that is currently fetching it. */
let cached: { settings: ConnectorSettings; expiresAt: number } | null = null
let inFlight: Promise<ConnectorSettings> | null = null
/** Bumped by every clear, so a read that started earlier can't repopulate. */
let generation = 0

/** Read the row and cache it, unless the cache was cleared while we waited. */
async function loadIntoCache(now: number): Promise<ConnectorSettings> {
  const gen = generation
  const settings = await getConnectorSettings()
  if (gen === generation) {
    cached = { settings, expiresAt: now + CONNECTOR_SETTINGS_CACHE_TTL_MS }
  }
  return settings
}

/**
 * The settings as the per-request enabled gate sees them: from this process's
 * cache when it is fresh, otherwise one database read that concurrent callers
 * share (`L2-MCP-54`). Failures are never cached, so a database blip costs at
 * most one request's worth of staleness rather than a whole TTL of it.
 *
 * **Stale across processes.** The cache is per Node process, like the rate
 * limiter's counters (`L2-AUTH-40`): `saveConnectorSettings` clears it
 * synchronously, so an owner's toggle is instant in the process that served the
 * save, but any *other* process keeps serving its own snapshot for up to
 * `CONNECTOR_SETTINGS_CACHE_TTL_MS`. This app runs one process per instance, so
 * in practice that is the save's own process; a multi-instance deployment would
 * see a toggle take up to the TTL to reach every instance. `MCP_ENABLED=false`
 * is the override that does not wait for any of this — it is read from the
 * environment on every call (`isMcpForcedOff`).
 *
 * `now` is injectable for tests, following `createRateLimiter`.
 */
export async function getCachedConnectorSettings(
  now: number = Date.now()
): Promise<ConnectorSettings> {
  if (cached && now < cached.expiresAt) return cached.settings

  if (!inFlight) {
    const pending = loadIntoCache(now)
    inFlight = pending
    // Free the slot however it settles; the caller below still sees the result.
    void pending
      .catch(() => {})
      .finally(() => {
        if (inFlight === pending) inFlight = null
      })
  }
  return inFlight
}

/**
 * Drop the cached settings. Called synchronously on every write, so the process
 * that served an owner's toggle never answers from the pre-toggle snapshot.
 */
export function clearConnectorSettingsCache(): void {
  cached = null
  inFlight = null
  generation += 1
}

/**
 * Normalize + validate an owner's host list. Entries are lowercased, trimmed
 * and deduped; anything that isn't a bare hostname throws, because a settings
 * form must tell the owner what it refused rather than quietly dropping it.
 */
function normalizeHosts(hosts: string[]): string[] {
  if (!Array.isArray(hosts)) throw new Error("Redirect hosts must be a list.")
  if (hosts.length > MAX_REDIRECT_HOSTS) {
    throw new Error(`At most ${MAX_REDIRECT_HOSTS} redirect hosts are allowed.`)
  }

  const normalized: string[] = []
  for (const entry of hosts) {
    if (typeof entry !== "string" || !entry.trim()) continue
    if (!isValidHostEntry(entry)) {
      // Echo the offending entry (truncated) — it is the owner's own input.
      throw new Error(`Not a valid host: ${entry.trim().slice(0, 100)}`)
    }
    const host = entry.trim().toLowerCase()
    if (!normalized.includes(host)) normalized.push(host)
  }
  return normalized
}

/**
 * Write the settings the owner submitted. Partial: an absent field keeps its
 * current value. Returns the stored result so the caller renders exactly what
 * was persisted (normalized hosts included).
 *
 * Clears the read cache (`L2-MCP-54`) before returning, so the owner's own
 * process serves the new state on the very next request rather than up to a
 * TTL later — which matters most for `enabled`, the master switch.
 *
 * Throws on invalid input — an unknown mode or a malformed host entry.
 */
export async function saveConnectorSettings(
  input: Partial<ConnectorSettings>
): Promise<ConnectorSettings> {
  const current = await getConnectorSettings()

  if (input.dcrMode !== undefined && !isDcrMode(input.dcrMode)) {
    throw new Error("Unknown dynamic registration mode.")
  }
  if (input.enabled !== undefined && typeof input.enabled !== "boolean") {
    throw new Error("The connector switch must be a boolean.")
  }

  const next: ConnectorSettings = {
    enabled: input.enabled ?? current.enabled,
    dcrMode: input.dcrMode ?? current.dcrMode,
    redirectHosts: input.redirectHosts
      ? normalizeHosts(input.redirectHosts)
      : current.redirectHosts,
  }

  try {
    await db
      .insert(connectorConfig)
      .values({
        kind: CONFIG_KIND,
        enabled: next.enabled,
        dcrMode: next.dcrMode,
        redirectHosts: next.redirectHosts,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: connectorConfig.kind,
        set: {
          enabled: next.enabled,
          dcrMode: next.dcrMode,
          redirectHosts: next.redirectHosts,
          updatedAt: new Date(),
        },
      })
  } finally {
    // Also on failure: a write that threw may still have landed, and a stale
    // "on" is the direction we refuse to keep serving.
    clearConnectorSettingsCache()
  }

  return next
}
