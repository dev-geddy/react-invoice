import {
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
} from "drizzle-orm/pg-core"

/** @spec L2-DB-05, L2-DB-06, L2-DB-07, L2-DB-17, L2-DB-18, L2-DB-20, L2-DB-22, L2-ANALYTICS-01 */

/**
 * Platform roles. `owner` = top-level admin (seeded); can do everything.
 * `admin` = operator, cannot edit system settings. `teammate` = own account
 * area + admin dashboard only. Capability model lives in the auth domain.
 */
export const userRole = pgEnum("user_role", ["owner", "admin", "teammate"])

/**
 * Users. Auth.js base shape (id/name/email/emailVerified/image) plus:
 * - `passwordHash` — bcrypt hash for credentials login (null = OAuth-only).
 * - `role` — platform role.
 */
export const users = pgTable("user", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").unique().notNull(),
  emailVerified: timestamp("emailVerified", { mode: "date" }),
  image: text("image"),
  passwordHash: text("passwordHash"),
  role: userRole("role").notNull().default("teammate"),
  // Bumped on password/email change to invalidate all existing JWT sessions.
  tokenVersion: integer("tokenVersion").notNull().default(0),
  createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
})

/** OAuth provider accounts (Auth.js adapter shape). */
export const accounts = pgTable(
  "account",
  {
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<"oauth" | "oidc" | "email" | "webauthn">().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("providerAccountId").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (account) => [
    primaryKey({ columns: [account.provider, account.providerAccountId] }),
  ]
)

/** DB sessions (unused under JWT strategy, kept for adapter completeness). */
export const sessions = pgTable("session", {
  sessionToken: text("sessionToken").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
})

/** Verification tokens (magic-link/email flows; kept for adapter completeness). */
export const verificationTokens = pgTable(
  "verificationToken",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (vt) => [primaryKey({ columns: [vt.identifier, vt.token] })]
)

/**
 * Short-lived, single-use tokens for self-service account flows:
 * - `password_reset` — forgot-password: proves control of the email.
 * - `email_change` — confirms a new email before it replaces the old one
 *   (`newEmail` holds the pending address).
 * Only the SHA-256 hash of the token is stored (`tokenHash`); the raw token
 * lives only in the emailed link. Rows are consumed (`consumedAt`) on use and
 * expire (`expiresAt`).
 */
export const userTokenType = pgEnum("user_token_type", [
  "password_reset",
  "email_change",
])

export const userTokens = pgTable("user_token", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  type: userTokenType("type").notNull(),
  tokenHash: text("tokenHash").notNull().unique(),
  newEmail: text("newEmail"),
  expiresAt: timestamp("expiresAt", { mode: "date" }).notNull(),
  consumedAt: timestamp("consumedAt", { mode: "date" }),
  createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
})

/** AI providers supported by the integration config. */
export const aiProvider = pgEnum("ai_provider", ["anthropic", "openai", "google"])

/**
 * AI integration config — one row per provider. Consumed by the (future)
 * AI SDK layer. `apiKeyEnc` is AES-256-GCM encrypted (see `crypto.ts`); the
 * plaintext key never leaves the server.
 */
export const aiConfig = pgTable("ai_config", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  provider: aiProvider("provider").notNull().unique(),
  model: text("model"),
  apiKeyEnc: text("apiKeyEnc"),
  baseUrl: text("baseUrl"),
  temperature: real("temperature").notNull().default(0.7),
  enabled: boolean("enabled").notNull().default(false),
  isDefault: boolean("isDefault").notNull().default(false),
  updatedAt: timestamp("updatedAt", { mode: "date" }).notNull().defaultNow(),
})

/**
 * Email sending config — single row (provider `resend`). `apiKeyEnc` is
 * AES-256-GCM encrypted (see `crypto.ts`); plaintext never leaves the server.
 */
