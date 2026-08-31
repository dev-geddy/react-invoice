import crypto from "node:crypto"

import {
  expect,
  test,
  type APIRequestContext,
  type Page,
} from "@playwright/test"
import pg from "pg"

import { BASE_URL, OWNER, TEAMMATE, TEST_DATABASE_URL } from "./env"

/**
 * End-to-end proof of the Claude-compatible MCP connector: the OAuth 2.1
 * authorization server (`/api/oauth/*`, `/.well-known/*`) and the Streamable
 * HTTP resource server (`/api/mcp`) it protects, against a real running app
 * and a real (seeded) `backflip_test` database.
 *
 * Enablement is DB-driven (`connector_config.enabled`, `L2-MCP-25`), not
 * `MCP_ENABLED` — `global-setup.ts` seeds that row (`enabled: true`,
 * `dcrMode: "open"`) before any test runs, and waits for the running app to
 * actually be serving from it (its enabled-flag read is cached in-process for
 * up to `CONNECTOR_SETTINGS_CACHE_TTL_MS`). `dcrMode: "open"` is what lets
 * most of this suite keep using Dynamic Client Registration
 * (`POST /api/oauth/register`, via `registerClient` below) to stand up
 * throwaway public clients per test; the dedicated DCR-off coverage flips
 * that row for the duration of one test only. `AUTH_URL` is set to this
 * suite's own origin in `webServer.env` in `playwright.config.ts` rather than
 * any `.env` file, so the issuer never leaks into a normal dev run.
 *
 * @spec L2-MCP-42, L2-MCP-43, L2-MCP-44, L2-MCP-45, L2-MCP-46, L2-MCP-53,
 *       L2-MCP-54, L2-MCP-03
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Same-origin path that no app route answers — good enough as a redirect
 *  target we only ever want to *observe*, never actually load (`L2-MCP-31`
 *  requires `redirect_uri` to be pre-registered, so it must be a real,
 *  reachable-looking URL, not a bogus scheme). */
const REDIRECT_URI = `${BASE_URL}/__e2e_oauth_callback__`

type Account = { email: string; password: string }

type TokenResponse = {
  access_token: string
  refresh_token: string
  token_type: string
  expires_in: number
  scope: string
}

function generatePkce(): { verifier: string; challenge: string } {
  // 32 random bytes -> 43-char base64url string, right at RFC 7636's minimum.
  const verifier = crypto.randomBytes(32).toString("base64url")
  const challenge = crypto
    .createHash("sha256")
    .update(verifier)
    .digest("base64url")
  return { verifier, challenge }
}

async function registerClient(
  request: APIRequestContext,
  clientName: string
): Promise<{ clientId: string }> {
  const response = await request.post("/api/oauth/register", {
    data: { client_name: clientName, redirect_uris: [REDIRECT_URI] },
  })
  expect(response.status(), await response.text()).toBe(201)
  const body = await response.json()
  expect(body.token_endpoint_auth_method).toBe("none")
  return { clientId: body.client_id as string }
}

async function login(page: Page, account: Account): Promise<void> {
  await page.goto("/backflip/login")
  await page.getByLabel("Email").fill(account.email)
  await page.getByLabel("Password").fill(account.password)
  await page.getByRole("button", { name: "Sign in" }).click()
  await expect(page).toHaveURL("/backflip")
}

/**
 * Arms a network interceptor for `REDIRECT_URI` and resolves with the
 * captured URL the instant something tries to reach it — a full navigation
 * or a client-side one, `page.route` catches both, and neither ever actually
 * reaches the network (nothing answers that path). Must be called BEFORE
 * whatever triggers the redirect (e.g. before clicking Allow).
 */
function captureRedirect(page: Page): Promise<URL> {
  return new Promise<URL>((resolve) => {
    void page.route(`${REDIRECT_URI}**`, async (route) => {
      const url = new URL(route.request().url())
      await route.fulfill({
        status: 200,
        contentType: "text/plain",
        body: "captured",
      })
      resolve(url)
    })
  })
}

/**
 * Drive `/api/oauth/authorize` -> `/backflip/connect` -> Allow, and capture
 * the redirect back to `REDIRECT_URI` (see `captureRedirect`). Assumes the
 * page is already authenticated — callers that need to exercise the
 * logged-out path drive the navigation themselves (see the regression test
 * for the proxy's `from` param below).
 */
