import "./src/load-env"

import { defineConfig } from "drizzle-kit"

/** drizzle-kit config: generate/migrate SQL. @spec L2-DB-08 */
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema.ts",
  out: "./migrations",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
})
