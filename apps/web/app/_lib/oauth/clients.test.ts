import bcrypt from "bcryptjs"
import { beforeEach, describe, expect, it, vi } from "vitest"

import {
  createManualClient,
  isValidRedirectUri,
  parseClientAuthentication,
  redirectUriAllowed,
  redirectUriHost,
  registerClient,
  verifyClientSecret,
  type OAuthClientRecord,
} from "./clients"

/**
 * Redirect-URI rules (`L2-MCP-31`, `L2-MCP-49`, `L2-MCP-51`), the manual-client
 * secret policy (`L2-MCP-50`, `L2-MCP-52`) and token-endpoint client
 * authentication. The Drizzle client is a recording stub and the settings read
 * is stubbed — none of the logic under test needs a database.
 */

const h = vi.hoisted(() => {
  const inserts: Array<Record<string, unknown>> = []
  const state = {
    returning: [{ id: "client-row-1" }] as unknown[],
    redirectHosts: ["claude.ai", "claude.com"] as string[],
  }

  const db = {
    insert: () => ({
      values: (values: Record<string, unknown>) => ({
        returning: async () => {
          inserts.push(values)
          return state.returning
        },
      }),
    }),
  }

  return {
    db,
    inserts,
    state,
    reset() {
      inserts.length = 0
      state.redirectHosts = ["claude.ai", "claude.com"]
    },
  }
})

vi.mock("@workspace/db", async () => {
  process.env.DATABASE_URL ??= "postgres://test:test@127.0.0.1:5432/test"
  const actual =
    await vi.importActual<typeof import("@workspace/db")>("@workspace/db")
  return { ...actual, db: h.db }
})

vi.mock("./connector-config", async () => {
  const actual =
    await vi.importActual<typeof import("./connector-config")>(
      "./connector-config"
    )
  return {
    ...actual,
    getConnectorSettings: async () => ({
      dcrMode: "off" as const,
      redirectHosts: h.state.redirectHosts,
    }),
  }
})

function client(overrides: Partial<OAuthClientRecord> = {}): OAuthClientRecord {
  return {
    id: "client-row-1",
    clientId: "public-client-id",
    clientSecretHash: null,
    clientName: "Claude",
    origin: "dynamic",
    createdByUserId: null,
    allowLoopbackPorts: false,
    redirectUris: [],
    grantTypes: ["authorization_code", "refresh_token"],
    scopes: ["account"],
    tokenEndpointAuthMethod: "none",
    createdAt: new Date(),
    lastUsedAt: null,
    ...overrides,
  }
}

beforeEach(() => {
  h.reset()
})

describe("isValidRedirectUri", () => {
  it("accepts absolute https URLs", () => {
    expect(isValidRedirectUri("https://claude.ai/api/mcp/auth_callback")).toBe(
      true
    )
    expect(isValidRedirectUri("https://client.example/cb?tenant=acme")).toBe(
      true
    )
  })

  it("accepts http only on loopback hosts", () => {
    expect(isValidRedirectUri("http://localhost:8080/cb")).toBe(true)
    expect(isValidRedirectUri("http://127.0.0.1:1234/cb")).toBe(true)
    expect(isValidRedirectUri("http://evil.example/cb")).toBe(false)
    expect(isValidRedirectUri("http://localhost.evil.example/cb")).toBe(false)
    expect(isValidRedirectUri("http://127.0.0.2:1234/cb")).toBe(false)
    expect(isValidRedirectUri("http://[::1]:1234/cb")).toBe(false)
  })

  it("rejects fragments, relative URIs and non-http schemes", () => {
    expect(isValidRedirectUri("https://client.example/cb#frag")).toBe(false)
    expect(isValidRedirectUri("https://client.example/cb#")).toBe(false)
    expect(isValidRedirectUri("/cb")).toBe(false)
    expect(isValidRedirectUri("javascript:alert(1)")).toBe(false)
    expect(isValidRedirectUri("data:text/html,x")).toBe(false)
    expect(isValidRedirectUri("")).toBe(false)
  })

  it("rejects embedded credentials and absurdly long URIs", () => {
    expect(isValidRedirectUri("https://user:pw@client.example/cb")).toBe(false)
    expect(
      isValidRedirectUri(`https://client.example/${"a".repeat(4000)}`)
    ).toBe(false)
  })
})