async function authorizeAndApprove(
  page: Page,
  opts: {
    clientId: string
    challenge: string
    state: string
    scope?: string
    resource?: string
    onConsentScreen?: () => Promise<void>
  }
): Promise<URL> {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: opts.clientId,
    redirect_uri: REDIRECT_URI,
    code_challenge: opts.challenge,
    code_challenge_method: "S256",
    state: opts.state,
  })
  if (opts.scope) params.set("scope", opts.scope)
  if (opts.resource) params.set("resource", opts.resource)

  const captured = captureRedirect(page)

  await page.goto(`/api/oauth/authorize?${params.toString()}`)
  await expect(page).toHaveURL(/\/backflip\/connect\?/)

  if (opts.onConsentScreen) await opts.onConsentScreen()

  await page.getByRole("button", { name: "Allow" }).click()
  return captured
}

/**
 * Full DCR -> login -> consent -> Allow dance, stopping right after the code
 * lands in the captured redirect. Kept separate from token exchange so tests
 * that need to exchange (or replay) the code themselves can do so explicitly.
 */
type OAuthFlowOptions = {
  clientName: string
  scope?: string
  resource?: string
  onConsentScreen?: () => Promise<void>
}

async function obtainAuthorizationCode(
  page: Page,
  request: APIRequestContext,
  account: Account,
  opts: OAuthFlowOptions
): Promise<{ clientId: string; code: string; verifier: string }> {
  const { clientId } = await registerClient(request, opts.clientName)
  const { verifier, challenge } = generatePkce()
  const state = crypto.randomBytes(8).toString("hex")

  await login(page, account)
  const redirect = await authorizeAndApprove(page, {
    clientId,
    challenge,
    state,
    scope: opts.scope,
    resource: opts.resource,
    onConsentScreen: opts.onConsentScreen,
  })

  expect(redirect.searchParams.get("error")).toBeNull()
  expect(redirect.searchParams.get("state")).toBe(state)
  const code = redirect.searchParams.get("code")
  expect(code).toBeTruthy()

  return { clientId, code: code as string, verifier }
}

function exchangeCode(
  request: APIRequestContext,
  input: { clientId: string; code: string; verifier: string }
) {
  return request.post("/api/oauth/token", {
    form: {
      grant_type: "authorization_code",
      code: input.code,
      redirect_uri: REDIRECT_URI,
      client_id: input.clientId,
      code_verifier: input.verifier,
    },
  })
}

function refreshGrant(
  request: APIRequestContext,
  input: { clientId: string; refreshToken: string }
) {
  return request.post("/api/oauth/token", {
    form: {
      grant_type: "refresh_token",
      refresh_token: input.refreshToken,
      client_id: input.clientId,
    },
  })
}

/** Register + login + consent + exchange, in one call — the common case. */
async function runOAuthFlow(
  page: Page,
  request: APIRequestContext,
  account: Account,
  opts: OAuthFlowOptions
): Promise<{ clientId: string; tokens: TokenResponse }> {
  const { clientId, code, verifier } = await obtainAuthorizationCode(
    page,
    request,
    account,
    opts
  )
  const response = await exchangeCode(request, { clientId, code, verifier })
  expect(response.status(), await response.text()).toBe(200)
  const tokens = (await response.json()) as TokenResponse
  return { clientId, tokens }
}

/** A JSON-RPC envelope over `/api/mcp`, Streamable HTTP style. Returns the
 *  raw response (for status/header assertions) alongside the parsed body,
 *  transparently unwrapping an `text/event-stream` response if the SDK opts
 *  into streaming for this exchange. */
async function mcpCall(
  request: APIRequestContext,
  accessToken: string | null,
  method: string,
  params?: Record<string, unknown>
) {
  const response = await request.post("/api/mcp", {
    headers: {
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    },
    data: { jsonrpc: "2.0", id: 1, method, params: params ?? {} },
  })

  const contentType = response.headers()["content-type"] ?? ""
  const text = await response.text()
  let body: {
    result?: {
      tools?: { name: string }[]
      structuredContent?: Record<string, unknown>
    }
    error?: { code: number; message: string }
  } | null = null

  if (text) {
    if (contentType.includes("text/event-stream")) {
      const dataLines = text
        .split("\n")
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice("data:".length).trim())
      const last = dataLines[dataLines.length - 1]
      body = last ? JSON.parse(last) : null
    } else {
      body = JSON.parse(text)
    }
  }

  return { response, body }
}

/** Directly bumps `tokenVersion`, exactly what `changePassword` does
 *  (`app/backflip/(protected)/account/_actions.ts`) — the harness-sanctioned
 *  stand-in for driving the password-change UI, so this test doesn't mutate
 *  the shared `OWNER` fixture's password out from under other spec files. */
async function bumpTokenVersion(email: string): Promise<void> {
  const client = new pg.Client({ connectionString: TEST_DATABASE_URL })
  await client.connect()
  try {
    await client.query(
      `update "user" set "tokenVersion" = "tokenVersion" + 1 where email = $1`,
      [email]
    )
  } finally {
    await client.end()
  }
}

