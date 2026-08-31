"use client"

import { useMemo } from "react"

import { cn } from "@workspace/ui/lib/utils"
import { Button } from "@workspace/ui/components/button"
import { RiExternalLinkLine, RiFilter2Line } from "@remixicon/react"

import { Markdown } from "../../_components/markdown"
import type { DocClause } from "../_lib/parse-docs"
import { BADGE_HELP, type DocsGraph } from "../_lib/docs-graph"
import { DriftBadgePill, IdChip } from "./drift-badge"

const REPO_BLOB = "https://github.com/dev-geddy/backflip/blob/master/"

const LEVEL_NAMES = ["", "Constitution", "Contract", "Notes"] as const

/** Notes sections run long; when a contract is selected, offer just its lines. */
function focusLines(body: string, id: string): string {
  const kept = body.split("\n").filter((line) => line.includes(id))
  return kept.length ? kept.join("\n") : body
}

/** The header already carries the ID chip — drop it from the rendered clause. */
function stripLead(body: string, id: string | null): string {
  if (!id) return body
  return body.replace(
    new RegExp(`^-\\s+\`${id}\`\\s*(_\\([a-z]+\\)_)?\\s*(?:—|-|–)?\\s*`),
    ""
  )
}

export function ClauseDetail({
  clause,
  graph,
  focusId,
  focused,
  onToggleFocus,
  onPick,
}: {
  clause: DocClause
  graph: DocsGraph
  /** Contract ID the cascade is currently filtered by, if any. */
  focusId: string | null
  focused: boolean
  onToggleFocus: () => void
  onPick: (key: string) => void
}) {
  const badges = graph.badges.get(clause.key) ?? []
  const down = useMemo(() => {
    if (clause.level === 1 && clause.id) {
      return graph.implementers.get(clause.id) ?? []
    }
    if (clause.level === 2 && clause.id) return graph.notes.get(clause.id) ?? []
    return []
  }, [clause, graph])

  const up = clause.citesUp
    .map((id) => graph.byId.get(id))
    .filter(Boolean) as DocClause[]
  const codeRefs = clause.id ? (graph.index.codeRefs[clause.id] ?? []) : []
  const canFocus =
    clause.level === 3 && focusId !== null && clause.citesUp.includes(focusId)
  const body =
    canFocus && focused && focusId
      ? focusLines(clause.body, focusId)
      : stripLead(clause.body, clause.id)

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b px-4 py-2.5">
        <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
          L{clause.level} · {LEVEL_NAMES[clause.level]}
        </span>
        {clause.id ? <IdChip id={clause.id} /> : null}
        <span className="truncate text-sm font-medium">{clause.title}</span>
        {badges.map((badge) => (
          <DriftBadgePill key={badge} badge={badge} />
        ))}
        <div className="ml-auto flex items-center gap-2">
          {canFocus ? (
            <Button
              variant={focused ? "secondary" : "ghost"}
              size="sm"
              className="h-7 gap-1.5 text-xs"
              onClick={onToggleFocus}
            >
              <RiFilter2Line className="size-3.5" />
              Only {focusId} lines
            </Button>
          ) : null}
          <a
            href={`${REPO_BLOB}${clause.source}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 font-mono text-[11px] text-muted-foreground hover:text-foreground"
          >
            {clause.source}
            <RiExternalLinkLine className="size-3" />
          </a>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto lg:grid-cols-[minmax(0,1fr)_260px]">
        <div className="min-w-0 px-4 py-3 text-[13px] leading-relaxed">
          <Markdown>{body}</Markdown>
        </div>

        <aside className="space-y-4 border-t px-4 py-3 lg:border-t-0 lg:border-l">
          <TraceList
            label={clause.level === 3 ? "Implements" : "Implements (L1)"}
            empty={
              clause.level === 1 ? "Top of the tree." : "No upward citation."
            }
            items={up}
            onPick={onPick}
          />
          <TraceList
            label={clause.level === 1 ? "Contracts" : "Notes"}
            empty={
              clause.level === 3
                ? "Notes are the bottom level."
                : "Nothing cites this yet."
            }
            items={down}
            onPick={onPick}
          />
          <div>
            <p className="mb-1.5 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
              Code (@spec)
            </p>
            {codeRefs.length ? (
              <ul className="space-y-1">
                {codeRefs.map((path) => (
                  <li key={path}>
                    <a
                      href={`${REPO_BLOB}${path}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block truncate font-mono text-[11px] text-muted-foreground hover:text-foreground"
                      title={path}
                    >
                      {path}
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[11px] text-muted-foreground">
                {clause.level === 2
                  ? BADGE_HELP["no-code"]
                  : "Tags are carried by contract IDs."}
              </p>
            )}
          </div>
        </aside>
      </div>
    </div>
  )
}

function TraceList({
  label,
  items,
  empty,
  onPick,
}: {
  label: string
  items: DocClause[]
  empty: string
  onPick: (key: string) => void
}) {
  return (
    <div>
      <p className="mb-1.5 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
        {label}
        {items.length ? (
          <span className="ml-1 tabular-nums">({items.length})</span>
        ) : null}
      </p>
      {items.length ? (
        <ul className="space-y-1">
          {items.map((item) => (
            <li key={item.key}>
              <button
                type="button"
                onClick={() => onPick(item.key)}
                className={cn(
                  "block w-full truncate text-left text-[11px] text-muted-foreground",
                  "hover:text-foreground"
                )}
                title={item.title}
              >
                <span className="font-mono">{item.id ?? item.domain}</span>{" "}
                {item.title}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[11px] text-muted-foreground">{empty}</p>
      )}
    </div>
  )
}
