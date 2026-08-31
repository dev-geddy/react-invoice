import {
  aiConfig,
  analyticsConfig,
  db,
  emailConfig,
  speechConfig,
} from "@workspace/db"
import { eq } from "drizzle-orm"

import { requireCapability } from "@/app/_lib/auth/guard"
import { listClients } from "@/app/_lib/oauth/clients"
import { getConnectorSettings } from "@/app/_lib/oauth/connector-config"
import {
  isMcpEnabled,
  isMcpForcedOff,
  mcpResourceUrl,
} from "@/app/_lib/oauth/config"
import { type ProviderConfig } from "./_components/ai-config-form"
import { type AnalyticsConfig } from "./_components/analytics-integration"
import {
  type ConnectorClientRow,
  type ConnectorSettingsData,
} from "./_components/connectors-integration"
import { type EmailConfig } from "./_components/email-config-form"
import { IntegrationsView } from "./_components/integrations-view"
import { type SpeechConfig } from "./_components/speech-integration"
import { keyPreview } from "./_lib/mask"

const PROVIDERS = ["anthropic", "openai", "google"] as const

const CONNECTOR_DATE_FMT = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
})

/**
 * /backflip/settings — admin Integrations (owner only). Master-detail over
 * five surfaces: AI providers (per provider), Email (Resend), Google
 * Analytics, Speech (Deepgram), and the Connectors (MCP OAuth client) admin.
 * Secrets are never sent to the client; only whether a key is set + its
 * masked preview (or, for a freshly created OAuth client, the raw secret
 * exactly once — `L2-MCP-50`). The GA measurement id is public, so it
 * round-trips in the clear.
 *
 * @spec L2-AI-01, L2-EMAIL-01, L2-ANALYTICS-05, L2-SPEECH-01, L2-MCP-25,
 *       L2-MCP-37, L2-MCP-47
 */
export default async function SettingsPage() {
  await requireCapability("settings")

  const rows = await db.select().from(aiConfig)
  const byProvider = new Map(rows.map((r) => [r.provider, r]))

  const ai: ProviderConfig[] = PROVIDERS.map((provider) => {
    const r = byProvider.get(provider)
    return {
      provider,
      model: r?.model ?? "",
      enabled: r?.enabled ?? false,
      isDefault: r?.isDefault ?? false,
      keyPreview: keyPreview(r?.apiKeyEnc),
    }
  })

  const [emailRow] = await db
    .select()
    .from(emailConfig)
    .where(eq(emailConfig.provider, "resend"))
  const email: EmailConfig = {
    fromEmail: emailRow?.fromEmail ?? "",
    fromName: emailRow?.fromName ?? "",
    replyTo: emailRow?.replyTo ?? "",
    enabled: emailRow?.enabled ?? false,
    keyPreview: keyPreview(emailRow?.apiKeyEnc),
  }

  const [analyticsRow] = await db
    .select()
    .from(analyticsConfig)
    .where(eq(analyticsConfig.kind, "google_analytics"))
  const analytics: AnalyticsConfig = {
    measurementId: analyticsRow?.measurementId ?? "",
    cookieBannerEnabled: analyticsRow?.cookieBannerEnabled ?? true,
    cookieBannerText: analyticsRow?.cookieBannerText ?? "",
  }

  const [speechRow] = await db
    .select()
    .from(speechConfig)
    .where(eq(speechConfig.provider, "deepgram"))
  const speech: SpeechConfig = {
    sttModel: speechRow?.sttModel ?? "",
    ttsModel: speechRow?.ttsModel ?? "",
    enabled: speechRow?.enabled ?? false,
    keyPreview: keyPreview(speechRow?.apiKeyEnc),
  }

  // The connector tab always renders — it explains itself when off, and the
  // enable switch (`ConnectorEnable`) is how an owner turns it on in the
  // first place. Settings are read unconditionally (cheap: a single row,
  // created with defaults on first use); the management sections' data
  // (clients) is only fetched once the connector is actually reachable —
  // `enabled` resolved through `isMcpEnabled()`, which folds in the
  // `MCP_ENABLED=false` kill switch (`L2-MCP-25`, `L2-MCP-37`).
  const [connectorsEnabled, connectorSettingsRow] = await Promise.all([
    isMcpEnabled(),
    getConnectorSettings(),
  ])
  const connectorSettings: ConnectorSettingsData = {
    enabled: connectorSettingsRow.enabled,
    forcedOff: isMcpForcedOff(),
    dcrMode: connectorSettingsRow.dcrMode,
    redirectHosts: connectorSettingsRow.redirectHosts,
  }
  let connectorClients: ConnectorClientRow[] = []
  if (connectorsEnabled) {
    const clientRows = await listClients()
    connectorClients = clientRows.map((c) => ({
      id: c.id,
      clientId: c.clientId,
      clientName: c.clientName,
      origin: c.origin,
      redirectUris: c.redirectUris,
      allowLoopbackPorts: c.allowLoopbackPorts,
      createdAt: CONNECTOR_DATE_FMT.format(c.createdAt),
      lastUsedAt: c.lastUsedAt ? CONNECTOR_DATE_FMT.format(c.lastUsedAt) : null,
    }))
  }

  return (
    <IntegrationsView
      ai={ai}
      email={email}
      analytics={analytics}
      speech={speech}
      connectorsEnabled={connectorsEnabled}
      connectorSettings={connectorSettings}
      connectorClients={connectorClients}
      connectorMcpUrl={mcpResourceUrl()}
    />
  )
}
