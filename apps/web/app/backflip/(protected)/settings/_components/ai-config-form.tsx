export type ProviderConfig = {
  provider: "anthropic" | "openai" | "google"
  model: string
  enabled: boolean
  isDefault: boolean
  keyPreview: string | null
}

export const LABEL: Record<ProviderConfig["provider"], string> = {
  anthropic: "Anthropic (Claude)",
  openai: "OpenAI",
  google: "Google (Gemini)",
}

/** AI SDK package per provider — shown as a mono badge in the pane header. */
export const PACKAGE: Record<ProviderConfig["provider"], string> = {
  anthropic: "@ai-sdk/anthropic",
  openai: "@ai-sdk/openai",
  google: "@ai-sdk/google",
}

/**
 * Fallback model suggestions per provider — shown while the live list loads
 * and when no API key is saved yet. With a saved key, the UI fetches the real
 * list from the provider's models API (`listAiModels`, L2-AI-13).
 */
export const MODELS: Record<ProviderConfig["provider"], string[]> = {
  anthropic: [
    "claude-opus-4-8",
    "claude-sonnet-5",
    "claude-haiku-4-5-20251001",
  ],
  openai: ["gpt-4.1", "gpt-4o", "o3", "o4-mini"],
  google: ["gemini-2.5-pro", "gemini-2.5-flash"],
}
