import "server-only"

/**
 * Live model discovery for Deepgram (speech). Called server-side with the
 * decrypted API key — the key never reaches the client; only the model list
 * does. `GET /v1/models` returns both STT and TTS catalogs in one response.
 *
 * @spec L2-SPEECH-04
 */

export type SpeechModel = {
  /** Deepgram canonical model name — the value used in transcribe/speak calls. */
  id: string
  label: string
  kind: "stt" | "tts"
  languages: string[]
}

const TIMEOUT_MS = 10_000

type DeepgramModel = {
  name?: string
  canonical_name?: string
  languages?: string[]
}

export async function fetchDeepgramModels(
  apiKey: string
): Promise<SpeechModel[]> {
  const res = await fetch("https://api.deepgram.com/v1/models", {
    headers: { Authorization: `Token ${apiKey}` },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  })
  if (!res.ok) {
    throw new Error(`deepgram responded ${res.status}`)
  }
  const body = (await res.json()) as {
    stt?: DeepgramModel[]
    tts?: DeepgramModel[]
  }

  const toModel = (
    m: DeepgramModel,
    kind: "stt" | "tts"
  ): SpeechModel | null =>
    m.canonical_name
      ? {
          id: m.canonical_name,
          label: m.name ?? m.canonical_name,
          kind,
          languages: m.languages ?? [],
        }
      : null

  return [
    ...(body.stt ?? []).map((m) => toModel(m, "stt")),
    ...(body.tts ?? []).map((m) => toModel(m, "tts")),
  ].filter((m): m is SpeechModel => m !== null)
}
