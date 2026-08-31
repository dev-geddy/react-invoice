import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"

import { SCOPE_LABELS } from "@/app/_lib/oauth/scopes"
import type { McpScope } from "@/app/_lib/oauth/types"
import { approveAuthorization, denyAuthorization } from "../_actions"

/**
 * Consent card body: client identity, requested scopes split into grantable
 * vs. not, and the Allow / Deny actions. Server component — no client
 * interactivity, just two forms that carry the raw `/api/oauth/authorize`
 * params through as hidden fields so the actions can re-validate everything
 * from scratch (`L2-MCP-13`).
 */
export function ConsentForm({
  clientName,
  email,
  allowedScopes,
  deniedScopes,
  rawParams,
}: {
  clientName: string
  email: string
  allowedScopes: McpScope[]
  deniedScopes: McpScope[]
  rawParams: Record<string, string>
}) {
  const canAllow = allowedScopes.length > 0
  const hiddenFields = Object.entries(rawParams).map(([key, value]) => (
    <input key={key} type="hidden" name={key} value={value} />
  ))

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3 rounded-lg border bg-muted/40 p-4">
        <div className="flex size-10 flex-none items-center justify-center rounded-lg border bg-card text-sm font-semibold">
          {clientName.slice(0, 2).toUpperCase()}
        </div>
        <div className="min-w-0">
          {/* `clientName` is attacker-controlled (dynamic client registration,
              `L2-MCP-12`) — rendered as plain text only, never as markup. */}
          <div className="truncate text-sm font-semibold">{clientName}</div>
          <div className="text-xs text-muted-foreground">
            wants to connect to your Backflip account
          </div>
        </div>
      </div>

      <div className="text-xs text-muted-foreground">
        Signed in as <span className="font-mono text-foreground">{email}</span>
      </div>

      <div className="flex flex-col gap-2">
        <div className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          This will allow access to
        </div>
        <div className="rounded-xl border bg-card">
          {allowedScopes.map((scope, i) => (
            <ScopeRow
              key={scope}
              scope={scope}
              last={i === allowedScopes.length - 1 && deniedScopes.length === 0}
            />
          ))}
          {deniedScopes.map((scope, i) => (
            <ScopeRow
              key={scope}
              scope={scope}
              grantable={false}
              last={i === deniedScopes.length - 1}
            />
          ))}
        </div>
      </div>

      {!canAllow ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
          Your account’s role doesn’t grant any of the access this connector is
          requesting, so there’s nothing to allow. You can still deny the
          request below.
        </div>
      ) : null}

      <div className="flex items-center gap-3">
        {canAllow ? (
          <form action={approveAuthorization}>
            {hiddenFields}
            <Button type="submit">Allow</Button>
          </form>
        ) : null}
        <form action={denyAuthorization}>
          {hiddenFields}
          <Button type="submit" variant="outline">
            Deny
          </Button>
        </form>
      </div>
    </div>
  )
}

function ScopeRow({
  scope,
  grantable = true,
  last,
}: {
  scope: McpScope
  grantable?: boolean
  last?: boolean
}) {
  const label = SCOPE_LABELS[scope]
  return (
    <div
      className={cn(
        "flex items-start gap-3 p-4",
        !last && "border-b",
        !grantable && "opacity-50"
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium">{label.title}</div>
        <div className="text-xs text-muted-foreground">{label.description}</div>
        {!grantable ? (
          <div className="mt-1 text-xs font-medium text-muted-foreground">
            Your role can’t grant this
          </div>
        ) : null}
      </div>
    </div>
  )
}
