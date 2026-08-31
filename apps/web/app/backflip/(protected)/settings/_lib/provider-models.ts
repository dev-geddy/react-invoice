import "server-only"

/**
 * Live model discovery per AI provider. Called server-side with the decrypted
 * API key — the key never reaches the client; only the model list does.
 *
 * @spec L2-AI-13
 */

export type ProviderModel = { id: string; label: string }

type Provider = "anthropic" | "openai" | "google"

const TIMEOUT_MS = 10_000

async function getJson(url: string, headers: Record<string, string>) {
  const res = await fetch(url, {
    headers,
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  })
  if (!res.ok) {
    throw new Error(`provider responded ${res.status}`)
  }
  return res.json()
}

/** Anthropic Models API: GET /v1/models (paginated via after_id/has_more). */
async function fetchAnthropicModels(apiKey: string): Promise<ProviderModel[]> {
  const headers = {
    "x-api-key": apiKey,
    "anthropic-version": "2023-06-01",
  }
  const models: ProviderModel[] = []
  let afterId: string | null = null
  // Bounded pagination — the catalog is small; 5 pages × 100 is generous.
  for (let page = 0; page < 5; page++) {
    const qs = new URLSearchParams({ limit: "100" })
    if (afterId) qs.set("after_id", afterId)
    const body = await getJson(
      `https://api.anthropic.com/v1/models?${qs}`,
      headers
    )
    for (const m of body.data ?? []) {
      models.push({ id: m.id, label: m.display_name ?? m.id })
    }
    if (!body.has_more || !body.last_id) break
    afterId = body.last_id
  }
  return models
}

/**
 * OpenAI Models API: GET /v1/models returns every model incl. non-chat ones
 * (embeddings, audio, images) — keep chat-capable families, drop the rest.
 */
async function fetchOpenaiModels(apiKey: string): Promise<ProviderModel[]> {
  const body = await getJson("https://api.openai.com/v1/models", {
    Authorization: `Bearer ${apiKey}`,
  })
  const chatFamily = /^(gpt-|o\d|chatgpt-)/
  const nonChat =
    /(embedding|audio|realtime|transcribe|tts|whisper|dall-e|image|moderation|search|instruct)/
  return (body.data ?? [])
    .map((m: { id: string }) => m.id)
    .filter((id: string) => chatFamily.test(id) && !nonChat.test(id))
    .sort()
    .map((id: string) => ({ id, label: id }))
}

/** Google Generative Language API: models supporting generateContent. */
async function fetchGoogleModels(apiKey: string): Promise<ProviderModel[]> {
  const models: ProviderModel[] = []
  let pageToken: string | null = null
  for (let page = 0; page < 5; page++) {
    const qs = new URLSearchParams({ pageSize: "200" })
    if (pageToken) qs.set("pageToken", pageToken)
    const body = await getJson(
      `https://generativelanguage.googleapis.com/v1beta/models?${qs}`,
      { "x-goog-api-key": apiKey }
    )
    for (const m of body.models ?? []) {
      if (!m.supportedGenerationMethods?.includes("generateContent")) continue
      models.push({
        id: String(m.name ?? "").replace(/^models\//, ""),
        label: m.displayName ?? String(m.name ?? "").replace(/^models\//, ""),
      })
    }
    if (!body.nextPageToken) break
    pageToken = body.nextPageToken
  }
  return models
}

export async function fetchProviderModels(
  provider: Provider,
  apiKey: string
): Promise<ProviderModel[]> {
  switch (provider) {
    case "anthropic":
      return fetchAnthropicModels(apiKey)
    case "openai":
      return fetchOpenaiModels(apiKey)
    case "google":
      return fetchGoogleModels(apiKey)
  }
}
