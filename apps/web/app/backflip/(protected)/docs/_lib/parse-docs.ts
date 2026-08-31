/**
 * Pure parser for the three-level doc system (`/docs`). No fs, no Next — takes
 * raw file contents in, returns one serializable index out, so the same code
 * runs in the dev server (live disk read) and in the build-time generator.
 *
 * What it extracts:
 * - clauses — an ID'd bullet (`- \`L2-UI-05\` — …`) or, for prose sections, the
 *   whole `##` section. Clause = one row in a column.
 * - cite edges — L2 → L1 (`Implements L1:` header or inline IDs), L3 → L2
 *   (any L2 ID inside the section), L2 → L2 (`Depends on L2:`).
 * - drift signals — `[NEEDS HUMAN CONFIRMATION]` markers, plus the `@spec`
 *   tag map handed in by the caller (spec ID → source files).
 *
 * @spec L2-UI-21, L2-UI-23
 */

export type DocLevel = 1 | 2 | 3

export type DocClause = {
  /** Stable per-index key. IDs are unique when present; prose falls back to a slug. */
  key: string
  id: string | null
  level: DocLevel
  /** `platform` for L1 (cross-cutting), else the contract/notes domain. */
  domain: string
  section: string
  title: string
  /** Markdown source of the clause, rendered verbatim in the detail pane. */
  body: string
  /** IDs one level up that this clause cites. */
  citesUp: string[]
  /** L2 → L2 edges (contract `Depends on L2:` header). */
  dependsOn: string[]
  needsConfirm: boolean
  /** Repo-relative path of the file this clause came from. */
  source: string
}

export type DocsIndex = {
  clauses: DocClause[]
  domains: { key: string; label: string; contracts: number; notes: number }[]
  /** Spec ID → repo-relative files carrying an `@spec` tag for it. */
  codeRefs: Record<string, string[]>
  /** IDs cited somewhere but defined nowhere. Rendered as a badge, never thrown. */
  brokenRefs: string[]
}

export type RawDoc = {
  /** Repo-relative path, e.g. `docs/contracts/ui.md`. */
  path: string
  level: DocLevel
  domain: string
  content: string
}

const ID_RE = /\bL([123])-[A-Z]+-\d+\b/g
const BULLET_ID_RE = /^-\s+`(L[123]-[A-Z]+-\d+)`\s*(?:—|-|–)?\s*([\s\S]*)$/
const NEEDS_CONFIRM = "[NEEDS HUMAN CONFIRMATION]"

function idsIn(text: string, level?: DocLevel): string[] {
  const out = new Set<string>()
  for (const m of text.matchAll(ID_RE)) {
    if (level && Number(m[1]) !== level) continue
    out.add(m[0])
  }
  return [...out]
}

function slug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48)
}

/** First sentence / clause of a bullet — the column-row label. */
function titleFrom(body: string, fallback: string): string {
  const flat = body
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*/g, "")
    .replace(/\s+/g, " ")
    .trim()
  if (!flat) return fallback
  const cut = flat.split(/(?<=[.。])\s|\s—\s|\s\(/)[0] ?? flat
  return (cut.length > 96 ? `${cut.slice(0, 95)}…` : cut).trim()
}

type Section = { heading: string; lines: string[] }

/** Split a doc into `##` sections. Content before the first `##` is preamble. */
function sections(content: string): {
  preamble: string[]
  sections: Section[]
} {
  const preamble: string[] = []
  const out: Section[] = []
  let current: Section | null = null
  for (const line of content.split("\n")) {
    const heading = /^##\s+(.*)$/.exec(line)
    if (heading) {
      current = { heading: heading[1]!.trim(), lines: [] }
      out.push(current)
      continue
    }
    if (current) current.lines.push(line)
    else preamble.push(line)
  }
  return { preamble, sections: out }
}

/** Bullets that open with a backticked ID, with their continuation lines. */
function idBullets(lines: string[]): { id: string; body: string }[] {
  const out: { id: string; body: string }[] = []
  let open: { id: string; body: string[] } | null = null
  const flush = () => {
    if (open) out.push({ id: open.id, body: open.body.join("\n").trim() })
    open = null
  }
  for (const line of lines) {
    const match = BULLET_ID_RE.exec(line)
    if (match) {
      flush()
      open = { id: match[1]!, body: [match[2] ?? ""] }
      continue
    }
    // Continuation = indented or nested-bullet lines under the open bullet.
    if (open && (/^\s{2,}\S/.test(line) || /^\s+[-*]\s/.test(line))) {
      open.body.push(line.trim())
      continue
    }
    if (line.trim() === "") continue
    flush()
  }
  flush()
  return out
}

