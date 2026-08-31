/**
 * Shared constants for the e2e suite. The tests run against a dedicated
 * `backflip_test` database on the local dev postgres — never the dev database.
 */

const HOST = process.env.E2E_PG_HOST ?? "localhost"
const PORT = process.env.E2E_PG_PORT ?? "5544"
const USER = process.env.E2E_PG_USER ?? "backflip"
const PASSWORD = process.env.E2E_PG_PASSWORD ?? "backflip_local_dev"

export const TEST_DB_NAME = "backflip_test"

/** Connection to the maintenance db, used to create/drop the test db. */
export const ADMIN_DATABASE_URL = `postgres://${USER}:${PASSWORD}@${HOST}:${PORT}/postgres`

export const TEST_DATABASE_URL = `postgres://${USER}:${PASSWORD}@${HOST}:${PORT}/${TEST_DB_NAME}`

export const PORT_APP = 3170
export const BASE_URL = `http://localhost:${PORT_APP}`

export const OWNER = {
  email: "owner@e2e.test",
  password: "e2e-Owner-Pass-2026",
  name: "Olive Owner",
  role: "owner" as const,
}

export const TEAMMATE = {
  email: "teammate@e2e.test",
  password: "e2e-Teammate-Pass-2026",
  name: "Tim Teammate",
  role: "teammate" as const,
}