export const emailConfig = pgTable("email_config", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  provider: text("provider").notNull().unique().default("resend"),
  apiKeyEnc: text("apiKeyEnc"),
  fromEmail: text("fromEmail"),
  fromName: text("fromName"),
  replyTo: text("replyTo"),
  enabled: boolean("enabled").notNull().default(false),
  updatedAt: timestamp("updatedAt", { mode: "date" }).notNull().defaultNow(),
})

/**
 * Analytics config — single row per `kind` (only `google_analytics` today).
 * `measurementId` is the public GA4 tag id (`G-…`) — NOT a secret, stored and
 * served in plaintext. `cookieBannerEnabled` gates whether analytics needs
 * consent before loading; `cookieBannerText` is the operator-editable banner
 * copy (default seeded by migration).
 */
/**
 * Speech (Deepgram) config — single row (`provider` unique). API key
 * AES-256-GCM encrypted (see `crypto.ts`); plaintext never leaves the server.
 * `sttModel`/`ttsModel` hold Deepgram canonical model names.
 */
export const speechConfig = pgTable("speech_config", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  provider: text("provider").notNull().unique().default("deepgram"),
  apiKeyEnc: text("apiKeyEnc"),
  sttModel: text("sttModel"),
  ttsModel: text("ttsModel"),
  enabled: boolean("enabled").notNull().default(false),
  updatedAt: timestamp("updatedAt", { mode: "date" }).notNull().defaultNow(),
})

export const analyticsConfig = pgTable("analytics_config", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  kind: text("kind").notNull().unique().default("google_analytics"),
  measurementId: text("measurementId"),
  cookieBannerEnabled: boolean("cookieBannerEnabled").notNull().default(true),
  cookieBannerText: text("cookieBannerText"),
  updatedAt: timestamp("updatedAt", { mode: "date" }).notNull().defaultNow(),
})

/**
 * OAuth 2.1 clients for the MCP connector. Registered dynamically (RFC 7591)
 * by the connecting agent — Claude registers itself on first connect. Public
 * clients: no secret, PKCE instead (`clientSecretHash` stays null; the column
 * exists for a future confidential-client flow).
 *
 * `redirectUris` is matched exactly at authorize time — no prefix matching.
 *
 * @spec L2-DB-25, L2-MCP-21, L2-MCP-31
 */
/** How `/api/oauth/register` (RFC 7591) behaves. Default `off`. */
export const connectorDcrMode = pgEnum("connector_dcr_mode", [
  "off",
  "allowlist",
  "open",
])

/**
 * Connector (MCP) settings — single row, owner-managed under
 * `/backflip/settings`. Holds the redirect-host allowlist enforced for every
 * OAuth client (manual or dynamic) and the dynamic-registration mode.
 *
 * `redirectHosts` seeds to Claude's two callback origins; an owner may add
 * more. With `dcrMode = "off"` (the default) anonymous client registration is
 * refused outright and clients are created by hand in the admin UI.
 *
 * @spec L2-DB-28, L2-MCP-48
 */
export const connectorConfig = pgTable("connector_config", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  kind: text("kind").notNull().unique().default("mcp"),
  /**
   * Master switch, owner-toggled in the admin UI — matches how every other
   * integration here is enabled (`ai_config`, `email_config`, …). Default off.
   * `MCP_ENABLED=false` in the environment still forces it off regardless, as
   * a deploy-level kill switch for when the admin UI itself can't be trusted.
   */
  enabled: boolean("enabled").notNull().default(false),
  dcrMode: connectorDcrMode("dcrMode").notNull().default("off"),
  redirectHosts: text("redirectHosts")
    .array()
    .notNull()
    .default(["claude.ai", "claude.com"]),
  updatedAt: timestamp("updatedAt", { mode: "date" }).notNull().defaultNow(),
})

