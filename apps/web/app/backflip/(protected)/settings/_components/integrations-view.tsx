"use client"

import { useState } from "react"

import { cn } from "@workspace/ui/lib/utils"
import { RiArrowLeftLine } from "@remixicon/react"

import { AiIntegration } from "./ai-integration"
import type { ProviderConfig } from "./ai-config-form"
import {
  AnalyticsIntegration,
  type AnalyticsConfig,
} from "./analytics-integration"
import {
  ConnectorsIntegration,
  type ConnectorClientRow,
  type ConnectorSettingsData,
} from "./connectors-integration"
import type { EmailConfig } from "./email-config-form"
import { EmailIntegration } from "./email-integration"
import { IntegrationsRail } from "./integrations-rail"
import { SpeechIntegration, type SpeechConfig } from "./speech-integration"

type Selection = "ai" | "email" | "analytics" | "speech" | "connectors"

/** One row in the integrations master list. */
function ListRow({
  active,
  tile,
  title,
  subtitle,
  connected,
  onClick,
}: {
  active: boolean
  tile: React.ReactNode
  title: string
  subtitle: string
  connected: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 border-l-2 px-4 py-3 text-left transition-colors",
        active
          ? "border-primary bg-muted"
          : "border-transparent hover:bg-muted/50"
      )}
    >
      {tile}
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{title}</div>
        <div className="truncate text-xs text-muted-foreground">{subtitle}</div>
      </div>
      <span
        className={cn(
          "size-1.5 flex-none rounded-full",
          connected ? "bg-emerald-500" : "bg-muted-foreground/30"
        )}
      />
    </button>
  )
}

/**
 * Integrations admin shell (design 2a) — master list of connected services +
 * detail pane + context rail. **Real-data-only:** exactly four integrations
 * exist today (AI providers, Resend email, Google Analytics, Deepgram speech).
 */
export function IntegrationsView({
  ai,
  email,
  analytics,
  speech,
  connectorsEnabled,
  connectorSettings,
  connectorClients,
  connectorMcpUrl,
}: {
  ai: ProviderConfig[]
  email: EmailConfig
  analytics: AnalyticsConfig
  speech: SpeechConfig
  connectorsEnabled: boolean
  connectorSettings: ConnectorSettingsData | null
  connectorClients: ConnectorClientRow[]
  connectorMcpUrl: string
}) {
  const [selection, setSelection] = useState<Selection>("ai")
  const [mobileDetail, setMobileDetail] = useState(false)

  const aiConnected = ai.filter((c) => c.keyPreview).length
  const emailConnected = Boolean(email.keyPreview)
  const analyticsConnected = Boolean(analytics.measurementId)
  const speechConnected = Boolean(speech.keyPreview)

  function select(s: Selection) {
    setSelection(s)
    setMobileDetail(true)
  }

  return (
    <div className="flex h-full min-h-0 bg-card">
      {/* List — on the header canvas, not the card */}
      <div
        className={cn(
          "min-h-0 w-full flex-col overflow-hidden bg-background lg:flex lg:w-[372px] lg:flex-none lg:border-r",
          mobileDetail ? "hidden" : "flex"
        )}
      >
        <div className="flex h-14 items-center border-b px-4">
          <span className="text-sm font-semibold">Integrations</span>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <ListRow
            active={selection === "ai"}
            onClick={() => select("ai")}
            connected={aiConnected > 0}
            tile={
              <span className="flex size-9 flex-none items-center justify-center rounded-lg bg-primary text-xs font-bold text-primary-foreground">
                AI
              </span>
            }
            title="AI providers"
            subtitle={
              aiConnected > 0
                ? `${aiConnected} of ${ai.length} connected`
                : "Not configured"
            }
          />
          <ListRow
            active={selection === "email"}
            onClick={() => select("email")}
            connected={emailConnected}
            tile={
              <span className="flex size-9 flex-none items-center justify-center rounded-lg bg-muted font-mono text-xs font-bold">
                Re
              </span>
            }
            title="Email"
            subtitle="Resend · transactional email"
          />
          <ListRow
            active={selection === "analytics"}
            onClick={() => select("analytics")}
            connected={analyticsConnected}
            tile={
              <span className="flex size-9 flex-none items-center justify-center rounded-lg bg-muted font-mono text-xs font-bold">
                GA
              </span>
            }
            title="Google Analytics"
            subtitle={
              analyticsConnected ? analytics.measurementId : "Not configured"
            }
          />
          <ListRow
            active={selection === "speech"}
            onClick={() => select("speech")}
            connected={speechConnected}
            tile={
              <span className="flex size-9 flex-none items-center justify-center rounded-lg bg-muted font-mono text-xs font-bold">
                Dg
              </span>
            }
            title="Speech"
            subtitle="Deepgram · speech-to-text & TTS"
          />
          <ListRow
            active={selection === "connectors"}
            onClick={() => select("connectors")}
            connected={connectorsEnabled}
            tile={
              <span className="flex size-9 flex-none items-center justify-center rounded-lg bg-muted font-mono text-xs font-bold">
                Cn
              </span>
            }
            title="Connectors"
            subtitle={
              connectorsEnabled
                ? `${connectorClients.length} client${connectorClients.length === 1 ? "" : "s"}`
                : "Disabled"
            }
          />
        </div>
      </div>

      {/* Detail — keeps the card surface */}
      <div
        className={cn(
          "min-h-0 flex-1 flex-col overflow-y-auto bg-card lg:flex",
          mobileDetail ? "flex" : "hidden"
        )}
      >
        <button
          type="button"
          onClick={() => setMobileDetail(false)}
          className="mx-5 mt-4 inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground lg:hidden"
        >
          <RiArrowLeftLine className="size-4" />
          Integrations
        </button>
        {selection === "ai" ? (
          <AiIntegration providers={ai} />
        ) : selection === "email" ? (
          <EmailIntegration email={email} connected={emailConnected} />
        ) : selection === "analytics" ? (
          <AnalyticsIntegration
            analytics={analytics}
            connected={analyticsConnected}
          />
        ) : selection === "speech" ? (
          <SpeechIntegration speech={speech} connected={speechConnected} />
        ) : (
          <ConnectorsIntegration
            enabled={connectorsEnabled}
            settings={connectorSettings}
            clients={connectorClients}
            mcpUrl={connectorMcpUrl}
          />
        )}
      </div>

      {/* Rail */}
      <div className="hidden min-h-0 w-[300px] flex-none flex-col overflow-y-auto border-l bg-muted/50 p-4 xl:flex">
        <IntegrationsRail selection={selection} />
      </div>
    </div>
  )
}
