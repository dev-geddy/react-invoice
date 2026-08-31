import { existsSync, readdirSync, readFileSync, statSync } from "node:fs"
import { join, relative, resolve } from "node:path"

import {
  buildIndex,
  specIdsIn,
  type DocsIndex,
  type RawDoc,
} from "./parse-docs"

/**
 * Disk side of the docs index: finds the repo root, reads `/docs/**\/*.md`, and
 * greps `@spec` tags out of the source tree. Runs in two places only — the dev
 * server (live read on each request) and the build-time generator. Production
 * never calls this: the standalone bundle ships without `/docs`.
 *
 * @spec L2-UI-21
 */

/** Trees that own `@spec` tags. Everything else is generated or vendored. */
const SPEC_ROOTS = ["apps", "packages", "devops"]
const SPEC_EXTS = [
  ".ts",
  ".tsx",
  ".mts",
  ".mjs",
  ".js",
  ".css",
  ".sh",
  ".yml",
  ".yaml",
]
const SPEC_FILENAMES = [/^Dockerfile/, /^Caddyfile$/]
const SKIP_DIRS = new Set([
  "node_modules",
  ".next",
  ".turbo",
  ".git",
  "dist",
  "coverage",
  "test-results",
  "playwright-report",
])

/** Climb from cwd until `docs/constitution.md` shows up (cwd = `apps/web`). */
export function repoRoot(from = process.cwd()): string {
  let dir = resolve(from)
  for (let i = 0; i < 6; i++) {
    if (existsSync(join(dir, "docs", "constitution.md"))) return dir
    const parent = resolve(dir, "..")
    if (parent === dir) break
    dir = parent
  }
  throw new Error(`docs/constitution.md not found above ${from}`)
}

function readDir(root: string, dir: string): RawDoc[] {
  const abs = join(root, dir)
  if (!existsSync(abs)) return []
  return readdirSync(abs)
    .filter((f) => f.endsWith(".md"))
    .sort()
    .map((file) => ({
      path: `${dir}/${file}`,
      level: dir.endsWith("contracts") ? (2 as const) : (3 as const),
      domain: file.replace(/\.md$/, ""),
      content: readFileSync(join(abs, file), "utf8"),
    }))
}

function walk(dir: string, out: string[]) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".") && entry.name !== ".env.example") continue
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue
      walk(full, out)
      continue
    }
    const named = SPEC_FILENAMES.some((re) => re.test(entry.name))
    if (!named && !SPEC_EXTS.some((ext) => entry.name.endsWith(ext))) continue
    if (statSync(full).size > 512_000) continue
    out.push(full)
  }
}

/** Spec ID → repo-relative files whose `@spec` tag names it. */
function scanSpecTags(root: string): Record<string, string[]> {
  const files: string[] = []
  for (const dir of SPEC_ROOTS) {
    const abs = join(root, dir)
    if (existsSync(abs)) walk(abs, files)
  }
  const refs: Record<string, string[]> = {}
  for (const file of files) {
    const content = readFileSync(file, "utf8")
    if (!content.includes("@spec")) continue
    const rel = relative(root, file)
    for (const id of specIdsIn(content)) {
      ;(refs[id] ??= []).push(rel)
    }
  }
  for (const id of Object.keys(refs)) refs[id]!.sort()
  return refs
}

export function readDocsFromDisk(from?: string): DocsIndex {
  const root = repoRoot(from)
  const docs: RawDoc[] = [
    {
      path: "docs/constitution.md",
      level: 1,
      domain: "platform",
      content: readFileSync(join(root, "docs", "constitution.md"), "utf8"),
    },
    ...readDir(root, "docs/contracts"),
    ...readDir(root, "docs/notes"),
  ]
  return buildIndex(docs, scanSpecTags(root))
}
