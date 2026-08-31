import { nextJsConfig } from "@workspace/eslint-config/next-js"

/** @type {import("eslint").Linter.Config[]} */
export default [
  // Build output of the e2e dev server (next.config.ts / NEXT_DIST_DIR).
  { ignores: [".next-e2e/**"] },
  ...nextJsConfig,
]
