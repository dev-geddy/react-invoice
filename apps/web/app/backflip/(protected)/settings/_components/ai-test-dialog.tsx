"use client"

import { useEffect, useRef, useState } from "react"

import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { Field, FieldLabel } from "@workspace/ui/components/field"
import { Kbd, KbdGroup } from "@workspace/ui/components/kbd"
import { NativeSelect } from "@workspace/ui/components/native-select"
import { Textarea } from "@workspace/ui/components/textarea"
import { cn } from "@workspace/ui/lib/utils"

import { useProviderModels } from "../_hooks/use-provider-models"
import { LABEL, type ProviderConfig } from "./ai-config-form"
import { Markdown } from "../../_components/markdown"

/** Mirrors the server-side cap in `_lib/ai-test.ts` (`L2-AI-16`). */
const MAX_PROMPT_CHARS = 4000

/**
 * Live AI test modal (`@spec L2-AI-15`): pick an enabled provider → a model →
 * write a prompt → stream the answer back and render it as markdown in the
 * same dialog.
 *
 * Only providers that are enabled *and* have a saved key can be picked; the
 * route re-checks that server-side (`L2-AI-17`).
 */
export function AiTestDialog({
  providers,
  open,
  onOpenChange,
}: {
  providers: ProviderConfig[]
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const testable = providers.filter((p) => p.enabled && p.keyPreview)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] w-[calc(100%-2rem)] gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="border-b px-5 py-4">
          <DialogTitle>Test AI integration</DialogTitle>
          <DialogDescription>
            Send a prompt to a connected provider and see the raw answer.
          </DialogDescription>
        </DialogHeader>
        {/* Unmounted while closed, so a previous run's answer never lingers. */}
        {open ? <TestForm testable={testable} /> : null}
      </DialogContent>
    </Dialog>
  )
}

type Status = "idle" | "thinking" | "streaming" | "error"

function TestForm({ testable }: { testable: ProviderConfig[] }) {
  const [provider, setProvider] = useState<ProviderConfig["provider"] | "">(
    () =>
      testable.find((p) => p.isDefault)?.provider ?? testable[0]?.provider ?? ""
  )
  const cfg = testable.find((p) => p.provider === provider)
  // Lives here, not in the runner: switching provider remounts the runner to
  // reset its model + answer, and the prompt the user typed should survive it.
  const [prompt, setPrompt] = useState("")

  if (!cfg) {
    return (
      <div className="px-5 py-8 text-center text-sm text-muted-foreground">
        No provider is ready to test yet. Save an API key and enable a provider
        first.
      </div>
    )
  }

  return (
    <TestRunner
      key={cfg.provider}
      cfg={cfg}
      testable={testable}
      onProviderChange={setProvider}
      prompt={prompt}
      onPromptChange={setPrompt}
    />
  )
}

