import { drizzle } from "drizzle-orm/node-postgres"

import * as schema from "./schema"

/**
 * Drizzle client over node-postgres. Reads `DATABASE_URL` from the environment.
 * The Next app provides it via `.env`; standalone scripts must import
 * `./load-env` before this module.
 *
 * @spec L2-DB-01
 */
export const db = drizzle(process.env.DATABASE_URL!, { schema })

export type Db = typeof db