describe("redirectUriHost", () => {
  it("returns the lowercased host, or null for a non-URL", () => {
    expect(redirectUriHost("https://Claude.AI/cb")).toBe("claude.ai")
    expect(redirectUriHost("http://127.0.0.1:9000/cb")).toBe("127.0.0.1")
    expect(redirectUriHost("not a url")).toBeNull()
  })
})

describe("redirectUriAllowed", () => {
  const registered = "https://claude.ai/api/mcp/auth_callback"

  it("matches the full string only", () => {
    const record = client({ redirectUris: [registered] })
    expect(redirectUriAllowed(record, registered)).toBe(true)
    // Prefix / suffix / case / trailing-slash variants are all different URIs.
    expect(
      redirectUriAllowed(record, "https://claude.ai/api/mcp/auth_callback/x")
    ).toBe(false)
    expect(
      redirectUriAllowed(record, "https://claude.ai/api/mcp/auth_callback/")
    ).toBe(false)
    expect(
      redirectUriAllowed(record, "https://claude.ai/api/mcp/auth_callback?x=1")
    ).toBe(false)
    expect(
      redirectUriAllowed(
        record,
        "https://claude.ai.evil.test/api/mcp/auth_callback"
      )
    ).toBe(false)
    expect(redirectUriAllowed(record, "")).toBe(false)
  })

  it("accepts any one of several registered URIs", () => {
    const record = client({
      redirectUris: [registered, "http://localhost:8080/cb"],
    })
    expect(redirectUriAllowed(record, "http://localhost:8080/cb")).toBe(true)
  })

  it("keeps the port significant unless the client opted in", () => {
    const record = client({ redirectUris: ["http://127.0.0.1:8080/callback"] })
    expect(redirectUriAllowed(record, "http://127.0.0.1:9999/callback")).toBe(
      false
    )
  })
})

describe("redirectUriAllowed — allowLoopbackPorts", () => {
  const native = (uris: string[]) =>
    client({ allowLoopbackPorts: true, redirectUris: uris })

  it("ignores the port on loopback URIs", () => {
    const record = native(["http://127.0.0.1:8080/callback"])
    expect(redirectUriAllowed(record, "http://127.0.0.1:54321/callback")).toBe(
      true
    )
    expect(redirectUriAllowed(record, "http://127.0.0.1/callback")).toBe(true)
    // Registered without a port matches an ephemeral one too.
    expect(
      redirectUriAllowed(
        native(["http://localhost/callback"]),
        "http://localhost:1455/callback"
      )
    ).toBe(true)
  })

  it("still requires scheme, host, path and query to match", () => {
    const record = native(["http://127.0.0.1:8080/callback"])
    expect(redirectUriAllowed(record, "http://127.0.0.1:8080/other")).toBe(
      false
    )
    expect(redirectUriAllowed(record, "http://127.0.0.1:8080/callback/")).toBe(
      false
    )
    expect(
      redirectUriAllowed(record, "http://127.0.0.1:8080/callback?x=1")
    ).toBe(false)
    expect(redirectUriAllowed(record, "https://127.0.0.1/callback")).toBe(false)
    // localhost and 127.0.0.1 are different hosts, not synonyms.
    expect(redirectUriAllowed(record, "http://localhost:8080/callback")).toBe(
      false
    )
  })

  it("never treats a look-alike host as loopback", () => {
    // A host merely containing "localhost", the next IP up, and the IPv6
    // loopback literal are all ordinary remote hosts here.
    for (const uri of [
      "http://localhost.evil.example:8080/callback",
      "http://127.0.0.2:8080/callback",
      "http://[::1]:8080/callback",
    ]) {
      expect(
        redirectUriAllowed(native([uri]), uri.replace(":8080", ":9999"))
      ).toBe(false)
    }
    // …and cannot be reached from a genuinely registered loopback URI.
    const record = native(["http://localhost:8080/callback"])
    expect(
      redirectUriAllowed(record, "http://localhost.evil.example:8080/callback")
    ).toBe(false)
  })

  it("does not loosen https URIs for the same client", () => {
    const record = native(["https://claude.ai/cb"])
    expect(redirectUriAllowed(record, "https://claude.ai/cb")).toBe(true)
    expect(redirectUriAllowed(record, "https://claude.ai:8443/cb")).toBe(false)
  })
})

