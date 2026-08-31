import "server-only"

import type { DocsIndex } from "./parse-docs"

/**
 * The one entry point the route uses to get the docs index.
 *
 * Production reads the build-time artifact: the Docker runner ships only
 * `.next/standalone`, so `/docs` does not exist next to the running server.
 * Development reads the working tree, so doc edits land without a rebuild.
 *
 * Regenerate the artifact with `yarn workspace web docs:index` (the `build`
 * script runs it first).
 *
 * @spec L2-UI-21
 */
export async function getDocsIndex(): Promise<DocsIndex> {
  if (process.env.NODE_ENV === "production") {
    const generated = await import("./docs-index.generated.json")
    return generated.default as unknown as DocsIndex
  }
  const { readDocsFromDisk } = await import("./read-docs")
  return readDocsFromDisk()
}
