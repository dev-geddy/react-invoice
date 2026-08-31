import path from "node:path"
import { fileURLToPath } from "node:url"

import { config } from "dotenv"

// Repo root = three levels up from packages/db/src.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..")

// .env (db/infra creds) + .env.local (runtime Auth.js secrets). Later files win.
// Used by drizzle.config; the owner seed loads its own env inline (`.env` + `.env.init`).
config({ path: [path.join(root, ".env"), path.join(root, ".env.local")] })
