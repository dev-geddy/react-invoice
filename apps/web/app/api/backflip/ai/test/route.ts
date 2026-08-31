import { NextResponse } from "next/server"

import { aiConfig, db, decryptSecret } from "@workspace/db"
import { eq } from "drizzle-orm"

import { auth } from "@/app/_lib/auth"
import { canAccessSettings } from "@/app/_lib/auth/permissions"
import { createRateLimiter } from "@/app/_lib/rate-limit"
import {
  MAX_PROMPT_CHARS,
  streamTestPrompt,
  type TestProvider,
} from "@/app/backflip/(protected)/settings/_lib/ai-test"

// Uses pg (db) + the key decryption cipher — Node runtime, not edge.
export const runtime = "nodejs"

const PROVIDERS = ["anthropic", "openai", "google"] as const

/**
 * Per-user throttle on live provider calls — the endpoint spends the org's
 * stored API key, so an owner session (or a stolen owner cookie) must not be
 * able to loop it into an unbounded, billed inference proxy. In-process only
 * (see `rate-limit.ts`); this instance runs as a single Node process.
 */
const TEST_MAX_PER_WINDOW = 20
const TEST_WINDOW_MS = 5 * 60_000
const testRateLimiter = createRateLimiter({
  max: TEST_MAX_PER_WINDOW,
  windowMs: TEST_WINDOW_MS,
})

/**
 * POST /api/backflip/ai/test — one live round-trip against an enabled AI
 * provider, streamed back as plain-text markdown chunks. Settings-gated.
 * Body (JSON): `{ provider, model, prompt }`.
 *
 * A route rather than a server action because the response streams: the test
 * modal renders tokens as they arrive.
 *
 * Only providers that are enabled *and* have a stored key are testable — the
 * modal filters them out, and this re-checks server-side. The key is decrypted
 * here and never leaves the server; provider error bodies are never echoed
 * back, only a generic message.
 *
 * Status codes: 200 streaming · 400 validation / provider not testable ·
 * 401 unauth · 403 forbidden · 502 provider call failed.
 *
 * @spec L2-AI-14, L2-AI-17, L2-AI-18, L2-AI-19, L2-AI-20, L2-AI-22
 */
export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json(
      { ok: false, message: "Unauthorized" },
      { status: 401 }
    )
  }
  if (!canAccessSettings(session.user.role)) {
    return NextResponse.json(
      { ok: false, message: "Forbidden" },
      { status: 403 }
    )
  }

  const rlKey = session.user.id
  if (testRateLimiter.blocked(rlKey)) {
    const retryAfter = Math.ceil(testRateLimiter.retryAfterMs(rlKey) / 1000)
    return NextResponse.json(
      { ok: false, message: "Too many test runs — try again in a moment." },
      { status: 429, headers: { "Retry-After": String(retryAfter) } }
    )
  }
  testRateLimiter.hit(rlKey)

  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json(
      { ok: false, message: "Invalid JSON body." },
      { status: 400 }
    )
  }

  const provider = String(body.provider ?? "")
  const model = String(body.model ?? "").trim()
  const prompt = String(body.prompt ?? "").trim()

  if (!PROVIDERS.includes(provider as TestProvider)) {
    return NextResponse.json(
      { ok: false, message: "Unknown provider." },
      { status: 400 }
    )
  }
  if (!model) {
    return NextResponse.json(
      { ok: false, message: "Pick a model first." },
      { status: 400 }
    )
  }
  if (!prompt) {
    return NextResponse.json(
      { ok: false, message: "Enter a prompt first." },
      { status: 400 }
    )
  }
  if (prompt.length > MAX_PROMPT_CHARS) {
    return NextResponse.json(
      {
        ok: false,
        message: `Prompt is too long (max ${MAX_PROMPT_CHARS} characters).`,
      },
      { status: 400 }
    )
  }

  const row = await db.query.aiConfig.findFirst({
    where: eq(aiConfig.provider, provider as TestProvider),
  })
  if (!row?.apiKeyEnc) {
    return NextResponse.json(
      { ok: false, message: "No API key saved for this provider yet." },
      { status: 400 }
    )
  }
  if (!row.enabled) {
    return NextResponse.json(
      { ok: false, message: "This provider is disabled." },
      { status: 400 }
    )
  }

  try {
    const stream = await streamTestPrompt({
      provider: provider as TestProvider,
      model,
      prompt,
      apiKey: decryptSecret(row.apiKeyEnc),
    })
    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
      },
    })
  } catch {
    // Don't leak provider error bodies (may echo request details) to the UI.
    return NextResponse.json(
      {
        ok: false,
        message: "The provider rejected the request — check the key and model.",
      },
      { status: 502 }
    )
  }
}
