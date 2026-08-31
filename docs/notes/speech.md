# Notes (L3) — speech

> L3 = how / volatile. AI-maintained, no approval. Cites L2 by ID.

## File map
- `packages/db/src/schema.ts` — `speechConfig` (`speech_config`): mirrors `email_config` shape (single row, `provider` unique default `deepgram`), plus `sttModel`/`ttsModel`. Migration `0007_unknown_professor_monster.sql`. Satisfies `L2-SPEECH-01`, `L2-DB-24`.
- `settings/_lib/deepgram-models.ts` — server-only `fetchDeepgramModels(apiKey)`: `GET api.deepgram.com/v1/models`, `Authorization: Token <key>`, 10s timeout. Maps `{stt:[],tts:[]}` → flat `SpeechModel[]` keyed on `canonical_name` (the id transcribe/speak calls take; `name` is the friendly label). Satisfies `L2-SPEECH-04`.
- `settings/_actions.ts` — `saveSpeechConfig` (upsert on provider, key encrypted via `L2-DB-16`, blank keeps) + `listSpeechModels` (auth-gate → decrypt → fetch → `{ok, models}`). Satisfies `L2-SPEECH-02`, `L2-SPEECH-04`.
- `settings/_components/speech-integration.tsx` — pane: header (Dg tile · chip · status · Enabled), masked key input (type="text" + `-webkit-text-security` — Chrome-autofill defence, same as ai/email), STT + TTS `ModelSelect`s, catalog panel with kind badges. `useSpeechModels(hasKey)`: no key → empty + disabled (no static fallback by design, `L2-SPEECH-06`); key → live fetch. Satisfies `L2-SPEECH-03`.
- `integrations-view.tsx` / `integrations-rail.tsx` / `page.tsx` — fourth ListRow ("Speech", Dg tile), rail About entry (docs + console.deepgram.com links), server load of the row with `keyPreview`.

## Notes
- API shape verified against Deepgram OpenAPI (`GET /v1/models`, no query params needed; `include_outdated` exists but unused).
- Key format not validated locally — Deepgram keys have no stable prefix; the live models fetch is the validity check.
- `languages` returned per model but not yet rendered — available if a language picker is ever wanted.

## TODO
- No call sites yet: transcription/TTS features would consume `speech_config` defaults.
