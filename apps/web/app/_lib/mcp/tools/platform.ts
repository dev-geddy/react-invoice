import {
  aiConfig,
  analyticsConfig,
  db,
  emailConfig,
  speechConfig,
} from "@workspace/db"
import { z } from "zod"

import type { CallToolResult, McpServer } from "@modelcontextprotocol/server"

import { can } from "@/app/_lib/auth/permissions"
import type { McpAuthContext } from "@/app/_lib/oauth/types"

/**
 * `get_platform_status` — integration status only. Scope `settings`.
 *
 * Every serializer below takes the raw config row (which carries the
 * encrypted key column) and emits only booleans + non-secret identifiers —
 * `apiKeyEnc` never crosses into the tool result (`L2-MCP-07`, `L2-MCP-35`).
 *
 * @spec L2-MCP-07, L2-MCP-09, L2-MCP-34, L2-MCP-35
 */
export const PLATFORM_SCOPE = "settings" as const

const inputSchema = z.object({})

function toolResult(data: Record<string, unknown>): CallToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
    structuredContent: data,
  }
}

function toolError(message: string): CallToolResult {
  return { content: [{ type: "text", text: message }], isError: true }
}

type AiConfigRow = {
  provider: string
  model: string | null
  apiKeyEnc: string | null
  enabled: boolean
  isDefault: boolean
}

type EmailConfigRow = {
  provider: string
  apiKeyEnc: string | null
  fromEmail: string | null
  enabled: boolean
}

type SpeechConfigRow = {
  provider: string
  apiKeyEnc: string | null
  sttModel: string | null
  ttsModel: string | null
  enabled: boolean
}

type AnalyticsConfigRow = {
  kind: string
  measurementId: string | null
  cookieBannerEnabled: boolean
}

/** Per-provider AI status: `hasKey` is derived, the ciphertext never leaves. */
export function serializeAiConfig(rows: AiConfigRow[]) {
  return rows.map((r) => ({
    provider: r.provider,
    model: r.model,
    enabled: r.enabled,
    isDefault: r.isDefault,
    hasKey: Boolean(r.apiKeyEnc),
  }))
}

export function serializeEmailConfig(row: EmailConfigRow | undefined) {
  if (!row)
    return {
      provider: "resend",
      enabled: false,
      hasKey: false,
      fromEmail: null,
    }
  return {
    provider: row.provider,
    enabled: row.enabled,
    hasKey: Boolean(row.apiKeyEnc),
    fromEmail: row.fromEmail,
  }
}

export function serializeSpeechConfig(row: SpeechConfigRow | undefined) {
  if (!row) {
    return {
      provider: "deepgram",
      enabled: false,
      hasKey: false,
      sttModel: null,
      ttsModel: null,
    }
  }
  return {
    provider: row.provider,
    enabled: row.enabled,
    hasKey: Boolean(row.apiKeyEnc),
    sttModel: row.sttModel,
    ttsModel: row.ttsModel,
  }
}

export function serializeAnalyticsConfig(row: AnalyticsConfigRow | undefined) {
  if (!row) {
    return {
      kind: "google_analytics",
      measurementId: null,
      cookieBannerEnabled: true,
    }
  }
  return {
    kind: row.kind,
    measurementId: row.measurementId,
    cookieBannerEnabled: row.cookieBannerEnabled,
  }
}

async function handle(ctx: McpAuthContext): Promise<CallToolResult> {
  if (!ctx.scopes.includes(PLATFORM_SCOPE) || !can(ctx.role, PLATFORM_SCOPE)) {
    return toolError("This connection no longer has the settings scope.")
  }

  const aiRows = await db
    .select({
      provider: aiConfig.provider,
      model: aiConfig.model,
      apiKeyEnc: aiConfig.apiKeyEnc,
      enabled: aiConfig.enabled,
      isDefault: aiConfig.isDefault,
    })
    .from(aiConfig)

  const [emailRow] = await db
    .select({
      provider: emailConfig.provider,
      apiKeyEnc: emailConfig.apiKeyEnc,
      fromEmail: emailConfig.fromEmail,
      enabled: emailConfig.enabled,
    })
    .from(emailConfig)
    .limit(1)

  const [speechRow] = await db
    .select({
      provider: speechConfig.provider,
      apiKeyEnc: speechConfig.apiKeyEnc,
      sttModel: speechConfig.sttModel,
      ttsModel: speechConfig.ttsModel,
      enabled: speechConfig.enabled,
    })
    .from(speechConfig)
    .limit(1)

  const [analyticsRow] = await db
    .select({
      kind: analyticsConfig.kind,
      measurementId: analyticsConfig.measurementId,
      cookieBannerEnabled: analyticsConfig.cookieBannerEnabled,
    })
    .from(analyticsConfig)
    .limit(1)

  return toolResult({
    ai: serializeAiConfig(aiRows),
    email: serializeEmailConfig(emailRow),
    speech: serializeSpeechConfig(speechRow),
    analytics: serializeAnalyticsConfig(analyticsRow),
  })
}

export function registerPlatformStatus(
  server: McpServer,
  ctx: McpAuthContext
): void {
  server.registerTool(
    "get_platform_status",
    {
      title: "Platform status",
      description:
        "Integration status for AI providers, email, speech, and analytics — " +
        "booleans and non-secret identifiers only. Never keys or ciphertext.",
      inputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    () => handle(ctx)
  )
}
