"use client"

import { useMemo, useState } from "react"

import { cn } from "@workspace/ui/lib/utils"

import { canEditUsers, type Role } from "@/app/_lib/auth/permissions"
import { MemberDetail } from "./member-detail"
import { MemberRail } from "./member-rail"
import { MembersList } from "./members-list"
import type { Member, WorkspaceCounts } from "./types"

export type MemberFilter = "all" | "active" | "pending"
export type DetailMode = "overview" | "edit" | "new"

/**
 * Members admin shell (design 1A) — a three-column master/detail: list column,
 * detail pane, context rail. Selection + edit/new mode + search/filter all live
 * here. On < lg the list and detail stack (tapping a row reveals the detail
 * with a back control); the rail shows only at xl+.
 */
export function MembersView({
  members,
  counts,
  sessionRole,
  sessionUserId,
}: {
  members: Member[]
  counts: WorkspaceCounts
  sessionRole?: Role
  sessionUserId?: string
}) {
  const canEdit = canEditUsers(sessionRole)
  const [selectedId, setSelectedId] = useState<string | null>(
    members[0]?.id ?? null
  )
  const [mode, setMode] = useState<DetailMode>("overview")
  const [query, setQuery] = useState("")
  const [filter, setFilter] = useState<MemberFilter>("all")
  // On mobile the detail overlays the list; desktop shows both.
  const [mobileDetail, setMobileDetail] = useState(false)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return members.filter((m) => {
      if (filter !== "all" && m.status !== filter) return false
      if (!q) return true
      return (
        (m.name ?? "").toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q)
      )
    })
  }, [members, query, filter])

  const selected =
    mode === "new" ? null : (members.find((m) => m.id === selectedId) ?? null)

  function selectMember(id: string) {
    setSelectedId(id)
    setMode("overview")
    setMobileDetail(true)
  }

  function startNew() {
    setMode("new")
    setMobileDetail(true)
  }

  return (
    <div className="flex h-full min-h-0 bg-card">
      {/* List — on the header canvas, not the card */}
      <div
        className={cn(
          "min-h-0 w-full flex-col overflow-hidden bg-background lg:flex lg:w-[372px] lg:flex-none lg:border-r",
          mobileDetail ? "hidden" : "flex"
        )}
      >
        <MembersList
          members={filtered}
          total={members.length}
          selectedId={mode === "new" ? null : selectedId}
          query={query}
          filter={filter}
          canEdit={canEdit}
          onQueryChange={setQuery}
          onFilterChange={setFilter}
          onSelect={selectMember}
          onNew={startNew}
        />
      </div>

      {/* Detail — keeps the card surface */}
      <div
        className={cn(
          "min-h-0 flex-1 flex-col overflow-hidden bg-card lg:flex",
          mobileDetail ? "flex" : "hidden"
        )}
      >
        <MemberDetail
          member={selected}
          mode={mode}
          canEdit={canEdit}
          isSelf={selected != null && selected.id === sessionUserId}
          onEdit={() => setMode("edit")}
          onCancelEdit={() => setMode("overview")}
          onSaved={() => setMode("overview")}
          onCreated={() => {
            setMode("overview")
            setMobileDetail(false)
          }}
          onCancelNew={() => {
            setMode("overview")
            setMobileDetail(false)
          }}
          onBack={() => setMobileDetail(false)}
          onRemoved={() => {
            setSelectedId(null)
            setMode("overview")
            setMobileDetail(false)
          }}
        />
      </div>

      <div className="hidden min-h-0 w-[300px] flex-none flex-col overflow-y-auto border-l bg-muted/50 p-4 xl:flex">
        <MemberRail member={selected} counts={counts} />
      </div>
    </div>
  )
}
