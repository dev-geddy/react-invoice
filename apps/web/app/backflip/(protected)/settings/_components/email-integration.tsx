"use client"

import { useActionState } from "react"

import { Button } from "@workspace/ui/components/button"
import { Field, FieldLabel } from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import { Switch } from "@workspace/ui/components/switch"
import { cn } from "@workspace/ui/lib/utils"

import { saveEmailConfig } from "../_actions"
import { type EmailConfig } from "./email-config-form"

/**
 * Email (Resend) integration detail (design 2a) — single-config pane: a header
 * (logo tile · mono chip · connected status · Enabled toggle) over the
 * credentials form (masked key, from-address, from-name, reply-to). Reuses
 * `saveEmailConfig`. Key stays masked (no Reveal); sending-domain verification
 * is omitted (no backend).
 */
export function EmailIntegration({
  email,
  connected,
}: {
  email: EmailConfig
  connected: boolean
}) {
  const [state, action, pending] = useActionState(saveEmailConfig, null)

  return (
    <div className="p-5">
      <form action={action} className="flex flex-col gap-5">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="flex size-11 flex-none items-center justify-center rounded-xl border bg-muted font-mono text-sm font-semibold">
            Re
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold">Resend</span>
              <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
                resend
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
              Transactional email
            </div>
          </div>
          <label className="flex flex-none items-center gap-2">
            <span className="text-xs text-muted-foreground">Enabled</span>
            <Switch name="enabled" defaultChecked={email.enabled} />
          </label>
        </div>

        <div className="h-px bg-border" />

        {/* Credentials */}
        <div>
          <div className="text-[13px] font-semibold">Credentials</div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            Keys are encrypted at rest and never exposed to the client.
          </div>
        </div>

        <div className="flex max-w-xl flex-col gap-4">
          <Field>
            <FieldLabel htmlFor="resend-key">API key</FieldLabel>
            {/* type="text" + CSS masking, NOT type="password": a password input
                makes Chrome treat the form as a login form and prefill saved
                admin credentials into it. */}
            <Input
              id="resend-key"
              name="apiKey"
              type="text"
              autoComplete="off"
              spellCheck={false}
              data-1p-ignore
              data-lpignore="true"
              className="[-webkit-text-security:disc]"
              placeholder={
                email.keyPreview
                  ? `${email.keyPreview} — leave blank to keep`
                  : "re_…"
              }
            />
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="resend-from-email">
                Default from address
              </FieldLabel>
              <Input
                id="resend-from-email"
                name="fromEmail"
                type="email"
                autoComplete="off"
                className="font-mono"
                placeholder="no-reply@example.com"
                defaultValue={email.fromEmail}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="resend-from-name">From name</FieldLabel>
              <Input
                id="resend-from-name"
                name="fromName"
                autoComplete="off"
                placeholder="Backflip"
                defaultValue={email.fromName}
              />
            </Field>
          </div>

          <Field>
            <FieldLabel htmlFor="resend-reply-to">
              Reply-to{" "}
              <span className="font-normal text-muted-foreground">
                (optional)
              </span>
            </FieldLabel>
            <Input
              id="resend-reply-to"
              name="replyTo"
              type="email"
              autoComplete="off"
              className="font-mono"
              placeholder="support@example.com"
              defaultValue={email.replyTo}
            />
          </Field>
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
    </div>
  )
}