/**
 * Direct-DB toggle of `connector_config.dcrMode` — used only by the DCR-off
 * coverage, which needs the row in a state global setup deliberately doesn't
 * seed (`"open"`). Unlike `enabled`, every reader of `dcrMode`
 * (`getConnectorSettings()`, used by the register route, the AS metadata
 * route and authorize) reads the row live, uncached, so this takes effect on
 * the very next request — no propagation wait needed, unlike the kill switch.
 */
async function setDcrMode(mode: "off" | "allowlist" | "open"): Promise<void> {
  const client = new pg.Client({ connectionString: TEST_DATABASE_URL })
  await client.connect()
  try {
    await client.query(
      `update "connector_config" set "dcrMode" = $1 where "kind" = 'mcp'`,
      [mode]
    )
  } finally {
    await client.end()
  }
}

/** Selects the "Connectors" row in `/backflip/settings`'s master list,
 *  landing on the `ConnectorsIntegration` detail pane. Caller must already be
 *  authenticated as an owner (`settings` capability) — a teammate never sees
 *  this page at all. */
async function openConnectorsTab(page: Page): Promise<void> {
  await page.goto("/backflip/settings")
  await page.getByRole("button", { name: "Connectors" }).click()
}

/**
 * Drives the "Add client" dialog end to end (`L2-MCP-50`): fills the form,
 * submits, reads the client id (and, unless `nativeClient`, the one-time
 * secret) off the reveal screen, acknowledges it, and closes. This is the
 * only way this suite creates a manual client — deliberately through the UI
 * rather than a direct insert, so it also proves the reveal-once secret flow
 * actually works (`L2-MCP-52`, `L2-MCP-53`).
 */
/**
 * Read one `ConnectorCopyField`'s value off the reveal screen by its label.
 *
 * Positional lookups (`code` nth(0)/nth(1)) silently pick the wrong field the
 * moment one is added — which is exactly what happened when the dialog grew a
 * "Remote MCP server URL" row above the credentials, handing the tests the MCP
 * URL as a client id. Anchor on the field's own copy button instead: the
 * component renders `<div><div>…<button aria-label="Copy {label}"></div><code>`.
 */
function revealedValue(page: Page, label: string) {
  return page
    .locator(`div:has(> div > button[aria-label="Copy ${label}"]) > code`)
    .first()
}

async function createManualClientViaUI(
  page: Page,
  opts: { clientName: string; redirectUri: string; nativeClient?: boolean }
): Promise<{ clientId: string; clientSecret: string | null }> {
  await openConnectorsTab(page)
  await page.getByRole("button", { name: "Add client" }).click()

  await page.getByLabel("Name").fill(opts.clientName)
  await page.getByLabel("Redirect URIs").fill(opts.redirectUri)
  if (opts.nativeClient) {
    await page.getByRole("checkbox", { name: /Native client/ }).check()
  }
  await page.getByRole("button", { name: "Create client" }).click()

  await expect(page.getByText(`${opts.clientName} created`)).toBeVisible()
  const clientId =
    (await revealedValue(page, "Client ID").textContent())?.trim() ?? ""
  const clientSecret = opts.nativeClient
    ? null
    : ((await revealedValue(page, "Client secret").textContent())?.trim() ??
      null)

  await page.getByRole("checkbox", { name: /saved/i }).check()
  await page.getByRole("button", { name: "Done" }).click()

  return { clientId, clientSecret }
}

/**
 * Exchange a code at the token endpoint with an explicit client-authentication
 * method (`L2-MCP-52`) — `exchangeCode` above always goes public/`none`, which
 * a confidential client's stored secret hash rejects.
 */
function exchangeCodeConfidential(
  request: APIRequestContext,
  input: {
    clientId: string
    code: string
    verifier: string
    secret?: string
    authMethod: "client_secret_post" | "client_secret_basic" | "none"
  }
) {
  const form: Record<string, string> = {
    grant_type: "authorization_code",
    code: input.code,
    redirect_uri: REDIRECT_URI,
    client_id: input.clientId,
    code_verifier: input.verifier,
  }
  const headers: Record<string, string> = {}

  if (input.authMethod === "client_secret_post" && input.secret) {
    form.client_secret = input.secret
  } else if (input.authMethod === "client_secret_basic" && input.secret) {
    const basic = Buffer.from(`${input.clientId}:${input.secret}`).toString(
      "base64"
    )
    headers.Authorization = `Basic ${basic}`
  }

  return request.post("/api/oauth/token", { form, headers })
}

