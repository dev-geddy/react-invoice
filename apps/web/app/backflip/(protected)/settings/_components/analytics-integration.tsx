"use client"

import { useActionState, useState } from "react"

import { Button } from "@workspace/ui/components/button"
import {
  Field,
  FieldDescription,
  FieldLabel,
} from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import { Switch } from "@workspace/ui/components/switch"
import { Textarea } from "@workspace/ui/components/textarea"
import { cn } from "@workspace/ui/lib/utils"

import { saveAnalyticsConfig } from "../_actions"

export type AnalyticsConfig = {
  measurementId: string
  cookieBannerEnabled: boolean
  cookieBannerText: string
}

/**
 * Google Analytics integration detail — measurement id (public, unmasked) plus
 * the cookie-banner switch and its copy. The banner exists only to gate
 * analytics, so its fields are disabled while it is off; with it off, GA loads
 * for every visitor.
 */
export function AnalyticsIntegration({
  analytics,
  connected,
}: {
  analytics: AnalyticsConfig
  connected: boolean
}) {
  const [state, action, pending] = useActionState(saveAnalyticsConfig, null)
  const [bannerEnabled, setBannerEnabled] = useState(
    analytics.cookieBannerEnabled
  )

  return (
    <div className="p-5">
      <form action={action} className="flex flex-col gap-5">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="flex size-11 flex-none items-center justify-center rounded-xl border bg-muted font-mono text-sm font-semibold">
            GA
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold">Google Analytics</span>
              <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
                gtag.js
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
              Public pages only
            </div>
          </div>
        </div>

        <div className="h-px bg-border" />

        {/* Tag */}
        <div>
          <div className="text-[13px] font-semibold">Tag</div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            The measurement ID is public — it ships to every visitor, so it is
            stored unencrypted.
          </div>
        </div>

        <div className="flex max-w-xl flex-col gap-4">
          <Field>
            <FieldLabel htmlFor="ga-measurement-id">Measurement ID</FieldLabel>
            <Input
              id="ga-measurement-id"
              name="measurementId"
              autoComplete="off"
              spellCheck={false}
              className="font-mono"
              placeholder="G-XXXXXXXXXX"
              defaultValue={analytics.measurementId}
            />
            <FieldDescription>
              Leave blank to switch analytics off. Nothing loads on the public
              site without an ID — not even the cookie banner.
            </FieldDescription>
          </Field>
        </div>

        <div className="h-px bg-border" />

        {/* Consent */}
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-semibold">Cookie banner</div>
            <div className="mt-0.5 text-xs text-muted-foreground">
              {bannerEnabled
                ? "Analytics stays off until a visitor accepts. The choice is remembered in their browser."
                : "Off — analytics loads for every visitor, with no consent prompt."}
            </div>
          </div>
          <label className="flex flex-none items-center gap-2">
            <span className="text-xs text-muted-foreground">Enabled</span>
            <Switch
              name="cookieBannerEnabled"
              checked={bannerEnabled}
              onCheckedChange={setBannerEnabled}
            />
          </label>
        </div>

        <div className="flex max-w-xl flex-col gap-4">
          <Field>
            <FieldLabel htmlFor="ga-banner-text">Banner text</FieldLabel>
            {/* readOnly, not disabled — a disabled field submits nothing, which
                would wipe the saved copy whenever the banner is toggled off. */}
            <Textarea
              id="ga-banner-text"
              name="cookieBannerText"
              rows={3}
              readOnly={!bannerEnabled}
              aria-disabled={!bannerEnabled}
              className={cn(!bannerEnabled && "opacity-50")}
              defaultValue={analytics.cookieBannerText}
            />
            <FieldDescription>
              Shown above the Accept and Decline buttons.
            </FieldDescription>
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
