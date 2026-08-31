import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"

import { SCOPE_LABELS } from "@/app/_lib/oauth/scopes"
import type { OAuthGrant } from "@/app/_lib/oauth/types"
import { disconnectConnection } from "../../connect/_actions"
import { SectionLabel } from "../../_components/page-heading"

const DATE_FMT = new Intl.DateTimeFormat("en-US", { dateStyle: "medium" })

/** Plain-language scope summary — `SCOPE_LABELS` titles, not the wire form. */
function scopeSummary(scopes: OAuthGrant["scopes"]) {
  return scopes.map((s) => SCOPE_LABELS[s].title).join(", ")
}

/**
 * Connected-clients section (`L2-MCP-17`) — the user's standing OAuth grants:
 * client name, granted scopes in plain language, connected date, last used.
 * Each row has a Disconnect action, always scoped server-side to the signed-in
 * user (`connect/_actions.ts#disconnectConnection`, `L2-AUTH-27`). Presentation
 * only — `grants` is fetched by the page (`isMcpEnabled` gates whether this is
 * mounted at all, `L2-MCP-37`).
 */
export function ConnectionsSection({ grants }: { grants: OAuthGrant[] }) {
  return (
    <div className="flex flex-col gap-3">
      <SectionLabel>Connected apps</SectionLabel>
      <div className="rounded-xl border bg-card">
        {grants.length === 0 ? (
          <div className="p-4 text-sm text-muted-foreground">
            No connectors are linked. A connector is a third-party app — like
            Claude — that you’ve authorized to access your account through the
            Backflip API.
          </div>
        ) : (
          grants.map((grant, i) => (
            <div
              key={grant.clientId}
              className={cn(
                "flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between",
                i !== grants.length - 1 && "border-b"
              )}
            >
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">
                  {grant.clientName}
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {scopeSummary(grant.scopes)}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Connected {DATE_FMT.format(grant.connectedAt)}
                  <span className="text-muted-foreground/50"> · </span>
                  Last used{" "}
                  {grant.lastUsedAt
                    ? DATE_FMT.format(grant.lastUsedAt)
                    : "never"}
                </div>
              </div>
              <form action={disconnectConnection} className="flex-none">
                <input type="hidden" name="clientId" value={grant.clientId} />
                <Button type="submit" variant="outline" size="sm">
                  Disconnect
                </Button>
              </form>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