describe("registerClient", () => {
  it("always stores a public, dynamic client with no secret", async () => {
    await registerClient({
      clientName: "Claude",
      redirectUris: ["https://claude.ai/api/mcp/auth_callback"],
      tokenEndpointAuthMethod: "client_secret_basic",
    })

    const values = h.inserts[0]!
    expect(values.tokenEndpointAuthMethod).toBe("none")
    expect(values.clientSecretHash).toBeNull()
    expect(values.origin).toBe("dynamic")
    expect(values.createdByUserId).toBeNull()
    expect(values.allowLoopbackPorts).toBe(false)
    expect(typeof values.clientId).toBe("string")
    expect((values.clientId as string).length).toBeGreaterThan(20)
  })

  it("drops grant types the server does not implement", async () => {
    await registerClient({
      clientName: "Claude",
      redirectUris: ["https://claude.ai/cb"],
      grantTypes: ["authorization_code", "implicit", "password"],
    })

    expect(h.inserts[0]!.grantTypes).toEqual(["authorization_code"])
  })

  it("defaults to both supported grants and every offered scope", async () => {
    await registerClient({
      clientName: "Claude",
      redirectUris: ["https://claude.ai/cb"],
    })

    expect(h.inserts[0]!.grantTypes).toEqual([
      "authorization_code",
      "refresh_token",
    ])
    expect(h.inserts[0]!.scopes).toEqual([
      "account",
      "dashboard",
      "users.view",
      "settings",
    ])
  })
})

describe("createManualClient", () => {
  it("issues a confidential web client and returns the secret once", async () => {
    const { clientSecret } = await createManualClient({
      clientName: "Claude web",
      redirectUris: ["https://claude.ai/api/mcp/auth_callback"],
      createdByUserId: "owner-1",
    })

    expect(typeof clientSecret).toBe("string")
    expect(clientSecret!.length).toBeGreaterThan(20)

    const values = h.inserts[0]!
    expect(values.origin).toBe("manual")
    expect(values.createdByUserId).toBe("owner-1")
    expect(values.tokenEndpointAuthMethod).toBe("client_secret_post")
    expect(values.allowLoopbackPorts).toBe(false)
    // The raw secret is never stored — only its bcrypt hash.
    const hash = values.clientSecretHash as string
    expect(hash).not.toContain(clientSecret!)
    expect(hash.startsWith("$2")).toBe(true)
    await expect(bcrypt.compare(clientSecret!, hash)).resolves.toBe(true)
  })

  it("issues NO secret to a native (loopback) client", async () => {
    const { clientSecret } = await createManualClient({
      clientName: "Claude Code",
      redirectUris: ["http://127.0.0.1:8080/callback"],
      allowLoopbackPorts: true,
      createdByUserId: "owner-1",
    })

    expect(clientSecret).toBeNull()
    const values = h.inserts[0]!
    expect(values.clientSecretHash).toBeNull()
    expect(values.tokenEndpointAuthMethod).toBe("none")
    expect(values.allowLoopbackPorts).toBe(true)
  })

  it("refuses a redirect host that is not on the allowlist", async () => {
    await expect(
      createManualClient({
        clientName: "Phisher",
        redirectUris: ["https://evil.example/cb"],
        createdByUserId: "owner-1",
      })
    ).rejects.toThrow(/allowlist/)
    expect(h.inserts).toHaveLength(0)
  })

  it("allows loopback redirect URIs without listing the host", async () => {
    h.state.redirectHosts = []
    await expect(
      createManualClient({
        clientName: "Claude Code",
        redirectUris: ["http://localhost:8080/callback"],
        allowLoopbackPorts: true,
        createdByUserId: "owner-1",
      })
    ).resolves.toMatchObject({ clientSecret: null })
  })

  it("refuses invalid input before touching the database", async () => {
    await expect(
      createManualClient({
        clientName: "",
        redirectUris: ["https://claude.ai/cb"],
        createdByUserId: "owner-1",
      })
    ).rejects.toThrow()
    await expect(
      createManualClient({
        clientName: "No URIs",
        redirectUris: [],
        createdByUserId: "owner-1",
      })
    ).rejects.toThrow()
    await expect(
      createManualClient({
        clientName: "Bad URI",
        redirectUris: ["https://claude.ai/cb#frag"],
        createdByUserId: "owner-1",
      })
    ).rejects.toThrow()
    expect(h.inserts).toHaveLength(0)
  })
})

