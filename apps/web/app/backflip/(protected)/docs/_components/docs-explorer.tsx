"use client"

import { useMemo, useState } from "react"

import { cn } from "@workspace/ui/lib/utils"
import { Button } from "@workspace/ui/components/button"
import { RiCloseLine, RiExternalLinkLine } from "@remixicon/react"

import {
  BADGE_ORDER,
  buildGraph,
  childCount,
  severity,
  visibleColumns,
  NO_SELECTION,
  type DocsGraph,
  type DriftBadge,
  type Selection,
} from "../_lib/docs-graph"
import type { DocClause, DocsIndex, DocLevel } from "../_lib/parse-docs"
import { ClauseDetail } from "./clause-detail"
import { DriftBadgePill, IdChip } from "./drift-badge"

/**
 * Docs explorer: a three-level cascade (L1 Constitution | L2 Contracts |
 * L3 Notes) over a markdown reading pane. Selections filter in both directions
 * — an invariant narrows the contracts implementing it, a note narrows the
 * contracts it cites — and the domain chips constrain all three columns.
 *
 * Read-only by contract (`L2-UI-22`): nothing here writes to /docs.
 *
 * @spec L2-UI-20, L2-UI-22
 */
const COLUMN_META: { level: DocLevel; title: string; hint: string }[] = [
  { level: 1, title: "L1 · Constitution", hint: "why · invariants" },
  { level: 2, title: "L2 · Contracts", hint: "what · interfaces" },
  { level: 3, title: "L3 · Notes", hint: "how · volatile" },
]

const LEVEL_KEYS = { 1: "l1", 2: "l2", 3: "l3" } as const

export function DocsExplorer({ index }: { index: DocsIndex }) {
  const graph = useMemo(() => buildGraph(index), [index])
  const [domain, setDomain] = useState<string | null>(null)
  const [selection, setSelection] = useState<Selection>(NO_SELECTION)
  const [detailKey, setDetailKey] = useState<string | null>(null)
  const [focused, setFocused] = useState(false)

  const columns = useMemo(
    () => visibleColumns(graph, domain, selection),
    [graph, domain, selection]
  )
  const detail = detailKey ? graph.byKey.get(detailKey) : null
  const focusId = selection.l2
    ? (graph.byKey.get(selection.l2)?.id ?? null)
    : null

  function pick(clause: DocClause) {
    const key = LEVEL_KEYS[clause.level]
    const deselect = selection[key] === clause.key
    setSelection({ ...selection, [key]: deselect ? null : clause.key })
    setDetailKey(deselect ? null : clause.key)
    setFocused(false)
  }

  /** Trace links in the detail pane jump without disturbing the cascade. */
  function jump(key: string) {
    setDetailKey(key)
    setFocused(false)
  }

  function pickDomain(next: string | null) {
    setDomain(next)
    // Contract/notes selections are domain-scoped; drop the ones that fell out.
    const keep = (key: string | null) => {
      const clause = key ? graph.byKey.get(key) : null
      return clause && (!next || clause.domain === next) ? key : null
    }
    setSelection((prev) => ({
      l1: prev.l1,
      l2: keep(prev.l2),
      l3: keep(prev.l3),
    }))
    if (
      detailKey &&
      !keep(detailKey) &&
      graph.byKey.get(detailKey)?.level !== 1
    ) {
      setDetailKey(null)
    }
  }

  const filtering =
    domain !== null || selection.l1 || selection.l2 || selection.l3

  return (
    <div className="flex h-[calc(100svh-var(--header-height))] min-h-0 flex-col bg-card">
      <header className="flex flex-wrap items-end justify-between gap-3 px-4 pt-4 pb-3 lg:px-6">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Docs</h1>
          <p className="text-sm text-muted-foreground">
            Constitution, contracts and notes as they sit in the repo. Pick any
            level to trace it up and down.
          </p>
        </div>
        <a
          href="https://github.com/dev-geddy/backflip#readme"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          README on GitHub
          <RiExternalLinkLine className="size-3.5" />
        </a>
      </header>

      <div className="flex flex-wrap items-center gap-1.5 border-b px-4 pb-3 lg:px-6">
        <Chip active={domain === null} onClick={() => pickDomain(null)}>
          All domains
        </Chip>
        {graph.index.domains.map((d) => (
          <Chip
            key={d.key}
            active={domain === d.key}
            onClick={() => pickDomain(domain === d.key ? null : d.key)}
          >
            {d.label}
            <span className="ml-1 tabular-nums opacity-60">{d.contracts}</span>
          </Chip>
        ))}
        {filtering ? (
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto h-7 shrink-0 gap-1 text-xs text-muted-foreground"
            onClick={() => {
              setDomain(null)
              setSelection(NO_SELECTION)
              setDetailKey(null)
            }}
          >
            <RiCloseLine className="size-3.5" />
            Reset
          </Button>
        ) : null}
      </div>

      <div className="grid min-h-0 shrink-0 grid-cols-1 md:h-[46%] md:grid-cols-3">
        {COLUMN_META.map((meta) => {
          const items = columns[LEVEL_KEYS[meta.level]]
          const selectedKey = selection[LEVEL_KEYS[meta.level]]
          return (
            <section
              key={meta.level}
              className="flex max-h-72 min-h-0 flex-col border-b bg-background md:max-h-none md:border-b-0 md:not-last:border-r"
            >
              <div className="flex items-baseline gap-2 border-b px-3 py-2">
                <span className="text-[11px] font-medium tracking-wide uppercase">
                  {meta.title}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {meta.hint}
                </span>
                <span className="ml-auto text-[11px] text-muted-foreground tabular-nums">
                  {items.length}
                </span>
              </div>
              <ul className="min-h-0 flex-1 overflow-y-auto">
                {items.map((clause) => (
                  <ClauseRow
                    key={clause.key}
                    clause={clause}
                    count={childCount(graph, clause, domain)}
                    badges={graph.badges.get(clause.key) ?? []}
                    selected={selectedKey === clause.key}
                    reading={detailKey === clause.key}
                    showDomain={meta.level !== 1 && domain === null}
                    onClick={() => pick(clause)}
                  />
                ))}
                {items.length === 0 ? (
                  <li className="px-3 py-6 text-center text-xs text-muted-foreground">
                    Nothing at this level for the current filter.
                  </li>
                ) : null}
              </ul>
            </section>
          )
        })}
      </div>

      <div className="flex min-h-0 flex-1 flex-col border-t">
        {detail ? (
          <ClauseDetail
            clause={detail}
            graph={graph}
            focusId={focusId}
            focused={focused}
            onToggleFocus={() => setFocused((v) => !v)}
            onPick={jump}
          />
        ) : (
          <IndexSummary graph={graph} onPick={jump} />
        )}
      </div>
    </div>
  )
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "shrink-0 rounded-full border px-2.5 py-1 text-xs transition-colors",
        active
          ? "border-primary/30 bg-primary/10 text-foreground"
          : "text-muted-foreground hover:text-foreground"
      )}
    >
      {children}
    </button>
  )
}