function TestRunner({
  cfg,
  testable,
  onProviderChange,
  prompt,
  onPromptChange,
}: {
  cfg: ProviderConfig
  testable: ProviderConfig[]
  onProviderChange: (provider: ProviderConfig["provider"]) => void
  prompt: string
  onPromptChange: (prompt: string) => void
}) {
  const { models, loading } = useProviderModels(cfg)
  const [model, setModel] = useState(cfg.model)
  const [status, setStatus] = useState<Status>("idle")
  const [answer, setAnswer] = useState("")
  const [error, setError] = useState("")
  const abortRef = useRef<AbortController | null>(null)
  const answerRef = useRef<HTMLDivElement>(null)

  const busy = status === "thinking" || status === "streaming"

  // Abort an in-flight run if the dialog closes or the provider switches.
  useEffect(() => () => abortRef.current?.abort(), [])

  // Follow the answer as it streams in.
  useEffect(() => {
    const el = answerRef.current
    if (el && status === "streaming") el.scrollTop = el.scrollHeight
  }, [answer, status])

  async function run() {
    if (busy || !prompt.trim() || !model) return

    const controller = new AbortController()
    abortRef.current = controller
    setStatus("thinking")
    setAnswer("")
    setError("")

    try {
      const res = await fetch("/api/backflip/ai/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: cfg.provider,
          model,
          prompt: prompt.trim(),
        }),
        signal: controller.signal,
      })

      if (!res.ok || !res.body) {
        const body = await res.json().catch(() => null)
        setError(
          (body as { message?: string } | null)?.message ??
            "The request failed. Try again."
        )
        setStatus("error")
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let text = ""
      setStatus("streaming")
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        text += decoder.decode(value, { stream: true })
        setAnswer(text)
      }
      setStatus("idle")
    } catch {
      if (controller.signal.aborted) return
      setError("Could not reach the server. Try again.")
      setStatus("error")
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault()
      void run()
    }
  }

  return (
    <div className="flex max-h-[calc(85vh-5.5rem)] flex-col gap-4 overflow-y-auto px-5 py-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="test-provider">Provider</FieldLabel>
          <NativeSelect
            id="test-provider"
            value={cfg.provider}
            disabled={busy}
            onChange={(e) =>
              onProviderChange(e.target.value as ProviderConfig["provider"])
            }
          >
            {testable.map((p) => (
              <option key={p.provider} value={p.provider}>
                {LABEL[p.provider]}
              </option>
            ))}
          </NativeSelect>
        </Field>

        <Field>
          <FieldLabel htmlFor="test-model">Model</FieldLabel>
          <NativeSelect
            id="test-model"
            value={model}
            disabled={busy || loading}
            onChange={(e) => setModel(e.target.value)}
          >
            <option value="">
              {loading ? "Loading models…" : "Select a model…"}
            </option>
            {models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label === m.id ? m.id : `${m.label} — ${m.id}`}
              </option>
            ))}
          </NativeSelect>
        </Field>
      </div>

      <Field>
        <FieldLabel htmlFor="test-prompt">Prompt</FieldLabel>
        <Textarea
          id="test-prompt"
          value={prompt}
          disabled={busy}
          maxLength={MAX_PROMPT_CHARS}
          onChange={(e) => onPromptChange(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Ask something — the answer comes back as markdown."
          className="min-h-24"
        />
      </Field>

      <div className="flex items-center gap-3">
        <Button
          type="button"
          onClick={() => void run()}
          disabled={busy || !prompt.trim() || !model}
        >
          {busy ? "Running…" : "Send prompt"}
        </Button>
        <KbdGroup className="text-muted-foreground">
          <Kbd>⌘</Kbd>
          <Kbd>↵</Kbd>
          <span className="text-[11px]">to send</span>
        </KbdGroup>
        {status === "error" ? (
          <span className="text-sm text-destructive">{error}</span>
        ) : null}
      </div>

      <Response status={status} answer={answer} ref={answerRef} />
    </div>
  )
}

function Response({
  status,
  answer,
  ref,
}: {
  status: Status
  answer: string
  ref: React.Ref<HTMLDivElement>
}) {
  // Centered until there is markdown to render — both the placeholder and the
  // thinking indicator read better mid-box than pinned to the top corner.
  const empty = !answer

  return (
    <div
      ref={ref}
      className={cn(
        "max-h-80 min-h-40 overflow-y-auto rounded-lg border bg-muted/30 p-4 text-xs/relaxed",
        empty && "flex items-center justify-center"
      )}
    >
      {status === "thinking" ? (
        <Thinking />
      ) : answer ? (
        <div className="wrap-break-word">
          <Markdown>{answer}</Markdown>
        </div>
      ) : (
        <span className="text-sm text-muted-foreground">
          The response will appear here.
        </span>
      )}
    </div>
  )
}

/** Thinking animation — three dots pulsing out of phase. */
function Thinking() {
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <span className="flex items-center gap-1">
        {[0, 150, 300].map((delay) => (
          <span
            key={delay}
            className="size-1.5 animate-pulse rounded-full bg-muted-foreground/70"
            style={{ animationDelay: `${delay}ms` }}
          />
        ))}
      </span>
      Thinking…
    </div>
  )
}