describe("verifyClientSecret", () => {
  it("accepts the right secret and rejects a wrong one", async () => {
    const secret = "s3cret-value"
    const confidential = client({
      clientSecretHash: await bcrypt.hash(secret, 4),
    })
    await expect(verifyClientSecret(confidential, secret)).resolves.toBe(true)
    await expect(verifyClientSecret(confidential, "wrong")).resolves.toBe(false)
    await expect(verifyClientSecret(confidential, "")).resolves.toBe(false)
  })

  it("never authenticates a public client, whatever is presented", async () => {
    const publicClient = client({ clientSecretHash: null })
    await expect(verifyClientSecret(publicClient, "anything")).resolves.toBe(
      false
    )
    await expect(verifyClientSecret(publicClient, "")).resolves.toBe(false)
  })
})

describe("parseClientAuthentication", () => {
  const form = (values: Record<string, string>) =>
    new URLSearchParams(Object.entries(values))

  it("reads a public client from the body alone", () => {
    const result = parseClientAuthentication({
      authorizationHeader: null,
      form: form({ client_id: "abc" }),
    })
    expect(result).toEqual({
      ok: true,
      clientId: "abc",
      secret: null,
      method: "none",
    })
  })

  it("reads client_secret_post", () => {
    const result = parseClientAuthentication({
      authorizationHeader: null,
      form: form({ client_id: "abc", client_secret: "shh" }),
    })
    expect(result).toEqual({
      ok: true,
      clientId: "abc",
      secret: "shh",
      method: "client_secret_post",
    })
  })

  it("reads client_secret_basic, URL-decoded per RFC 6749 §2.3.1", () => {
    const encoded = Buffer.from("cli%20ent:s%2Fh%2Bh", "utf8").toString(
      "base64"
    )
    const result = parseClientAuthentication({
      authorizationHeader: `Basic ${encoded}`,
      form: new URLSearchParams(),
    })
    expect(result).toEqual({
      ok: true,
      clientId: "cli ent",
      secret: "s/h+h",
      method: "client_secret_basic",
    })
  })

  it("takes a value that is not valid percent-encoding literally", () => {
    const encoded = Buffer.from("abc:100%pure", "utf8").toString("base64")
    const result = parseClientAuthentication({
      authorizationHeader: `Basic ${encoded}`,
      form: new URLSearchParams(),
    })
    expect(result).toMatchObject({ ok: true, secret: "100%pure" })
  })

  it("accepts a body client_id that agrees with the Basic one", () => {
    const encoded = Buffer.from("abc:shh", "utf8").toString("base64")
    const result = parseClientAuthentication({
      authorizationHeader: `Basic ${encoded}`,
      form: form({ client_id: "abc" }),
    })
    expect(result).toMatchObject({ ok: true, clientId: "abc", secret: "shh" })
  })

  it("refuses two authentication methods at once", () => {
    const encoded = Buffer.from("abc:shh", "utf8").toString("base64")
    const result = parseClientAuthentication({
      authorizationHeader: `Basic ${encoded}`,
      form: form({ client_id: "abc", client_secret: "shh" }),
    })
    expect(result).toMatchObject({
      ok: false,
      failure: { error: "invalid_request" },
    })
  })

  it("refuses a Basic client_id that disagrees with the body", () => {
    const encoded = Buffer.from("abc:shh", "utf8").toString("base64")
    const result = parseClientAuthentication({
      authorizationHeader: `Basic ${encoded}`,
      form: form({ client_id: "other" }),
    })
    expect(result).toMatchObject({
      ok: false,
      failure: { error: "invalid_client" },
    })
  })

  it("refuses a malformed or unsupported Authorization header", () => {
    for (const header of [
      `Basic ${Buffer.from("no-colon", "utf8").toString("base64")}`,
      `Basic ${Buffer.from(":shh", "utf8").toString("base64")}`,
      `Basic ${Buffer.from("abc:", "utf8").toString("base64")}`,
      "Bearer some-token",
    ]) {
      expect(
        parseClientAuthentication({
          authorizationHeader: header,
          form: form({ client_id: "abc" }),
        })
      ).toMatchObject({ ok: false, failure: { error: "invalid_client" } })
    }
  })

  it("refuses a request with no client_id anywhere", () => {
    expect(
      parseClientAuthentication({
        authorizationHeader: null,
        form: new URLSearchParams(),
      })
    ).toMatchObject({ ok: false, failure: { error: "invalid_client" } })
  })
})