function ClauseRow({
  clause,
  count,
  badges,
  selected,
  reading,
  showDomain,
  onClick,
}: {
  clause: DocClause
  count: number
  badges: DriftBadge[]
  selected: boolean
  reading: boolean
  showDomain: boolean
  onClick: () => void
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "flex w-full items-center gap-2 border-l-2 px-3 py-1.5 text-left text-[13px]",
          selected
            ? "border-l-primary bg-muted"
            : reading
              ? "border-l-transparent bg-muted/50"
              : "border-l-transparent hover:bg-muted/50"
        )}
      >
        {clause.id ? (
          <IdChip id={clause.id} className="shrink-0" />
        ) : (
          <span className="shrink-0 rounded border border-dashed px-1 py-px font-mono text-[10px] leading-4 text-muted-foreground">
            {showDomain ? clause.domain : "prose"}
          </span>
        )}
        <span className="min-w-0 flex-1 truncate" title={clause.title}>
          {clause.title}
        </span>
        {badges.map((badge) => (
          <DriftBadgePill key={badge} badge={badge} />
        ))}
        {count > 0 ? (
          <span className="shrink-0 text-[11px] text-muted-foreground tabular-nums">
            {count}
          </span>
        ) : null}
      </button>
    </li>
  )
}

/** Landing state: what the index knows, and where it is drifting. */
function IndexSummary({
  graph,
  onPick,
}: {
  graph: DocsGraph
  onPick: (key: string) => void
}) {
  const { clauses, codeRefs, brokenRefs } = graph.index
  const counted = (level: DocLevel) =>
    clauses.filter((c) => c.level === level).length
  const drifting = clauses
    .filter((c) => graph.badges.has(c.key))
    .sort(
      (a, b) =>
        severity(graph.badges.get(a.key) ?? []) -
        severity(graph.badges.get(b.key) ?? [])
    )
  const tally = BADGE_ORDER.map((badge) => ({
    badge,
    count: drifting.filter((c) => graph.badges.get(c.key)?.includes(badge))
      .length,
  })).filter((t) => t.count > 0)
  const tagged = Object.keys(codeRefs).length

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 lg:px-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Constitution" value={counted(1)} hint="L1 clauses" />
        <Stat label="Contracts" value={counted(2)} hint="L2 clauses" />
        <Stat label="Notes" value={counted(3)} hint="L3 sections" />
        <Stat label="Spec-tagged IDs" value={tagged} hint="found in code" />
      </div>

      <div className="mt-5 mb-2 flex flex-wrap items-center gap-2">
        <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
          Drift ({drifting.length})
        </p>
        {tally.map((t) => (
          <span key={t.badge} className="flex items-center gap-1">
            <DriftBadgePill badge={t.badge} />
            <span className="text-[11px] text-muted-foreground tabular-nums">
              {t.count}
            </span>
          </span>
        ))}
      </div>
      {brokenRefs.length ? (
        <p className="mb-2 text-xs text-muted-foreground">
          Cited but never defined:{" "}
          {brokenRefs.map((id) => (
            <IdChip key={id} id={id} className="mr-1" />
          ))}
        </p>
      ) : null}
      <ul className="divide-y rounded-lg border">
        {drifting.slice(0, 40).map((clause) => (
          <li key={clause.key}>
            <button
              type="button"
              onClick={() => onPick(clause.key)}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] hover:bg-muted/50"
            >
              {clause.id ? <IdChip id={clause.id} /> : null}
              <span className="min-w-0 flex-1 truncate">{clause.title}</span>
              {(graph.badges.get(clause.key) ?? []).map((badge) => (
                <DriftBadgePill key={badge} badge={badge} />
              ))}
            </button>
          </li>
        ))}
      </ul>
      {drifting.length > 40 ? (
        <p className="mt-2 text-[11px] text-muted-foreground">
          + {drifting.length - 40} more — filter by domain to narrow.
        </p>
      ) : null}
    </div>
  )
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string
  value: number
  hint: string
}) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      <p className="text-[11px] text-muted-foreground">{hint}</p>
    </div>
  )
}
