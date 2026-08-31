import { accounts, db, users } from "@workspace/db"
import { desc } from "drizzle-orm"

import { requireCapability } from "@/app/_lib/auth/guard"
import { MembersView } from "./_components/members-view"
import type { Member, WorkspaceCounts } from "./_components/types"

/** OAuth provider id → display label for the login-method line. */
const PROVIDER_LABELS: Record<string, string> = { google: "Google" }

const JOINED_FMT = new Intl.DateTimeFormat("en-US", { dateStyle: "medium" })

/**
 * /backflip/users — admin Members surface (owner + admin can view; owner can
 * edit). Reads all users newest-first and derives per-member login methods +
 * status (see `MemberStatus`). `passwordHash` is read only to derive a boolean
 * login method server-side — the hash itself never reaches the client.
 */
export default async function UsersPage() {
  const sessionUser = await requireCapability("users.view")

  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      image: users.image,
      role: users.role,
      createdAt: users.createdAt,
      emailVerified: users.emailVerified,
      passwordHash: users.passwordHash,
    })
    .from(users)
    .orderBy(desc(users.createdAt))

  // Linked OAuth providers, grouped by user.
  const accountRows = await db
    .select({ userId: accounts.userId, provider: accounts.provider })
    .from(accounts)
  const providersByUser = new Map<string, string[]>()
  for (const a of accountRows) {
    const list = providersByUser.get(a.userId) ?? []
    list.push(a.provider)
    providersByUser.set(a.userId, list)
  }

  const members: Member[] = rows.map((u) => {
    const providers = providersByUser.get(u.id) ?? []
    const loginMethods: string[] = []
    if (u.passwordHash) loginMethods.push("Password")
    for (const p of providers) loginMethods.push(PROVIDER_LABELS[p] ?? p)

    const emailVerified = Boolean(u.emailVerified)
    const status =
      loginMethods.length > 0 || emailVerified ? "active" : "pending"

    return {
      id: u.id,
      name: u.name,
      email: u.email,
      image: u.image,
      role: u.role,
      loginMethods,
      usesGoogle: providers.includes("google"),
      joined: JOINED_FMT.format(u.createdAt),
      emailVerified,
      status,
    }
  })

  const counts: WorkspaceCounts = {
    total: members.length,
    active: members.filter((m) => m.status === "active").length,
    pending: members.filter((m) => m.status === "pending").length,
  }

  return (
    <MembersView
      members={members}
      counts={counts}
      sessionRole={sessionUser.role}
      sessionUserId={sessionUser.id}
    />
  )
}
