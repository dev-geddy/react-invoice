import { notFound, redirect } from "next/navigation"

import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert"
import { Card } from "@workspace/ui/components/card"

import { requireCapability } from "@/app/_lib/auth/guard"
import { validateAuthorizationRequest } from "@/app/_lib/oauth/authorize"
import { isMcpEnabled } from "@/app/_lib/oauth/config"
import { grantableScopes } from "@/app/_lib/oauth/scopes"
import type { OAuthFailure } from "@/app/_lib/oauth/types"
import { PageHeading } from "../_components/page-heading"
import { ConsentForm } from "./_components/consent-form"

/** Friendlier headline per RFC 6749 error code; falls back to a generic one. */
const ERROR_TITLES: Partial<Record<OAuthFailure["error"], string>> = {
  invalid_client: "Unknown client",
  invalid_request: "Invalid request",
  unauthorized_client: "Client not authorized",
  invalid_scope: "Invalid scope",
  server_error: "Something went wrong",
}

/**
 * `/backflip/connect` — OAuth 2.1 consent screen (`L2-MCP-13`, `L2-MCP-14`).
 * Lives inside `(protected)`; the edge gate already routes an unauthenticated
 * visitor through `/backflip/login?from=…` and back (`L2-AUTH-01`), so only the
 * `account` capability is checked here. The incoming query params — forwarded
 * by `/api/oauth/authorize` — are re-validated from scratch, never trusted.
 */
export default async function ConnectPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  if (!(await isMcpEnabled())) notFound()

  const sessionUser = await requireCapability("account")

  const rawSearchParams = await searchParams
  const rawParams: Record<string, string> = {}
  const usp = new URLSearchParams()
  for (const [key, value] of Object.entries(rawSearchParams)) {
    if (typeof value === "string") {
      rawParams[key] = value
      usp.set(key, value)
    }
  }

  const result = await validateAuthorizationRequest(usp)

  if (!result.ok) {
    // Fatal: unknown client / unregistered redirect URI — never redirect to a
    // client-supplied URI we haven't validated (`L2-MCP-31`). Render here.
    if (result.fatal) return <ErrorCard failure={result.failure} />

    // Non-fatal: the redirect URI itself checked out, so RFC 6749 says report
    // the error back to the client instead of showing it on our origin.
    const url = new URL(result.redirectUri)
    url.searchParams.set("error", result.failure.error)
    if (result.failure.description) {
      url.searchParams.set("error_description", result.failure.description)
    }
    if (result.state) url.searchParams.set("state", result.state)
    redirect(url.toString())
  }

  const { request } = result
  const granted = grantableScopes(sessionUser.role ?? "teammate")
  const allowedScopes = request.scopes.filter((s) => granted.includes(s))
  const deniedScopes = request.scopes.filter((s) => !granted.includes(s))

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-6 p-6 lg:p-8">
      <PageHeading
        title="Authorize connector"
        description="Review what this app can access before continuing."
      />
      <Card className="p-6">
        <ConsentForm
          clientName={request.clientName}
          email={sessionUser.email ?? ""}
          allowedScopes={allowedScopes}
          deniedScopes={deniedScopes}
          rawParams={rawParams}
        />
      </Card>
    </div>
  )
}

/**
 * Plain, self-contained error card for a fatal authorize failure. Our origin
 * only — this path is never reached with a validated client-supplied URI to
 * redirect to (`L2-MCP-31`, `L2-MCP-40`).
 */
function ErrorCard({ failure }: { failure: OAuthFailure }) {
  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-6 p-6 lg:p-8">
      <PageHeading title="Can't authorize this connector" />
      <Card className="flex flex-col gap-3 p-6">
        <Alert variant="destructive">
          <AlertTitle>
            {ERROR_TITLES[failure.error] ?? "Request rejected"}
          </AlertTitle>
          <AlertDescription>
            {failure.description ??
              "This authorization request couldn't be validated."}
          </AlertDescription>
        </Alert>
        <p className="text-xs text-muted-foreground">
          This usually means the connector’s client id or redirect address is
          invalid or unregistered. Go back to the app you were connecting from
          and try again.
        </p>
      </Card>
    </div>
  )
}
