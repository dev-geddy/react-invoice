import "server-only"

import { createAnthropic } from "@ai-sdk/anthropic"
import { createGoogleGenerativeAI } from "@ai-sdk/google"
import { createOpenAI } from "@ai-sdk/openai"
import { streamText } from "ai"

/**
 * One live model round-trip per provider, via the Vercel AI SDK (`L1-STACK-11`).
 * Called server-side with the decrypted API key — the key never reaches the
 * client; only the generated markdown does.
 *
 * @spec L2-AI-14, L2-AI-16
 */

export type TestProvider = "anthropic" | "openai" | "google"

/** Prompt cap — keeps a test round-trip cheap and bounded. */
export const MAX_PROMPT_CHARS = 4000

/** Response cap. The test box is a preview, not a chat surface. */
const MAX_OUTPUT_TOKENS = 800

const TIMEOUT_MS = 60_000

/**
 * Asks for a short, well-structured markdown answer: the modal renders the
 * reply as markdown in a fixed-height box, so long prose or a bare wall of
 * text reads badly there.
 */
const SYSTEM_PROMPT = [
  "You are answering inside an integration test panel of an admin dashboard.",
  "Answer in GitHub-flavored markdown.",
  "Be short and well structured: lead with a one-sentence answer, then at most",
  "a handful of bullets or a small table when they genuinely help.",
  "Use headings only if the answer really needs sections.",
  "No preamble, no sign-off, no restating the question.",
].join(" ")

function languageModel(provider: TestProvider, model: string, apiKey: string) {
  switch (provider) {
    case "anthropic":
      return createAnthropic({ apiKey })(model)
    case "openai":
      return createOpenAI({ apiKey })(model)
    case "google":
      return createGoogleGenerativeAI({ apiKey })(model)
  }
}

/**
 * Streams the model's answer as plain text chunks.
 *
 * The first chunk is awaited before the caller starts its HTTP response, so a
 * failure that happens up front (bad key, unknown model, provider down) can
 * still be reported as a normal error status instead of a half-written body.
 * Provider error bodies are never propagated — they can echo request details.
 */
export async function streamTestPrompt({
  provider,
  model,
  prompt,
  apiKey,
}: {
  provider: TestProvider
  model: string
  prompt: string
  apiKey: string
}): Promise<ReadableStream<Uint8Array>> {
  const result = streamText({
    model: languageModel(provider, model, apiKey),
    system: SYSTEM_PROMPT,
    prompt,
    maxOutputTokens: MAX_OUTPUT_TOKENS,
    abortSignal: AbortSignal.timeout(TIMEOUT_MS),
  })

  const iterator = result.textStream[Symbol.asyncIterator]()
  // Surfaces provider failures before any bytes are committed to the response.
  const first = await iterator.next()

  const encoder = new TextEncoder()
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      if (!first.done) controller.enqueue(encoder.encode(first.value))
      try {
        for (
          let next = await iterator.next();
          !next.done;
          next = await iterator.next()
        ) {
          controller.enqueue(encoder.encode(next.value))
        }
      } catch {
        // Mid-stream failure: keep what arrived and close cleanly. The client
        // renders the partial answer rather than a raw provider error.
      }
      controller.close()
    },
    cancel() {
      void iterator.return?.()
    },
  })
}
