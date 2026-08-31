import path from "node:path"
import { fileURLToPath } from "node:url"

import bcrypt from "bcryptjs"
import { config } from "dotenv"

// Load the one-off seed env FIRST: `.env` (db creds → DATABASE_URL) + `.env.init`
// (admin seed: ADMIN_EMAIL/ADMIN_PASSWORD). Kept out of `.env.local` so the admin
// password is never injected into the running app (dev + docker load only `.env`
// + `.env.local`). Later files win; missing files are ignored.
// Repo root = four levels up from packages/db/src/seed.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..")
config({ path: [path.join(root, ".env"), path.join(root, ".env.init")] })

/**
 * Seeds (or updates) the platform owner from `.env.init` (one-off, gitignored):
 *   ADMIN_EMAIL (required), ADMIN_PASSWORD (optional)
 *
 * `ADMIN_PASSWORD` is optional: omit it to seed a Google-only owner (no
 * `passwordHash`) — the owner then signs in with Google (they're pre-registered
 * by this seed, so `L2-AUTH-10/11` allows it). When omitted on a re-run, any
 * existing password is preserved (not wiped).
 * Run: `corepack yarn init-owner`.
 *
 * @spec L2-DB-04, L2-DB-15
 */
async function main() {
  // Imported dynamically (not at the top) so `config()` above runs before the
  // db client evaluates — the client reads DATABASE_URL at module-eval time.
  const { db } = await import("../client")
  const { users } = await import("../schema")

  const email = process.env.ADMIN_EMAIL
  const password = process.env.ADMIN_PASSWORD

  if (!email) {
    throw new Error("ADMIN_EMAIL must be set (define it in .env.init).")
  }

  const passwordHash = password ? await bcrypt.hash(password, 12) : null

  // On update, only overwrite the password when a new one was provided.
  const updateSet: {
    role: "owner"
    name: string
    passwordHash?: string
  } = { role: "owner", name: "Dev Geddy" }
  if (passwordHash) updateSet.passwordHash = passwordHash

  await db
    .insert(users)
    .values({ email, passwordHash, role: "owner", name: "Dev Geddy" })
    .onConflictDoUpdate({ target: users.email, set: updateSet })

  console.log(
    password
      ? `✓ Owner seeded: ${email} (password + Google)`
      : `✓ Owner seeded: ${email} (Google-only — no password set)`
  )
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