/** Adds a host to the redirect allowlist through the settings UI, waiting on
 *  the form actually clearing (`L2-MCP-47`) — the add form gives no success
 *  toast, only a reset once `addRedirectHost` resolves. */
async function addAllowlistHostViaUI(page: Page, host: string): Promise<void> {
  await openConnectorsTab(page)
  const input = page.getByLabel("Add host")
  await input.fill(host)
  await page.getByRole("button", { name: "Add", exact: true }).click()
  await expect(input).toHaveValue("")
}

/** Removes a host from the redirect allowlist through the settings UI,
 *  waiting on the row's own success toast (`L2-MCP-49`). */
async function removeAllowlistHostViaUI(
  page: Page,
  host: string
): Promise<void> {
  await openConnectorsTab(page)
  await page.getByRole("button", { name: `Remove ${host}` }).click()
  await expect(page.getByText(`Removed ${host}.`)).toBeVisible()
}

/**
 * Flips the connector's owner-facing master switch through the settings UI
 * and waits for the underlying server action's response — not a fixed sleep
 * — before returning, since `ConnectorEnable` gives no success toast to key
 * off (only an error one). A no-op if the switch is already in the requested
 * state. `L2-MCP-25`, `L2-MCP-37`.
 */
async function setConnectorEnabledViaUI(
  page: Page,
  nextEnabled: boolean
): Promise<void> {
  await openConnectorsTab(page)
  const toggle = page.getByRole("switch", { name: "Enabled" })
  const isOn = (await toggle.getAttribute("aria-checked")) === "true"
  if (isOn === nextEnabled) return

  // Scoped to the switch's own <form>: when the connector is reachable,
  // `ConnectorRegistrationMode` renders its own "Save changes" button right
  // below `ConnectorEnable`'s, and an unscoped role query is ambiguous
  // between the two.
  const form = page.locator("form").filter({ has: toggle })
  await toggle.click()
  const [response] = await Promise.all([
    page.waitForResponse(
      (res) => res.request().method() === "POST" && res.status() < 400
    ),
    form.getByRole("button", { name: "Save changes" }).click(),
  ])
  expect(response.ok()).toBe(true)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe("Claude MCP connector", () => {
  test("discovery: well-known documents advertise a consistent issuer, endpoints and resource", async ({
    request,
  }) => {
    const asResponse = await request.get(
      "/.well-known/oauth-authorization-server"
    )
    expect(asResponse.status()).toBe(200)
    const asBody = await asResponse.json()
    expect(asBody.issuer).toBe(BASE_URL)
    expect(asBody.authorization_endpoint).toBe(
      `${BASE_URL}/api/oauth/authorize`
    )
    expect(asBody.token_endpoint).toBe(`${BASE_URL}/api/oauth/token`)
    expect(asBody.registration_endpoint).toBe(`${BASE_URL}/api/oauth/register`)
    expect(asBody.revocation_endpoint).toBe(`${BASE_URL}/api/oauth/revoke`)
    expect(asBody.code_challenge_methods_supported).toEqual(["S256"])
    // Public clients (`none`) plus the two confidential methods a manual web
    // client's secret can be presented with (`L2-MCP-52`).
    expect(asBody.token_endpoint_auth_methods_supported).toEqual([
      "none",
      "client_secret_post",
      "client_secret_basic",
    ])
    expect(asBody.grant_types_supported.sort()).toEqual(
      ["authorization_code", "refresh_token"].sort()
    )

    const prmResponse = await request.get(
      "/.well-known/oauth-protected-resource"
    )
    expect(prmResponse.status()).toBe(200)
    const prmBody = await prmResponse.json()
    expect(prmBody.resource).toBe(`${BASE_URL}/api/mcp`)
    expect(prmBody.authorization_servers).toEqual([BASE_URL])
    expect(prmBody.bearer_methods_supported).toEqual(["header"])

    const prmSuffixedResponse = await request.get(
      "/.well-known/oauth-protected-resource/api/mcp"
    )
    expect(prmSuffixedResponse.status()).toBe(200)
    const prmSuffixedBody = await prmSuffixedResponse.json()
    expect(prmSuffixedBody.resource).toBe(`${BASE_URL}/api/mcp`)
  })

  test("challenge: unauthenticated POST /api/mcp is 401 with a WWW-Authenticate challenge", async ({
    request,
  }) => {
    const { response } = await mcpCall(request, null, "tools/list")

    expect(response.status()).toBe(401)
    const challenge = response.headers()["www-authenticate"] ?? ""
    expect(challenge).toContain("Bearer")
    expect(challenge).toContain('error="invalid_token"')
    expect(challenge).toContain(
      `resource_metadata="${BASE_URL}/.well-known/oauth-protected-resource"`
    )
  })

  test("happy path: DCR, consent, code exchange, and an owner's full tool access", async ({
    page,
    request,
  }) => {
    const requestedScope = "account dashboard users.view settings"

    const { tokens } = await runOAuthFlow(page, request, OWNER, {
      clientName: "E2E Happy Path Connector",
      scope: requestedScope,
      resource: `${BASE_URL}/api/mcp`,
      onConsentScreen: async () => {
        await expect(page.getByText("E2E Happy Path Connector")).toBeVisible()
        await expect(page.getByText(OWNER.email)).toBeVisible()
        await expect(page.getByText("Your account")).toBeVisible()
        await expect(page.getByText("Dashboard summary")).toBeVisible()
        await expect(page.getByText("View users")).toBeVisible()
        await expect(page.getByText("Platform status")).toBeVisible()
      },
    })

    expect(tokens.access_token).toBeTruthy()
    expect(tokens.refresh_token).toBeTruthy()
    expect(tokens.access_token).not.toBe(tokens.refresh_token)
    expect(tokens.token_type).toBe("Bearer")
    expect(tokens.scope.split(" ").sort()).toEqual(
      requestedScope.split(" ").sort()
    )

    const { response: listResponse, body: listBody } = await mcpCall(
      request,
      tokens.access_token,
      "tools/list"
    )
    expect(listResponse.status()).toBe(200)
    const toolNames = (listBody?.result?.tools ?? []).map((t) => t.name).sort()
    expect(toolNames).toEqual(
      [
        "get_dashboard_summary",
        "get_platform_status",
        "get_user",
        "list_users",
        "whoami",
      ].sort()
    )

    const { response: whoamiResponse, body: whoamiBody } = await mcpCall(
      request,
      tokens.access_token,
      "tools/call",
      { name: "whoami", arguments: {} }
    )
    expect(whoamiResponse.status()).toBe(200)
    expect(whoamiBody?.result?.structuredContent).toMatchObject({
      email: OWNER.email,
      role: "owner",
    })
  })

  test("code replay: reusing an authorization code fails and kills the whole grant", async ({
    page,
    request,
  }) => {
    const { clientId, code, verifier } = await obtainAuthorizationCode(
      page,
      request,
      OWNER,
      {
        clientName: "E2E Replay Connector",
      }
    )

    const first = await exchangeCode(request, { clientId, code, verifier })
    expect(first.status(), await first.text()).toBe(200)
    const firstTokens = (await first.json()) as TokenResponse

    const replay = await exchangeCode(request, { clientId, code, verifier })
    expect(replay.status()).toBe(400)
    const replayBody = await replay.json()
    expect(replayBody.error).toBe("invalid_grant")

    // The replay is treated as an attack: it kills the tokens the FIRST
    // (legitimate) exchange minted too (`L2-MCP-32`), not just the second try.
    const { response: listResponse } = await mcpCall(
      request,
      firstTokens.access_token,
      "tools/list"
    )
    expect(listResponse.status()).toBe(401)
  })

  test("refresh rotation: refresh works once, replaying the old token kills the whole grant", async ({
    page,
    request,
  }) => {
    const { clientId, tokens } = await runOAuthFlow(page, request, OWNER, {
      clientName: "E2E Refresh Connector",
    })

    const rotated = await refreshGrant(request, {
      clientId,
      refreshToken: tokens.refresh_token,
    })
    expect(rotated.status(), await rotated.text()).toBe(200)
    const rotatedTokens = (await rotated.json()) as TokenResponse
    expect(rotatedTokens.access_token).not.toBe(tokens.access_token)
    expect(rotatedTokens.refresh_token).not.toBe(tokens.refresh_token)

    // The rotated (now-consumed) refresh token is replayed — reuse detection
    // must reject it AND tear down the whole family (`L2-MCP-27`).
    const replay = await refreshGrant(request, {
      clientId,
      refreshToken: tokens.refresh_token,
    })
    expect(replay.status()).toBe(400)
    const replayBody = await replay.json()
    expect(replayBody.error).toBe("invalid_grant")

    // Even the token minted by the legitimate rotation is now dead.
    const { response: listResponse } = await mcpCall(
      request,
      rotatedTokens.access_token,
      "tools/list"
    )
    expect(listResponse.status()).toBe(401)
  })

  test("revocation: bumping the connected user's tokenVersion (password change) invalidates the connector immediately", async ({
    page,
    request,
  }) => {
    const { clientId, tokens } = await runOAuthFlow(page, request, OWNER, {
      clientName: "E2E Revocation Connector",
    })

    // Sanity: the grant works before the "password change".
    const before = await mcpCall(request, tokens.access_token, "tools/list")
    expect(before.response.status()).toBe(200)

    await bumpTokenVersion(OWNER.email)

    const after = await mcpCall(request, tokens.access_token, "tools/list")
    expect(after.response.status()).toBe(401)

    const refreshAttempt = await refreshGrant(request, {
      clientId,
      refreshToken: tokens.refresh_token,
    })
    expect(refreshAttempt.status()).toBe(400)
    const refreshBody = await refreshAttempt.json()
    expect(refreshBody.error).toBe("invalid_grant")
  })

  test("least privilege: a teammate sees a strictly smaller tool set than an owner", async ({
    page,
    request,
  }) => {
    const { tokens } = await runOAuthFlow(page, request, TEAMMATE, {
      clientName: "E2E Teammate Connector",
    })

    const { response, body } = await mcpCall(
      request,
      tokens.access_token,
      "tools/list"
    )
    expect(response.status()).toBe(200)
    const toolNames = (body?.result?.tools ?? []).map((t) => t.name).sort()
    expect(toolNames).toEqual(["get_dashboard_summary", "whoami"].sort())
    expect(toolNames).not.toContain("list_users")
    expect(toolNames).not.toContain("get_platform_status")

    // Calling an unregistered tool directly must fail as "unknown tool", not
    // silently succeed (`L2-MCP-20`, `L2-MCP-39`).
    const direct = await mcpCall(request, tokens.access_token, "tools/call", {
      name: "list_users",
      arguments: {},
    })
    expect(direct.response.status()).toBe(200) // JSON-RPC error, not an HTTP error.
    expect(direct.body?.error?.code).toBe(-32602)
  })

  test("logged-out authorize request survives the login round trip with the request intact (regression: proxy.ts `from` param)", async ({
    page,
    request,
  }) => {
    // Deliberately no `login()` here: this test's `page` gets a fresh,
    // unauthenticated browser context by default (`playwright.config.ts`'s
    // `use` block sets no `storageState`), and that default is exactly what
    // this scenario needs — a first-time Claude connection where the visitor
    // has no session yet (`L2-MCP-42`, `docs/notes/mcp.md` steps 3-4).
    const { clientId } = await registerClient(
      request,
      "E2E Logged-Out Connector"
    )
    const { verifier, challenge } = generatePkce()
    const state = crypto.randomBytes(8).toString("hex")

    const params = new URLSearchParams({
      response_type: "code",
      client_id: clientId,
      redirect_uri: REDIRECT_URI,
      code_challenge: challenge,
      code_challenge_method: "S256",
      state,
    })

    await page.goto(`/api/oauth/authorize?${params.toString()}`)

    // The `/backflip` proxy gate must carry the FULL authorize query string in
    // `from`, not just the pathname, or the post-login redirect lands on a
    // bare `/backflip/connect` with nothing to render. This is the assertion
    // that catches the regression: before the fix, `from` was just
    // `/backflip/connect` (no `?...`), so none of these `contain`s would hold.
    await expect(page).toHaveURL(/\/backflip\/login\?from=/)
    const fromParam = new URL(page.url()).searchParams.get("from") ?? ""
    expect(fromParam.startsWith("/backflip/connect?")).toBe(true)
    expect(fromParam).toContain(`client_id=${clientId}`)
    expect(fromParam).toContain(`code_challenge=${challenge}`)

    const redirectCaptured = captureRedirect(page)

    await page.getByLabel("Email").fill(OWNER.email)
    await page.getByLabel("Password").fill(OWNER.password)
    await page.getByRole("button", { name: "Sign in" }).click()

    // Lands on the consent screen WITH the request intact — not the fatal
    // "Missing client_id" error card `/backflip/connect` renders with no
    // params (see `ErrorCard` in `app/backflip/(protected)/connect/page.tsx`).
    await expect(page).toHaveURL(/\/backflip\/connect\?/)
    await expect(page.getByText("E2E Logged-Out Connector")).toBeVisible()
    await expect(page.getByText("Your account")).toBeVisible()
    await expect(page.getByText("Can't authorize this connector")).toBeHidden()

    await page.getByRole("button", { name: "Allow" }).click()
    const redirect = await redirectCaptured

    expect(redirect.searchParams.get("error")).toBeNull()
    expect(redirect.searchParams.get("state")).toBe(state)
    const code = redirect.searchParams.get("code")
    expect(code).toBeTruthy()

    const tokenResponse = await exchangeCode(request, {
      clientId,
      code: code as string,
      verifier,
    })
    expect(tokenResponse.status(), await tokenResponse.text()).toBe(200)
    const tokens = (await tokenResponse.json()) as TokenResponse
    expect(tokens.access_token).toBeTruthy()
  })

  test("manual confidential client: full authorize -> consent -> code -> token flow works with client_secret_post and client_secret_basic", async ({
    page,
    request,
  }) => {
    await login(page, OWNER)
    const { clientId, clientSecret } = await createManualClientViaUI(page, {
      clientName: "E2E Manual Confidential Connector",
      redirectUri: REDIRECT_URI,
    })
    // A web client (not `nativeClient`) is always confidential (`L2-MCP-52`).
    expect(clientSecret).toBeTruthy()

    // -- client_secret_post --------------------------------------------------
    {
      const { verifier, challenge } = generatePkce()
      const state = crypto.randomBytes(8).toString("hex")
      const redirect = await authorizeAndApprove(page, {
        clientId,
        challenge,
        state,
      })
      expect(redirect.searchParams.get("error")).toBeNull()
      const code = redirect.searchParams.get("code")
      expect(code).toBeTruthy()

      const response = await exchangeCodeConfidential(request, {
        clientId,
        code: code as string,
        verifier,
        secret: clientSecret as string,
        authMethod: "client_secret_post",
      })
      expect(response.status(), await response.text()).toBe(200)
      const tokens = (await response.json()) as TokenResponse
      expect(tokens.access_token).toBeTruthy()

      const { response: listResponse } = await mcpCall(
        request,
        tokens.access_token,
        "tools/list"
      )
      expect(listResponse.status()).toBe(200)
    }

    // -- client_secret_basic --------------------------------------------------
    {
      const { verifier, challenge } = generatePkce()
      const state = crypto.randomBytes(8).toString("hex")
      const redirect = await authorizeAndApprove(page, {
        clientId,
        challenge,
        state,
      })
      expect(redirect.searchParams.get("error")).toBeNull()
      const code = redirect.searchParams.get("code")
      expect(code).toBeTruthy()

      const response = await exchangeCodeConfidential(request, {
        clientId,
        code: code as string,
        verifier,
        secret: clientSecret as string,
        authMethod: "client_secret_basic",
      })
      expect(response.status(), await response.text()).toBe(200)
      const tokens = (await response.json()) as TokenResponse
      expect(tokens.access_token).toBeTruthy()

      const { response: listResponse } = await mcpCall(
        request,
        tokens.access_token,
        "tools/list"
      )
      expect(listResponse.status()).toBe(200)
    }
  })

  test("manual confidential client: omitting the secret at the token endpoint is invalid_client", async ({
    page,
    request,
  }) => {
    await login(page, OWNER)
    const { clientId } = await createManualClientViaUI(page, {
      clientName: "E2E Confidential No-Secret Connector",
      redirectUri: REDIRECT_URI,
    })

    const { verifier, challenge } = generatePkce()
    const state = crypto.randomBytes(8).toString("hex")
    const redirect = await authorizeAndApprove(page, {
      clientId,
      challenge,
      state,
    })
    expect(redirect.searchParams.get("error")).toBeNull()
    const code = redirect.searchParams.get("code")
    expect(code).toBeTruthy()

    // No `secret` presented at all — a confidential client must reject this
    // rather than silently treat it as a public one (`L2-MCP-52`).
    const response = await exchangeCodeConfidential(request, {
      clientId,
      code: code as string,
      verifier,
      authMethod: "none",
    })
    expect(response.status()).toBe(400)
    const body = await response.json()
    expect(body.error).toBe("invalid_client")
  })

  test("registration mode: DCR off hides registration_endpoint and 404s POST /api/oauth/register", async ({
    request,
  }) => {
    await setDcrMode("off")
    try {
      const metaResponse = await request.get(
        "/.well-known/oauth-authorization-server"
      )
      expect(metaResponse.status()).toBe(200)
      const meta = await metaResponse.json()
      // Advertising an endpoint that answers 404 would send a client down a
      // flow that cannot complete (`L2-MCP-47`).
      expect(meta.registration_endpoint).toBeUndefined()

      const registerResponse = await request.post("/api/oauth/register", {
        data: {
          client_name: "Should never register",
          redirect_uris: [REDIRECT_URI],
        },
      })
      expect(registerResponse.status()).toBe(404)
    } finally {
      await setDcrMode("open")
    }
  })

  test("allowlist enforcement: removing a client's redirect host breaks authorize on our own origin, restored afterward", async ({
    page,
    request,
  }) => {
    const redirectUri = "https://claude.ai/e2e-allowlist-callback"

    await login(page, OWNER)
    const { clientId } = await createManualClientViaUI(page, {
      clientName: "E2E Allowlist Connector",
      redirectUri,
    })

    const { challenge } = generatePkce()
    const state = crypto.randomBytes(8).toString("hex")
    const params = new URLSearchParams({
      response_type: "code",
      client_id: clientId,
      redirect_uri: redirectUri,
      code_challenge: challenge,
      code_challenge_method: "S256",
      state,
    })

    // Sanity: claude.ai is on the default allowlist, so this client's
    // authorize request is currently routed to consent (307), never rendered
    // as an error.
    const before = await request.get(
      `/api/oauth/authorize?${params.toString()}`,
      { maxRedirects: 0 }
    )
    expect(before.status()).toBe(307)
    expect(before.headers()["location"] ?? "").toContain("/backflip/connect")

    await removeAllowlistHostViaUI(page, "claude.ai")
    try {
      const after = await request.get(
        `/api/oauth/authorize?${params.toString()}`,
        { maxRedirects: 0 }
      )
      // Fatal, not a redirect: a de-allowlisted host is exactly the
      // destination that must never be bounced to, so this renders on our own
      // origin instead (`L2-MCP-31`, `L2-MCP-49`).
      expect(after.status()).toBe(400)
      expect(after.headers()["location"]).toBeUndefined()
      expect(after.headers()["content-type"] ?? "").toContain("text/plain")
      const body = await after.text()
      expect(body).toContain("Authorization request rejected")
    } finally {
      await addAllowlistHostViaUI(page, "claude.ai")
    }
  })

  test("kill switch: disabling the connector 404s every route, re-enabling restores it", async ({
    page,
    request,
  }) => {
    // Two independent propagation waits below (disable, then re-enable) can
    // each legitimately take close to `PROPAGATION_TIMEOUT_MS` — see why
    // below — which together can exceed `playwright.config.ts`'s default
    // per-test timeout.
    test.setTimeout(120_000)

    await login(page, OWNER)

    // The propagation budget below is NOT "instant, same process" despite
    // `clearConnectorSettingsCache()` running synchronously in the save's own
    // request (see the doc comment on `getCachedConnectorSettings` in
    // `app/_lib/oauth/connector-config.ts`). Measured against this suite's
    // own `next dev` webServer: a direct DB check right after the toggle
    // confirms the write lands immediately, but `/api/mcp` kept answering
    // from the pre-toggle cached value for close to the full
    // `CONNECTOR_SETTINGS_CACHE_TTL_MS` (~30s) regardless — i.e. the "same
    // process" propagation guarantee the code comments describe did not hold
    // here. Budget accordingly and poll on the real condition rather than
    // assume the fast path (`L2-MCP-54`); a poll that still doesn't resolve
    // within this budget is a genuine regression, not a flake to retry away.
    const PROPAGATION_TIMEOUT_MS = 45_000

    try {
      await setConnectorEnabledViaUI(page, false)

      await expect
        .poll(async () => (await request.get("/api/mcp")).status(), {
          message: "/api/mcp should 404 once the connector is disabled",
          timeout: PROPAGATION_TIMEOUT_MS,
        })
        .toBe(404)

      const tokenResponse = await request.post("/api/oauth/token", {
        form: {
          grant_type: "authorization_code",
          code: "irrelevant",
          redirect_uri: REDIRECT_URI,
          client_id: "irrelevant",
          code_verifier: "irrelevant",
        },
      })
      expect(tokenResponse.status()).toBe(404)

      const metaResponse = await request.get(
        "/.well-known/oauth-authorization-server"
      )
      expect(metaResponse.status()).toBe(404)
    } finally {
      await setConnectorEnabledViaUI(page, true)
      await expect
        .poll(
          async () =>
            (
              await request.get("/.well-known/oauth-authorization-server")
            ).status(),
          {
            message: "the connector should come back once re-enabled",
            timeout: PROPAGATION_TIMEOUT_MS,
          }
        )
        .toBe(200)
    }
  })

  test("anonymous path: bearer-less POST /api/mcp matches the invalid-token response exactly", async ({
    request,
  }) => {
    const requestBody = { jsonrpc: "2.0", id: 1, method: "tools/list" }

    const anonymous = await request.post("/api/mcp", {
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
      },
      data: requestBody,
    })
    const invalidToken = await request.post("/api/mcp", {
      headers: {
        Authorization: "Bearer not-a-real-token",
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
      },
      data: requestBody,
    })

    expect(anonymous.status()).toBe(401)
    expect(invalidToken.status()).toBe(401)
    expect(await anonymous.json()).toEqual(await invalidToken.json())
    expect(anonymous.headers()["www-authenticate"]).toBe(
      invalidToken.headers()["www-authenticate"]
    )
    expect(anonymous.headers()["content-type"]).toBe(
      invalidToken.headers()["content-type"]
    )
    expect(anonymous.headers()["cache-control"]).toBe(
      invalidToken.headers()["cache-control"]
    )
  })
})
