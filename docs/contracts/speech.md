# Contract (L2) — speech

> L2 = contract / what. AI proposes, human approves. Cite ≥1 L1.
> Style: terse. One fact per line.

> **Implements L1:** `L1-STACK-07` (Postgres config), `L1-STACK-09` (Drizzle schema + migrations)
> **Depends on L2:** `db` (`speech_config`, `L2-DB-16` crypto), `auth` (admin gate), `ui` (Input/Switch/NativeSelect/Field)

## Owns
Speech services (Deepgram): operator config under `/backflip/settings` (backed by `speech_config`) — API key, default STT model, default TTS voice — and live model discovery from the Deepgram catalog.

Explicitly **not** owned: actual transcription/synthesis call sites (none exist yet — this is config plumbing for them).

## Interfaces
- `L2-SPEECH-02` — Server action `saveSpeechConfig(prev, formData)` — upserts the single `speech_config` row on `provider`. `settings`-gated. Key encrypted when supplied; blank keeps existing. (`apps/web/app/backflip/(protected)/settings/_actions.ts`)
- `L2-SPEECH-04` — Server action `listSpeechModels()` + `fetchDeepgramModels(apiKey)` — live STT + TTS catalog via `GET https://api.deepgram.com/v1/models` (`Authorization: Token <key>`), key decrypted server-side only; returns `{id: canonical_name, label: name, kind: stt|tts, languages}`. 10s timeout, no-store. (`settings/_actions.ts`, `settings/_lib/deepgram-models.ts`)
- `L2-SPEECH-03` — Route `/backflip/settings` → Speech integration — fourth master-detail entry; fields: API key (masked, no reveal), default STT model, default TTS voice, Enabled. List row reads "connected" iff a key is saved. (`settings/_components/speech-integration.tsx`, `integrations-view.tsx`, `integrations-rail.tsx`, `page.tsx` — `L2-SPEECH-01`)

## Schemas
- `L2-SPEECH-01` — `speech_config` table (single row, `provider` unique default `deepgram`): `id`, `provider`, `apiKeyEnc` (AES, `L2-DB-16`), `sttModel`, `ttsModel` (Deepgram canonical names, nullable), `enabled` (default false), `updatedAt`. Migration `0007` creates it. `db` counterpart: `L2-DB-24`. (`packages/db/src/schema.ts`)

## Invariants
- `L2-SPEECH-05` — Key encrypted at rest, never sent to the client — masked preview only (`L2-AI-06` masking util reused).
- `L2-SPEECH-06` — No hardcoded model list anywhere. No key → model selects disabled + no catalog rendered; key saved → catalog fetched live from Deepgram. Saved model stays selectable even if absent from the live list.
- `L2-SPEECH-07` — Model selects submit Deepgram **canonical** names (`canonical_name`) — the values transcribe/speak calls accept.

## Errors
- `L2-SPEECH-08` — Unauthenticated / non-`settings` caller → `{ ok: false, message: "Unauthorized" }`, no write / no fetch.
- `L2-SPEECH-09` — Models fetch failure or bad key → `{ ok: false, message }` with generic copy; provider error bodies never surface to the UI.

## Acceptance
- `L2-SPEECH-10` — Fresh DB after `db:migrate`: table exists, no row → pane shows "Not connected", selects disabled, no catalog.
- `L2-SPEECH-11` — Save a valid key → catalog lists live STT + TTS models with kind badges; pick defaults; save; masked preview shown; blank key re-save keeps the key.

## Constrained L3
- `/docs/notes/speech.md`

---
IDs: `L2-SPEECH-<NN>`. Permanent, never renumber.
Change: propose diff + affected-L3 → stop → await human.