/** Lines that are not part of an ID'd bullet — the section's prose remainder. */
function proseOf(lines: string[]): string {
  const kept: string[] = []
  let skipping = false
  for (const line of lines) {
    if (BULLET_ID_RE.test(line)) {
      skipping = true
      continue
    }
    if (skipping && (/^\s{2,}\S/.test(line) || /^\s+[-*]\s/.test(line)))
      continue
    if (line.trim() === "") {
      kept.push(line)
      continue
    }
    skipping = false
    kept.push(line)
  }
  return kept.join("\n").trim()
}

/** Sections that are doc-system boilerplate, not content worth a row. */
const SKIP_SECTIONS = new Set(["Constrained L3"])

function parseDoc(doc: RawDoc): DocClause[] {
  const { preamble, sections: secs } = sections(doc.content)
  const clauses: DocClause[] = []

  // Contract headers carry the file-level edges: `> **Implements L1:** …`.
  const preambleText = preamble.join("\n")
  const fileImplements = /Implements L1:/.test(preambleText)
    ? idsIn(preambleText, 1)
    : []
  const fileDepends = /Depends on L2:/.test(preambleText)
    ? idsIn(preambleText, 2)
    : []

  for (const section of secs) {
    if (SKIP_SECTIONS.has(section.heading)) continue
    const bullets = doc.level === 3 ? [] : idBullets(section.lines)

    for (const bullet of bullets) {
      const inlineUp =
        doc.level === 2 ? idsIn(bullet.body, 1) : idsIn(bullet.body, 2)
      clauses.push({
        key: bullet.id,
        id: bullet.id,
        level: doc.level,
        domain: doc.domain,
        section: section.heading,
        title: titleFrom(bullet.body, bullet.id),
        body: `- \`${bullet.id}\` — ${bullet.body}`,
        // Inline citation wins; otherwise the contract's file-level promise.
        citesUp:
          inlineUp.length > 0
            ? inlineUp
            : doc.level === 2
              ? fileImplements
              : [],
        dependsOn: doc.level === 2 ? fileDepends : [],
        needsConfirm: bullet.body.includes(NEEDS_CONFIRM),
        source: doc.path,
      })
    }

    // L3 has no ID'd bullets by design (notes cite up, they don't define IDs),
    // so the whole section is the clause. L1/L2 prose sections come along too.
    const prose =
      doc.level === 3 ? section.lines.join("\n").trim() : proseOf(section.lines)
    if (!prose || prose === "---") continue
    if (doc.level !== 3 && bullets.length > 0 && prose.length < 24) continue

    const heading = section.heading
    clauses.push({
      key: `${doc.level}:${doc.domain}:${slug(heading)}`,
      id: null,
      level: doc.level,
      domain: doc.domain,
      section: heading,
      // Notes headings often carry their contract ID: "Overview page — L2-UI-03".
      title:
        heading.replace(/\s*[—(-]\s*`?L[123]-[A-Z]+-\d+.*$/, "").trim() ||
        heading,
      body: prose,
      citesUp:
        doc.level === 3
          ? idsIn(`${heading}\n${prose}`, 2)
          : doc.level === 2
            ? idsIn(prose, 1)
            : [],
      dependsOn: [],
      needsConfirm: prose.includes(NEEDS_CONFIRM),
      source: doc.path,
    })
  }

  return clauses
}

const DOMAIN_LABELS: Record<string, string> = {
  platform: "Platform",
  ai: "AI",
  ui: "UI",
  db: "DB",
  mcp: "MCP",
}

function label(key: string): string {
  return DOMAIN_LABELS[key] ?? key[0]!.toUpperCase() + key.slice(1)
}

export function buildIndex(
  docs: RawDoc[],
  codeRefs: Record<string, string[]>
): DocsIndex {
  const clauses = docs.flatMap(parseDoc)

  const defined = new Set(clauses.map((c) => c.id).filter(Boolean) as string[])
  const broken = new Set<string>()
  for (const clause of clauses) {
    for (const cited of [...clause.citesUp, ...clause.dependsOn]) {
      if (!defined.has(cited)) broken.add(cited)
    }
  }
  for (const id of Object.keys(codeRefs)) {
    if (!defined.has(id)) broken.add(id)
  }

  const domainKeys = [...new Set(docs.map((d) => d.domain))].filter(
    (d) => d !== "platform"
  )
  const domains = domainKeys.sort().map((key) => ({
    key,
    label: label(key),
    contracts: clauses.filter((c) => c.domain === key && c.level === 2).length,
    notes: clauses.filter((c) => c.domain === key && c.level === 3).length,
  }))

  return { clauses, domains, codeRefs, brokenRefs: [...broken].sort() }
}

/** `@spec L2-UI-05, L2-UI-12` in any comment syntax → the IDs it names. */
export function specIdsIn(content: string): string[] {
  const out = new Set<string>()
  for (const match of content.matchAll(/@spec\s+([^\n*]+)/g)) {
    for (const id of idsIn(match[1] ?? "")) out.add(id)
  }
  return [...out]
}
