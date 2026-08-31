# Notes (L3) — ai

> L3 = how / volatile. AI writes free. Cites L2 IDs up. Matches code as-is.

## File map
- `apps/web/app/backflip/(protected)/settings/page.tsx` — server; loads `ai_config`, maps to view model (no key decryption; `hasKey` boolean). Satisfies `L2-AI-01`.
- `settings/_components/ai-config-form.tsx` — client; Tabs per provider (provider selector), flat form content (no Card), inputs capped 320px. `useActionState(saveAiConfig)`. Fields: **default model** (`native-select`; per-provider default, individual AI features may request a different model at call time), API key (password, write-only), enabled + default provider (`Switch`, base-ui `name`). Static `MODELS` list per provider. (baseUrl/temperature columns exist but aren't in the form.) Page wraps each settings section in a `Card`. `ai-section.tsx` (client) toggles between a **summary** (per-provider status: default/enabled badges, model, masked key preview, or "Not configured" + "Edit settings" button) and the **edit** view (two-column: `AiConfigForm` left, vertical `Separator`, explanation prose right). Form takes `onSaved`/`onCancel`; on save success (`state.ok`) it returns to summary. Provider name shown as a title above the form.
- `settings/_lib/mask.ts` — server util: `keyPreview(apiKeyEnc)` decrypts (`L2-DB-16`) → `maskKey` (first 3 + last 4 around fixed 8-dot run; ≤8 chars fully masked). Preview computed in `page.tsx`; plaintext never sent to client. Satisfies `L2-AI-06`.
- `settings/_actions.ts` — `saveAiConfig` (`"use server"`): auth-gate → upsert on provider → encrypt key if provided → unset other defaults → `revalidatePath`. Satisfies `L2-AI-02`, `L2-AI-06..08`. Also `listAiModels(provider)`: auth-gate → read `ai_config` row → decrypt key server-side → `fetchProviderModels` → `{ok, models}` (or `ok:false` when no key / fetch fails — UI keeps fallback). Satisfies `L2-AI-13` (proposed).
- `settings/_lib/provider-models.ts` — server-only live model discovery (`@spec L2-AI-13`): anthropic `GET /v1/models` (x-api-key + anthropic-version, `after_id` pagination ≤5 pages), openai `GET /v1/models` (Bearer; filtered to chat families `gpt-*`/`o<N>`/`chatgpt-*`, non-chat variants excluded), google `GET v1beta/models` (x-goog-api-key, `generateContent`-capable only, `models/` prefix stripped, pageToken ≤5 pages). 10s timeout, provider error bodies never surfaced to the client.
- `settings/_hooks/use-provider-models.ts` — `useProviderModels(cfg)` (moved out of `ai-integration.tsx`; shared with the test modal). No key → empty list (no stale hardcoded fallback); key saved → static `MODELS` bridge, then live list via `listAiModels`; saved model always kept selectable.
- `ai-integration.tsx` model UI: no key → dropdown disabled ("Save an API key to load models…"), "Available models" panel hidden entirely. With key: dropdown disabled while loading; panel labels live vs fallback, scrolls past 72. Header carries a "Test integration" button (`RiFlaskLine`), disabled until some provider is enabled **and** has a key.
- `settings/_components/ai-test-dialog.tsx` — client; test modal (`@spec L2-AI-15`). Provider select (testable only, defaults to the default provider), model select (`useProviderModels`), prompt `Textarea` (4000 max, ⌘/Ctrl+↵ sends, `Kbd` hint). Submit → `fetch` the test route, read the body reader, append chunks to state → `Markdown`. States: idle / thinking (pulsing dots) / streaming (response box auto-scrolls) / error (generic message). Unmounted while closed, so a run never leaks into the next open; in-flight run aborted on unmount.
- `settings/_components/markdown.tsx` — client; `react-markdown` + `remark-gfm` with per-element Tailwind classes (no typography plugin in the design system). Raw HTML left disabled — model output is untrusted.
- `settings/_lib/ai-test.ts` — server-only call layer (`@spec L2-AI-14, L2-AI-16`): provider → `createAnthropic`/`createOpenAI`/`createGoogleGenerativeAI` with the decrypted key → `streamText`. **Awaits the first chunk before returning the stream**, so an up-front failure (bad key, unknown model) still becomes a 502 JSON body instead of a half-written response; a mid-stream failure keeps the partial and closes cleanly. System prompt asks for a short, well-structured markdown answer.
- `app/api/backflip/ai/test/route.ts` — `POST` (`@spec L2-AI-14, L2-AI-17..21`): auth + `settings` gate → per-user rate limit (`L2-AI-21`) → validate provider/model/prompt → read `ai_config` → require key + `enabled` → decrypt → stream `text/plain`, `no-store`. Node runtime. A route, not a server action, because the answer streams. Rate limit: `testRateLimiter` (shared `_lib/rate-limit.ts`, see [[auth]]), keyed on `session.user.id`, `TEST_MAX_PER_WINDOW` (20) per `TEST_WINDOW_MS` (5 min); over-limit → `429` + `Retry-After`. Bounds cost abuse of the org's stored provider key by an owner session (or a stolen owner cookie). In-process (single Node process per instance).
- `apps/web` dep `server-only` — guards `provider-models.ts` and `ai-test.ts` from client bundling.
- `apps/web` deps `ai` (7.x) + `@ai-sdk/anthropic`/`@ai-sdk/openai`/`@ai-sdk/google` (4.x) — `L1-STACK-11`; `zod` (AI SDK peer); `react-markdown` + `remark-gfm`.
- `packages/db` — `ai_config` table + `encryptSecret`/`decryptSecret` (`L2-DB-16/17`).

## State
- Scope = config + persistence + a single live test round-trip (`L2-AI-14/15`). No product feature calls a model yet.
- Nav: Settings (secondary group) → `/backflip/settings`.
- Verified: settings renders; ai_config insert + key encrypt/decrypt round-trip pass.
- Test modal verified by typecheck / lint / `next build` only — **no live round-trip run yet** (no Docker/Postgres and no provider key in the dev container). Needs a manual pass: real key → send a prompt → thinking → markdown; then a bad key → generic 502 message.

## Models offered (static, tune freely)
- anthropic: `claude-opus-4-8`, `claude-sonnet-5`, `claude-haiku-4-5-20251001`
- openai: `gpt-4.1`, `gpt-4o`, `o3`, `o4-mini`
- google: `gemini-2.5-pro`, `gemini-2.5-flash`

## TODO
- Generalize the call layer: `ai-test.ts` resolves one provider per call from an explicit id; a product feature will want "use the default provider" + shared model/params resolution.
- Streaming errors are swallowed mid-stream (partial answer, clean close). If that proves confusing, surface a trailing error marker out-of-band.
- Run the manual verification pass listed under State.
