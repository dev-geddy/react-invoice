"use client"

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@workspace/ui/components/avatar"
import { cn } from "@workspace/ui/lib/utils"
import { RiAddLine, RiGoogleFill, RiSearchLine } from "@remixicon/react"

import { ROLE_LABELS } from "@/app/_lib/auth/permissions"
import type { MemberFilter } from "./members-view"
import type { Member } from "./types"

function initials(value: string) {
  return value.slice(0, 2).toUpperCase()
}

const FILTERS: { value: MemberFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "pending", label: "Pending" },
]

const STATUS_DOT: Record<Member["status"], string> = {
  active: "bg-emerald-500",
  pending: "bg-amber-500",
}
const STATUS_LABEL: Record<Member["status"], string> = {
  active: "Active",
  pending: "Pending",
}

/** List column: header + count + New, search, filter pills, member rows. */
export function MembersList({
  members,
  total,
  selectedId,
  query,
  filter,
  canEdit,
  onQueryChange,
  onFilterChange,
  onSelect,
  onNew,
}: {
  members: Member[]
  total: number
  selectedId: string | null
  query: string
  filter: MemberFilter
  canEdit: boolean
  onQueryChange: (q: string) => void
  onFilterChange: (f: MemberFilter) => void
  onSelect: (id: string) => void
  onNew: () => void
}) {
  return (
    <div className="flex min-h-0 flex-col">
      {/* Header */}
      <div className="flex h-14 items-center gap-2 border-b px-4">
        <div className="flex items-baseline gap-1.5">
          <span className="text-sm font-semibold">Members</span>
          <span className="text-xs text-muted-foreground">· {total}</span>
        </div>
        {canEdit ? (
          <button
            type="button"
            onClick={onNew}
            className="ml-auto inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90"
          >
            <RiAddLine className="size-4" />
            New
          </button>
        ) : null}
      </div>

      {/* Search + filter pills */}
      <div className="flex flex-col gap-2.5 border-b px-4 py-3">
        <div className="flex h-9 items-center gap-2 rounded-md border px-2.5 focus-within:border-ring">
          <RiSearchLine className="size-4 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Search members…"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
        <div className="flex items-center gap-1">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => onFilterChange(f.value)}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                filter === f.value
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Rows */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {members.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">
            No members match.
          </p>
        ) : (
          <ul>
            {members.map((m) => {
              const label = m.name || m.email
              const active = m.id === selectedId
              return (
                <li key={m.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(m.id)}
                    className={cn(
                      "relative flex w-full items-center gap-3 border-l-2 px-4 py-2.5 text-left transition-colors",
                      active
                        ? "border-primary bg-muted"
                        : "border-transparent hover:bg-muted/50"
                    )}
                  >
                    <Avatar className="size-8 rounded-full">
                      {m.image ? (
                        <AvatarImage src={m.image} alt={label} />
                      ) : null}
                      <AvatarFallback className="rounded-full text-xs">
                        {initials(label)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-sm font-medium">
                          {label}
                        </span>
                        {m.usesGoogle ? (
                          <RiGoogleFill
                            className="size-3.5 flex-none text-muted-foreground"
                            aria-label="Google sign-in"
                          />
                        ) : null}
                      </div>
                      <div className="truncate font-mono text-xs text-muted-foreground">
                        {m.email}
                      </div>
                    </div>
                    <div className="flex w-16 flex-none items-center gap-1.5">
                      <span
                        className={cn(
                          "size-1.5 rounded-full",
                          STATUS_DOT[m.status]
                        )}
                      />
                      <span className="text-xs text-muted-foreground">
                        {STATUS_LABEL[m.status]}
                      </span>
                    </div>
                    <span className="sr-only">{ROLE_LABELS[m.role]}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
