"use client"

import { useActionState, useEffect, useState } from "react"

import { Button } from "@workspace/ui/components/button"
import { Field, FieldLabel } from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import { NativeSelect } from "@workspace/ui/components/native-select"
import { Switch } from "@workspace/ui/components/switch"
import { cn } from "@workspace/ui/lib/utils"

import { listSpeechModels, saveSpeechConfig } from "../_actions"
import { SectionLabel } from "../../_components/page-heading"

export type SpeechConfig = {
  sttModel: string
  ttsModel: string
  enabled: boolean
  keyPreview: string | null
}

type SpeechModel = {
  id: string
  label: string
  kind: "stt" | "tts"
  languages: string[]
}

/**
 * Live STT + TTS model catalog from Deepgram via `listSpeechModels`. There is
 * no static fallback: with no key nothing is shown, and a hardcoded list would
 * only ever be stale.
 */
function useSpeechModels(hasKey: boolean) {
  const [models, setModels] = useState<SpeechModel[]>([])
  const [loading, setLoading] = useState(hasKey)

  useEffect(() => {
    if (!hasKey) return
    let cancelled = false
    setLoading(true)
    listSpeechModels()
      .then((res) => {
        if (!cancelled && res.ok) setModels(res.models)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [hasKey])

  return { models, loading }
}

function ModelSelect({
  id,
  name,
  label,
  saved,
  options,
  hasKey,
  loading,
}: {
  id: string
  name: string
  label: string
  saved: string
  options: SpeechModel[]
  hasKey: boolean
  loading: boolean
}) {
  // Keep the saved model selectable even if the live list doesn't include it.
  const opts =
    saved && !options.some((m) => m.id === saved)
      ? [
          { id: saved, label: saved, kind: "stt" as const, languages: [] },
          ...options,
        ]
      : options
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <NativeSelect
        id={id}
        name={name}
        defaultValue={saved}
        disabled={loading || !hasKey}
      >
        <option value="">
          {!hasKey
            ? "Save an API key to load models…"
            : loading
              ? "Loading models…"
              : "Select a model…"}
        </option>
        {opts.map((m) => (
          <option key={m.id} value={m.id}>
            {m.label === m.id ? m.id : `${m.label} — ${m.id}`}
          </option>
        ))}
      </NativeSelect>
    </Field>
  )
}

/**
 * Speech (Deepgram) integration detail (design 2a) — single-config pane: a
 * header (logo tile · mono chip · connected status · Enabled toggle) over the
 * credentials form (masked key, default STT model, default TTS voice) and the
 * live model catalog. Reuses the ai-pane conventions: no key → selects
 * disabled and no model list; key saved → live catalog from Deepgram.
 *
 * @spec L2-SPEECH-03
 */
export function SpeechIntegration({
  speech,
  connected,
}: {
  speech: SpeechConfig
  connected: boolean
}) {
  const [state, action, pending] = useActionState(saveSpeechConfig, null)
  const hasKey = Boolean(speech.keyPreview)
  const { models, loading } = useSpeechModels(hasKey)
  const stt = models.filter((m) => m.kind === "stt")
  const tts = models.filter((m) => m.kind === "tts")

  return (
    <div className="flex flex-col gap-5 p-5">
      <form action={action} className="flex flex-col gap-5">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="flex size-11 flex-none items-center justify-center rounded-xl border bg-muted font-mono text-sm font-semibold">
            Dg
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold">Deepgram</span>
              <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
                deepgram
              </span>
            </div>
            <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
              <span
                className={cn(
                  "size-1.5 rounded-full",
                  connected ? "bg-emerald-500" : "bg-muted-foreground/30"
                )}
              />
              {connected ? "Connected" : "Not connected"}
              <span className="text-muted-foreground/50">·</span>
              Speech-to-text &amp; text-to-speech
            </div>
          </div>
          <label className="flex flex-none items-center gap-2">
            <span className="text-xs text-muted-foreground">Enabled</span>
            <Switch name="enabled" defaultChecked={speech.enabled} />
          </label>
        </div>

        <div className="h-px bg-border" />

        {/* Credentials + models */}
        <div className="flex max-w-md flex-col gap-4">
          <Field>
            <FieldLabel htmlFor="deepgram-key">API key</FieldLabel>
            {/* type="text" + CSS masking, NOT type="password": a password input
                makes Chrome treat the form as a login form and prefill saved
                admin credentials into it. */}
            <Input
              id="deepgram-key"
              name="apiKey"
              type="text"
              autoComplete="off"
              spellCheck={false}
              data-1p-ignore
              data-lpignore="true"
              className="[-webkit-text-security:disc]"
              placeholder={
                speech.keyPreview
                  ? `${speech.keyPreview} — leave blank to keep`
                  : "Paste API key"
              }
            />
          </Field>

          <ModelSelect
            id="deepgram-stt-model"
            name="sttModel"
            label="Default speech-to-text model"
            saved={speech.sttModel}
            options={stt}
            hasKey={hasKey}
            loading={loading}
          />
          <ModelSelect
            id="deepgram-tts-model"
            name="ttsModel"
            label="Default text-to-speech voice"
            saved={speech.ttsModel}
            options={tts}
            hasKey={hasKey}
            loading={loading}
          />
        </div>

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save changes"}
          </Button>
          {state && !state.ok ? (
            <span className="text-sm text-destructive">{state.message}</span>
          ) : null}
        </div>
      </form>

      {/* Model catalog — only once a key is saved; there is no static list. */}
      {hasKey ? (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <SectionLabel>Available models</SectionLabel>
            <span className="text-[11px] text-muted-foreground">
              {loading
                ? "fetching from Deepgram…"
                : models.length > 0
                  ? "live from Deepgram API"
                  : "Deepgram API unreachable"}
            </span>
          </div>
          {models.length > 0 ? (
            <div className="max-h-72 divide-y overflow-y-auto rounded-lg border">
              {models.map((m) => (
                <div
                  key={`${m.kind}-${m.id}`}
                  className="flex items-center justify-between gap-3 px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <span className="font-mono text-xs">{m.id}</span>
                    {m.label !== m.id ? (
                      <span className="ml-2 text-xs text-muted-foreground">
                        {m.label}
                      </span>
                    ) : null}
                  </div>
                  <span className="flex-none rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] tracking-wide text-muted-foreground uppercase">
                    {m.kind}
                  </span>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
