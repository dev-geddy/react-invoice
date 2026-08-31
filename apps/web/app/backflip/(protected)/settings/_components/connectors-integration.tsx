"use client"

import { RiExternalLinkLine } from "@remixicon/react"

import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert"

import { ConnectorClients } from "./connector-clients"
import { ConnectorCopyField } from "./connector-copy-field"
import { ConnectorEnable } from "./connector-enable"
import { ConnectorRedirectHosts } from "./connector-redirect-hosts"
import { ConnectorRegistrationMode } from "./connector-registration-mode"

export type DcrMode = "off" | "allowlist" | "open"

export type ConnectorSettingsData = {
  /** Owner's stored intent — `connector_config.enabled` (`L2-MCP-25`). */
  enabled: boolean
  /** Whether `MCP_ENABLED=false` vetoes `enabled` regardless (`L2-MCP-37`). */
  forcedOff: boolean
  dcrMode: DcrMode
  redirectHosts: string[]
}

/** One row of the Clients table, serialized for the client shell. */
export type ConnectorClientRow = {
  id: string
  clientId: string
  clientName: string
  origin: string
  redirectUris: string[]
  allowLoopbackPorts: boolean
  /** Preformatted (server-formatted to avoid locale hydration skew). */
  createdAt: string
  lastUsedAt: string | null
}

const DOCS_URL =
  "https://github.com/dev-geddy/backflip/blob/master/docs/notes/mcp.md"

/**
 * Connectors integration detail (design 2a) — owner-only admin surface for
 * the MCP connector. The tab always renders. The enable/disable master switch
 * (`ConnectorEnable`) is always shown; the three management sections (mode,
 * allowlist, clients) render only once the connector is actually reachable
 * (`enabled` — resolved via `isMcpEnabled()`, `L2-MCP-25`/`L2-MCP-37`) —
 * an owner can't usefully create clients or edit the allowlist for a
 * connector nobody can reach yet.
 */
export function ConnectorsIntegration({
  enabled,
  settings,
  clients,
  mcpUrl,
}: {
  /** Resolved: `settings.enabled && !settings.forcedOff` (`isMcpEnabled()`). */
  enabled: boolean
  settings: ConnectorSettingsData | null
  clients: ConnectorClientRow[]
  /** The connector endpoint Claude is pointed at (`L2-MCP-11`). */
  mcpUrl: string
}) {
  return (
    <div className="flex flex-col gap-5 p-5">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Connectors</h2>
        <p className="text-sm text-muted-foreground">
          Manage who can connect a Claude client to this platform through the
          MCP connector.
        </p>
      </div>

      {settings ? (
        <ConnectorEnable
          enabled={settings.enabled}
          forcedOff={settings.forcedOff}
        />
      ) : null}

      {!enabled || !settings ? (
        <Alert>
          <AlertTitle>The connector isn&rsquo;t turned on yet</AlertTitle>
          <AlertDescription>
            <p>
              Once enabled, a Claude client — claude.ai, Claude Desktop, or
              Claude Code — can read this platform&rsquo;s data through an
              authenticated MCP connection, scoped to the signed-in user&rsquo;s
              role and to whatever the connecting client was granted during
              consent.
            </p>
            <a
              href={DOCS_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 font-medium"
            >
              Connector documentation
              <RiExternalLinkLine className="size-3" />
            </a>
          </AlertDescription>
        </Alert>
      ) : (
        <>
          <ConnectorCopyField
            label="Remote MCP server URL"
            value={mcpUrl}
            description="Paste this into Claude → Add custom connector. It comes from AUTH_URL, so it is always the origin tokens are bound to."
          />
          <div className="h-px bg-border" />
          <ConnectorRegistrationMode dcrMode={settings.dcrMode} />
          <div className="h-px bg-border" />
          <ConnectorRedirectHosts hosts={settings.redirectHosts} />
          <div className="h-px bg-border" />
          <ConnectorClients clients={clients} mcpUrl={mcpUrl} />
        </>
      )}
    </div>
  )
}