export const oauthClients = pgTable("oauth_client", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  clientId: text("clientId").notNull().unique(),
  clientSecretHash: text("clientSecretHash"),
  clientName: text("clientName").notNull(),
  /** `manual` = created by an owner in the admin UI; `dynamic` = RFC 7591. */
  origin: text("origin").notNull().default("dynamic"),
  /** Owner who created a manual client; null for dynamic registrations. */
  createdByUserId: text("createdByUserId").references(() => users.id, {
    onDelete: "set null",
  }),
  /**
   * Port-agnostic loopback matching for native clients (Claude Code redirects
   * to `http://127.0.0.1:<ephemeral>/callback`). Per-client opt-in — the
   * claude.ai web path keeps strict exact-string matching.
   */
  allowLoopbackPorts: boolean("allowLoopbackPorts").notNull().default(false),
  redirectUris: text("redirectUris").array().notNull(),
  grantTypes: text("grantTypes")
    .array()
    .notNull()
    .default(["authorization_code", "refresh_token"]),
  scopes: text("scopes").array().notNull().default([]),
  tokenEndpointAuthMethod: text("tokenEndpointAuthMethod")
    .notNull()
    .default("none"),
  createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
  lastUsedAt: timestamp("lastUsedAt", { mode: "date" }),
})

/**
 * Authorization codes (PKCE). Very short lived (60s), single use, bound to the
 * client + redirect URI + user that produced them. Only the SHA-256 hash of
 * the code is stored — the raw code exists solely in the redirect back to the
 * client (same discipline as `user_token`, `L2-DB-21`).
 *
 * @spec L2-DB-26, L2-MCP-22, L2-MCP-26, L2-MCP-32
 */
export const oauthAuthCodes = pgTable("oauth_auth_code", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  codeHash: text("codeHash").notNull().unique(),
  clientId: text("clientId")
    .notNull()
    .references(() => oauthClients.id, { onDelete: "cascade" }),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  redirectUri: text("redirectUri").notNull(),
  scopes: text("scopes").array().notNull(),
  resource: text("resource"),
  codeChallenge: text("codeChallenge").notNull(),
  codeChallengeMethod: text("codeChallengeMethod").notNull().default("S256"),
  expiresAt: timestamp("expiresAt", { mode: "date" }).notNull(),
  consumedAt: timestamp("consumedAt", { mode: "date" }),
  createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
})

export const oauthTokenType = pgEnum("oauth_token_type", ["access", "refresh"])

/**
 * Access + refresh tokens for the connector. Hash-only storage; the raw token
 * is returned once from the token endpoint and never persisted.
 *
 * - `familyId` groups every token descended from one authorization code, so a
 *   replayed refresh token can revoke the entire grant (`L2-MCP-27`).
 * - `parentId` is the refresh token this one was rotated from.
 * - `userTokenVersion` snapshots `user.tokenVersion` at issue time; a bump
 *   (password change, reset, email change, admin role edit) invalidates the
 *   connector alongside the browser sessions (`L2-AUTH-36`).
 * - `resource` binds the token's audience to the MCP endpoint (RFC 8707).
 *
 * @spec L2-DB-27, L2-MCP-23, L2-MCP-27, L2-MCP-29, L2-MCP-33
 */
export const oauthTokens = pgTable(
  "oauth_token",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    type: oauthTokenType("type").notNull(),
    tokenHash: text("tokenHash").notNull().unique(),
    clientId: text("clientId")
      .notNull()
      .references(() => oauthClients.id, { onDelete: "cascade" }),
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    scopes: text("scopes").array().notNull(),
    resource: text("resource"),
    familyId: text("familyId").notNull(),
    parentId: text("parentId"),
    userTokenVersion: integer("userTokenVersion").notNull(),
    expiresAt: timestamp("expiresAt", { mode: "date" }).notNull(),
    revokedAt: timestamp("revokedAt", { mode: "date" }),
    lastUsedAt: timestamp("lastUsedAt", { mode: "date" }),
    createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    // Family revocation on refresh-token replay (`L2-MCP-27`).
    index("oauth_token_family_idx").on(t.familyId),
    // Per-user grant listing + disconnect in the account UI (`L2-MCP-17`).
    index("oauth_token_user_client_idx").on(t.userId, t.clientId),
  ]
)
