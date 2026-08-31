import crypto from "node:crypto"
import path from "node:path"
import { fileURLToPath } from "node:url"

import bcrypt from "bcryptjs"
import { sql } from "drizzle-orm"
import { drizzle } from "drizzle-orm/node-postgres"
import { migrate } from "drizzle-orm/node-postgres/migrator"
import pg from "pg"

import { users } from "@workspace/db/schema"
import {
  ADMIN_DATABASE_URL,
  BASE_URL,
  OWNER,
  TEAMMATE,
  TEST_DATABASE_URL,
  TEST_DB_NAME,
} from "./env"

// @spec L2-TEST-03, L2-TEST-04

const MIGRATIONS_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../packages/db/migrations"
)

/** Create the test database when it doesn't exist yet. It is never dropped:
 *  a reused dev server (`reuseExistingServer`) holds a live connection pool. */
async function ensureDatabase() {
  const admin = new pg.Client({ connectionString: ADMIN_DATABASE_URL })
  await admin.connect()
  try {
    const { rowCount } = await admin.query(
      "select 1 from pg_database where datname = $1",
      [TEST_DB_NAME]
    )
    if (!rowCount) await admin.query(`create database "${TEST_DB_NAME}"`)
  } finally {
    await admin.end()
  }
}

/** Migrate, then reset auth state and reseed the two fixture users. Config
 *  tables are left as the migrations seeded them. */
async function migrateAndSeed() {
  const pool = new pg.Pool({ connectionString: TEST_DATABASE_URL })
  const db = drizzle(pool)
  try {
    await migrate(db, { migrationsFolder: MIGRATIONS_DIR })

    await db.execute(
      sql`truncate table "user", "account", "session", "verificationToken" cascade`
    )

    for (const account of [OWNER, TEAMMATE]) {
      await db.insert(users).values({
        email: account.email,
        name: account.name,
        role: account.role,
        passwordHash: await bcrypt.hash(account.password, 10),
      })
    }
  } finally {
    await pool.end()
  }
}

/**
 * The connector's own default-off master switch (`connector_config.enabled`,
 * `L2-MCP-25`) is DB-driven now, not `MCP_ENABLED` — nothing else in this
 * harness seeds that row, so every connector route would 404 all suite long
 * without this. Idempotent upsert of the single `kind = "mcp"` row, in the
 * same standalone `pg.Client` + `TEST_DATABASE_URL` style as
 * `connector.spec.ts`'s `bumpTokenVersion`, rather than pulling in the app's
 * drizzle schema here.
 *
 * `dcrMode: "open"` (not the product default `"off"`): most of this suite's
 * existing coverage drives Dynamic Client Registration
 * (`POST /api/oauth/register`) to stand up throwaway clients per test, and
 * `open` keeps that working unmodified. The dedicated DCR-off coverage
 * (`registration mode: DCR off …`) flips this row to `"off"` for the
 * duration of that one test and restores `"open"` in a `finally`, so test
 * order stays irrelevant. `redirectHosts` seeds to the product default
 * (`claude.ai`, `claude.com`) — the allowlist-enforcement test mutates and
 * restores it the same way.
 */
async function seedConnectorConfig(): Promise<void> {
  const client = new pg.Client({ connectionString: TEST_DATABASE_URL })
  await client.connect()
  try {
    await client.query(
      `insert into "connector_config" ("id", "kind", "enabled", "dcrMode", "redirectHosts")
       values ($1, 'mcp', true, 'open', $2)
       on conflict ("kind") do update
         set "enabled" = true,
             "dcrMode" = 'open',
             "redirectHosts" = excluded."redirectHosts",
             "updatedAt" = now()`,
      [crypto.randomUUID(), ["claude.ai", "claude.com"]]
    )
  } finally {
    await client.end()
  }
}

/**
 * The enabled flag above is read through a short-TTL in-process cache in the
 * app (`CONNECTOR_SETTINGS_CACHE_TTL_MS`, 30s at time of writing —
 * `app/_lib/oauth/connector-config.ts`), not a live read on every request. The
 * `webServer` this config boots is started (and its own readiness probe
 * against `BASE_URL` satisfied) *before* Playwright runs this file's default
 * export — confirmed against `createGlobalSetupTasks` in the installed
 * `playwright` package: plugin setup (which is what starts `webServer`) runs
 * ahead of the `globalSetups` array. With `reuseExistingServer` (the local,
 * non-CI default) that means a server left over from an earlier run may
 * already hold a stale cached read from before this run's seed landed — the
 * exact race the connector's own cache-staleness note warns about.
 *
 * So: don't just seed and hope. Poll a real connector route (cheap, GET,
 * publicly cacheable) until it stops 404ing, bounded by the cache TTL plus
 * slack. A fresh server satisfies this near-instantly (its cache starts empty
 * and reads straight from the row we just wrote); a reused one blocks here
 * until its stale cache entry expires and it re-reads. Either way, no test
 * observes the connector before it is actually serving from current settings.
 */
async function waitForConnectorReachable(): Promise<void> {
  // Keep in sync with `CONNECTOR_SETTINGS_CACHE_TTL_MS` in
  // `app/_lib/oauth/connector-config.ts` — this must stay >= that TTL.
  const CACHE_TTL_MS = 30_000
  const TIMEOUT_MS = CACHE_TTL_MS + 10_000
  const POLL_INTERVAL_MS = 500
  const deadline = Date.now() + TIMEOUT_MS

  for (;;) {
    try {
      const response = await fetch(
        `${BASE_URL}/.well-known/oauth-authorization-server`
      )
      if (response.status === 200) return
    } catch {
      // The server passed its own webServer readiness probe already, but
      // treat a transient connection failure the same as "not ready yet".
    }
    if (Date.now() >= deadline) {
      throw new Error(
        `Connector did not become reachable within ${TIMEOUT_MS}ms of seeding ` +
          `connector_config.enabled=true. Either the web server never picked ` +
          `up the seeded row, or CONNECTOR_SETTINGS_CACHE_TTL_MS grew past ` +
          `what this wait budgets for.`
      )
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS))
  }
}

export default async function globalSetup() {
  await ensureDatabase()
  await migrateAndSeed()
  await seedConnectorConfig()
  await waitForConnectorReachable()
}
