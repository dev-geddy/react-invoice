"use client"

import { useActionState } from "react"

import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert"
import { Button } from "@workspace/ui/components/button"
import { Switch } from "@workspace/ui/components/switch"

import { setConnectorEnabled } from "../_actions"

/**
 * Owner-facing master switch for the MCP connector (`L2-MCP-25`). The switch
 * always reflects `connector_config.enabled` — the owner's stored intent —
 * not whether the connector is actually reachable right now: those two can
 * disagree while `isMcpForcedOff()` is vetoing it (`L2-MCP-37`), which is
 * exactly the case this component calls out instead of hiding.
 *
 * Submits through `setConnectorEnabled`, matching the Enabled-toggle-in-a-form
 * pattern the AI / Email / Speech tabs already use for their own `enabled`
 * flags — no new affordance invented here.
 */
export function ConnectorEnable({
  enabled,
  forcedOff,
}: {
  enabled: boolean
  forcedOff: boolean
}) {
  const [state, action, pending] = useActionState(setConnectorEnabled, null)

  return (
    <form action={action} className="flex flex-col gap-3 rounded-xl border p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-sm font-medium">Enable connector</div>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Turning this on exposes an authenticated, read-only MCP endpoint
            that a Claude client can connect to. You still create and manage
            OAuth clients below — nobody can connect until you&rsquo;ve added
            one — and no account data is reachable until a signed-in user
            completes the OAuth consent flow for that client.
          </p>
        </div>
        <label className="flex flex-none items-center gap-2 pt-0.5">
          <span className="text-xs text-muted-foreground">Enabled</span>
          <Switch
            name="enabled"
            defaultChecked={enabled}
            disabled={forcedOff}
          />
        </label>
      </div>

      {forcedOff ? (
        <Alert variant="destructive">
          <AlertTitle>Forced off by the deployment</AlertTitle>
          <AlertDescription>
            <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px] text-foreground">
              MCP_ENABLED=false
            </code>{" "}
            is set in this deployment&rsquo;s environment and overrides this
            setting no matter what it&rsquo;s toggled to here. Remove or change
            that variable and restart the deployment before the connector can be
            turned on.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="flex items-center gap-3">
        <Button type="submit" size="sm" disabled={pending || forcedOff}>
          {pending ? "Saving…" : "Save changes"}
        </Button>
        {state && !state.ok ? (
          <span className="text-sm text-destructive">{state.message}</span>
        ) : null}
      </div>
    </form>
  )
}
