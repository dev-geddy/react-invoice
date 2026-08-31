import { describe, expect, it } from "vitest"

import {
  serializeAiConfig,
  serializeAnalyticsConfig,
  serializeEmailConfig,
  serializeSpeechConfig,
} from "./platform"

/**
 * Shape-locks the `get_platform_status` serializers: fed a raw config row
 * carrying `apiKeyEnc`, the output must never contain the ciphertext or the
 * column itself — only a derived `hasKey` boolean (`L2-MCP-07`, `L2-MCP-35`).
 */
const SECRET_CIPHERTEXT = "v1:deadbeef:supersecretciphertext"

describe("serializeAiConfig", () => {
  it("drops apiKeyEnc and exposes hasKey instead", () => {
    const out = serializeAiConfig([
      {
        provider: "anthropic",
        model: "claude-sonnet",
        apiKeyEnc: SECRET_CIPHERTEXT,
        enabled: true,
        isDefault: true,
      },
    ])
    expect(out).toEqual([
      {
        provider: "anthropic",
        model: "claude-sonnet",
        enabled: true,
        isDefault: true,
        hasKey: true,
      },
    ])
    const serialized = JSON.stringify(out)
    expect(serialized).not.toContain(SECRET_CIPHERTEXT)
    expect(serialized).not.toContain("apiKeyEnc")
  })

  it("hasKey is false when apiKeyEnc is null", () => {
    const [row] = serializeAiConfig([
      {
        provider: "openai",
        model: null,
        apiKeyEnc: null,
        enabled: false,
        isDefault: false,
      },
    ])
    expect(row?.hasKey).toBe(false)
  })
})

describe("serializeEmailConfig", () => {
  it("drops apiKeyEnc and exposes hasKey instead", () => {
    const out = serializeEmailConfig({
      provider: "resend",
      apiKeyEnc: SECRET_CIPHERTEXT,
      fromEmail: "hello@example.com",
      enabled: true,
    })
    expect(out).toEqual({
      provider: "resend",
      enabled: true,
      hasKey: true,
      fromEmail: "hello@example.com",
    })
    expect(JSON.stringify(out)).not.toContain(SECRET_CIPHERTEXT)
  })

  it("falls back to a disabled default when no row exists", () => {
    expect(serializeEmailConfig(undefined)).toEqual({
      provider: "resend",
      enabled: false,
      hasKey: false,
      fromEmail: null,
    })
  })
})

describe("serializeSpeechConfig", () => {
  it("drops apiKeyEnc and exposes hasKey instead", () => {
    const out = serializeSpeechConfig({
      provider: "deepgram",
      apiKeyEnc: SECRET_CIPHERTEXT,
      sttModel: "nova-2",
      ttsModel: "aura",
      enabled: true,
    })
    expect(out).toEqual({
      provider: "deepgram",
      enabled: true,
      hasKey: true,
      sttModel: "nova-2",
      ttsModel: "aura",
    })
    expect(JSON.stringify(out)).not.toContain(SECRET_CIPHERTEXT)
  })
})

describe("serializeAnalyticsConfig", () => {
  it("passes through non-secret analytics fields unchanged", () => {
    expect(
      serializeAnalyticsConfig({
        kind: "google_analytics",
        measurementId: "G-ABC123",
        cookieBannerEnabled: true,
      })
    ).toEqual({
      kind: "google_analytics",
      measurementId: "G-ABC123",
      cookieBannerEnabled: true,
    })
  })

  it("falls back to defaults when no row exists", () => {
    expect(serializeAnalyticsConfig(undefined)).toEqual({
      kind: "google_analytics",
      measurementId: null,
      cookieBannerEnabled: true,
    })
  })
})
