import { accounts, aiConfig, db, emailConfig, users } from "@workspace/db"
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@workspace/ui/components/avatar"
import { cn } from "@workspace/ui/lib/utils"
import { desc, eq } from "drizzle-orm"
import Link from "next/link"

import { RiCheckLine } from "@remixicon/react"

import { AppVersion } from "@/app/_components/app-version"
import { requireCapability } from "@/app/_lib/auth/guard"
import { canViewUsers } from "@/app/_lib/auth/permissions"
import { SectionLabel } from "./_components/page-heading"
import { OverviewJump } from "./_components/overview-jump"

const DATE_FMT = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
})
const JOINED_FMT = new Intl.DateTimeFormat("en-US", { dateStyle: "medium" })

function initials(value: string) {
  return value.slice(0, 2).toUpperCase()
}

/**
 * /backflip — admin Overview (design 5A): greeting + quick-jump + real stat
 * cards + a setup checklist and recent members. All figures derive from real
 * data (users / ai_config / email_config); no mock metrics.
 */
export default async function BackflipOverviewPage() {
  const sessionUser = await requireCapability("dashboard")
  // The member roster (names + emails) is user data — only `users.view` roles
  // (owner/admin) see it; teammates get the dashboard without the roster.
  const canView = canViewUsers(sessionUser.role)

  const userRows = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      image: users.image,
      createdAt: users.createdAt,
      emailVerified: users.emailVerified,
      passwordHash: users.passwordHash,
    })
    .from(users)
    .orderBy(desc(users.createdAt))

  const accountRows = await db
    .select({ userId: accounts.userId })
    .from(accounts)
  const hasOAuth = new Set(accountRows.map((a) => a.userId))

  let active = 0
  for (const u of userRows) {
    if (u.passwordHash || u.emailVerified || hasOAuth.has(u.id)) active++
  }
  const total = userRows.length
  const pending = total - active

  const aiRows = await db.select().from(aiConfig)
  const providersEnabled = aiRows.filter((r) => r.enabled).length
  const providersConfigured = aiRows.filter((r) => r.apiKeyEnc).length

  const [emailRow] = await db
    .select()
    .from(emailConfig)
    .where(eq(emailConfig.provider, "resend"))
  const emailConfigured = Boolean(emailRow?.apiKeyEnc)

  const recent = userRows.slice(0, 4)
  const firstName = sessionUser.name?.split(" ")[0] || "there"

  const steps = [
    {
      label: "Set your display name",
      done: Boolean(sessionUser.name),
      href: "/backflip/account",
      cta: "Account",
    },
    {
      label: "Invite your team",
      done: total > 1,
      href: "/backflip/users",
      cta: "Add member",
    },
    {
      label: "Connect an AI provider",
      done: providersConfigured > 0,
      href: "/backflip/settings",
      cta: "Integrations",
    },
    {
      label: "Configure email sending",
      done: emailConfigured,
      href: "/backflip/settings",
      cta: "Integrations",
    },
  ]
  const doneCount = steps.filter((s) => s.done).length

  return (
    // Canvas mirrors ui-samples (bg-muted light / bg-background dark) so
    // bg-card cards pop in light mode.
    <div className="h-full overflow-y-auto bg-muted dark:bg-background">
      <div className="relative min-h-full">
        <div className="relative mx-auto flex max-w-[900px] flex-col gap-6 p-6 lg:p-8">
          {/* Greeting */}
          <div>
            <div className="text-sm text-muted-foreground">
              {DATE_FMT.format(new Date())}
            </div>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">
              Welcome back, {firstName}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Jump to anything, or pick up where you left off.
            </p>
          </div>

          <OverviewJump />

          {/* Stat cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard label="Members" value={String(total)}>
              <span className="text-muted-foreground">
                {active} active · {pending} pending
              </span>
            </StatCard>
            <StatCard
              label="Integrations"
              value={String(providersEnabled)}
              unit="enabled"
            >
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <span
                  className={cn(
                    "size-1.5 rounded-full",
                    providersEnabled > 0
                      ? "bg-emerald-500"
                      : "bg-muted-foreground/30"
                  )}
                />
                {providersEnabled > 0 ? "All healthy" : "None enabled"}
              </span>
            </StatCard>
            <StatCard label="Pending" value={String(pending)}>
              <span className="text-muted-foreground">
                Awaiting first sign-in
              </span>
            </StatCard>
          </div>

          {/* Info cards */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* Setup checklist */}
            <div className="rounded-xl border bg-card p-5">
              <div className="text-sm font-semibold">Finish setting up</div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                {doneCount} of {steps.length} complete
              </div>
              <div className="mt-4 flex flex-col">
                {steps.map((s, i) => (
                  <div
                    key={s.label}
                    className={cn(
                      "flex items-center gap-3 py-2",
                      i < steps.length - 1 && "border-b"
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-[18px] flex-none items-center justify-center rounded-full",
                        s.done
                          ? "bg-emerald-500"
                          : "border-[1.5px] border-input"
                      )}
                    >
                      {s.done ? (
                        <RiCheckLine className="size-3 text-white" />
                      ) : null}
                    </span>
                    {s.done ? (
                      <span className="flex-1 text-[13px] text-muted-foreground line-through">
                        {s.label}
                      </span>
                    ) : (
                      <>
                        <span className="flex-1 text-[13px]">{s.label}</span>
                        <Link
                          href={s.href}
                          className="text-xs text-muted-foreground hover:text-foreground"
                        >
                          {s.cta} →
                        </Link>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Recent members — names/emails, gated to users.view roles. */}
            {canView && (
              <div className="rounded-xl border bg-card p-5">
                <div className="text-sm font-semibold">Recent members</div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  Newest to join
                </div>
                <div className="mt-4 flex flex-col">
                  {recent.map((u, i) => {
                    const label = u.name || u.email
                    return (
                      <div
                        key={u.id}
                        className={cn(
                          "flex items-center gap-3 py-2",
                          i < recent.length - 1 && "border-b"
                        )}
                      >
                        <Avatar className="size-8 rounded-full">
                          {u.image ? (
                            <AvatarImage src={u.image} alt={label} />
                          ) : null}
                          <AvatarFallback className="rounded-full text-[10px]">
                            {initials(label)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[13px]">
                            <span className="font-medium">{label}</span> joined
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {JOINED_FMT.format(u.createdAt)}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Deployed release marker — tells an operator which build is live. */}
          <AppVersion className="text-center" />
        </div>
      </div>
    </div>
  )
}

function StatCard({
  label,
  value,
  unit,
  children,
}: {
  label: string
  value: string
  unit?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col rounded-xl border bg-card p-5">
      <SectionLabel>{label}</SectionLabel>
      <div className="mt-2 flex items-baseline gap-1.5">
        <span className="text-2xl font-semibold tracking-tight tabular-nums">
          {value}
        </span>
        {unit ? (
          <span className="text-sm font-medium text-muted-foreground">
            {unit}
          </span>
        ) : null}
      </div>
      <div className="mt-2 text-xs">{children}</div>
    </div>
  )
}
