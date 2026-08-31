"use client"

import { RiCheckLine, RiSubtractLine } from "@remixicon/react"

import { can, ROLE_LABELS, type Capability } from "@/app/_lib/auth/permissions"
import { SectionLabel } from "../../_components/page-heading"
import type { Member, WorkspaceCounts } from "./types"

/** Capabilities shown in the permissions card, in display order. */
const CAPS: { cap: Capability; label: string }[] = [
  { cap: "dashboard", label: "View dashboard" },
  { cap: "account", label: "Manage own account" },
  { cap: "users.view", label: "View members" },
  { cap: "users.edit", label: "Manage members" },
  { cap: "settings", label: "Manage settings" },
]

/** Context rail: selected member's permissions + workspace stats + help. */
export function MemberRail({
  member,
  counts,
}: {
  member: Member | null
  counts: WorkspaceCounts
}) {
  return (
    <div className="flex flex-col gap-4">
      {member ? (
        <section className="flex flex-col gap-3">
          <SectionLabel>{ROLE_LABELS[member.role]} permissions</SectionLabel>
          <div className="rounded-xl border bg-card p-4">
            <ul className="flex flex-col gap-2.5">
              {CAPS.map(({ cap, label }) => {
                const ok = can(member.role, cap)
                return (
                  <li key={cap} className="flex items-center gap-2.5 text-sm">
                    {ok ? (
                      <RiCheckLine className="size-4 flex-none text-emerald-600" />
                    ) : (
                      <RiSubtractLine className="size-4 flex-none text-muted-foreground/60" />
                    )}
                    <span className={ok ? "" : "text-muted-foreground"}>
                      {label}
                    </span>
                  </li>
                )
              })}
            </ul>
          </div>
        </section>
      ) : null}

      <section className="flex flex-col gap-3">
        <SectionLabel>This workspace</SectionLabel>
        <div className="rounded-xl border bg-card p-4">
          <dl className="flex flex-col gap-2.5 text-sm">
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">Members</dt>
              <dd className="font-medium tabular-nums">{counts.total}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="flex items-center gap-1.5 text-muted-foreground">
                <span className="size-1.5 rounded-full bg-emerald-500" />
                Active
              </dt>
              <dd className="font-medium tabular-nums">{counts.active}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="flex items-center gap-1.5 text-muted-foreground">
                <span className="size-1.5 rounded-full bg-amber-500" />
                Pending
              </dt>
              <dd className="font-medium tabular-nums">{counts.pending}</dd>
            </div>
          </dl>
        </div>
      </section>

      <div className="rounded-xl border bg-card p-4">
        <div className="text-sm font-medium">Need a hand?</div>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          Roles control what each member can access. Owners manage members and
          settings; changes apply immediately.
        </p>
      </div>
    </div>
  )
}
