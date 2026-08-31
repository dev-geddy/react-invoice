/**
 * Build-time generator for the admin docs explorer index.
 *
 * Runs before `next build` (see the workspace `build` script). Parses
 * `/docs/**\/*.md` plus every `@spec` tag in the source tree into one JSON
 * artifact that the route imports in production — the standalone bundle ships
 * without `/docs`, so nothing can be read from disk at runtime.
 *
 * @spec L2-UI-21
 */
import { writeFileSync } from "node:fs"
import { join } from "node:path"

import { readDocsFromDisk } from "../app/backflip/(protected)/docs/_lib/read-docs"

const OUT = join(
  process.cwd(),
  "app/backflip/(protected)/docs/_lib/docs-index.generated.json"
)

const index = readDocsFromDisk()
writeFileSync(OUT, `${JSON.stringify(index)}\n`)

const counts = [1, 2, 3].map(
  (level) =>
    `L${level}: ${index.clauses.filter((c) => c.level === level).length}`
)
console.log(
  `docs index → ${counts.join(", ")}, ${Object.keys(index.codeRefs).length} spec-tagged IDs` +
    (index.brokenRefs.length ? `, ${index.brokenRefs.length} broken refs` : "")
)
