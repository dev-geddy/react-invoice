"use client"

import {
  useActionState,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react"
import { useRouter } from "next/navigation"

import { RiArrowLeftLine, RiDeleteBinLine, RiMore2Line } from "@remixicon/react"
import { toast } from "sonner"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@workspace/ui/components/alert-dialog"
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@workspace/ui/components/avatar"
import { Button } from "@workspace/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import {
  Field,
  FieldDescription,
  FieldLabel,
} from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { cn } from "@workspace/ui/lib/utils"

import { ROLE_LABELS, ROLES, type Role } from "@/app/_lib/auth/permissions"
import { deleteUser, updateUser } from "../_actions"
import type { DetailMode } from "./members-view"
import type { Member } from "./types"

const ROLE_DESC: Record<Role, string> = {
  owner: "Full access, including users and settings.",
  admin: "View the dashboard and users.",
  teammate: "Own account and the dashboard only.",
}

function initials(value: string) {
  return value.slice(0, 2).toUpperCase()
}

/** Small Google "G" mark (design 1a sign-in badge). */
function GoogleMark() {
  return (
    <span
      title="Signs in with Google"
      className="inline-flex size-[18px] flex-none items-center justify-center rounded-full border bg-background text-[10px] font-bold text-[#4285f4]"
    >
      G
    </span>
  )
}

export function MemberDetail({
  member,
  mode,
  canEdit,
  isSelf,
  onEdit,
  onCancelEdit,
  onSaved,
  onCreated,
  onCancelNew,
  onBack,
  onRemoved,
}: {
  member: Member | null
  mode: DetailMode
  canEdit: boolean
  isSelf: boolean
  onEdit: () => void
  onCancelEdit: () => void
  onSaved: () => void
  onCreated: () => void
  onCancelNew: () => void
  onBack: () => void
  onRemoved: () => void
}) {
  const backBar = (
    <button
      type="button"
      onClick={onBack}
      className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground lg:hidden"
    >
      <RiArrowLeftLine className="size-4" />
      Members
    </button>
  )

  if (mode === "new") {
    return (
      <div className="min-h-0 flex-1 overflow-y-auto p-5">
        {backBar}
        <NewMemberForm onCreated={onCreated} onCancel={onCancelNew} />
      </div>
    )
  }

  if (!member) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center p-6">
        <p className="text-sm text-muted-foreground">
          Select a member to see details.
        </p>
      </div>
    )
  }

  const label = member.name || member.email

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      {/* Profile header */}
      <div className="flex items-center gap-3 border-b px-5 py-4">
        <div className="min-w-0 flex-1">
          {backBar}
          <div className="flex items-center gap-3">
            <Avatar className="size-13 rounded-full">
              {member.image ? (
                <AvatarImage src={member.image} alt={label} />
              ) : null}
              <AvatarFallback className="rounded-full text-sm">
                {initials(label)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <div className="truncate text-base font-semibold">{label}</div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span
                  className={cn(
                    "size-1.5 rounded-full",
                    member.status === "active"
                      ? "bg-emerald-500"
                      : "bg-amber-500"
                  )}
                />
                {member.status === "active" ? "Active" : "Pending"}
                <span className="text-muted-foreground/50">·</span>
                {ROLE_LABELS[member.role]}
              </div>
            </div>
          </div>
        </div>
        {canEdit && mode === "overview" ? (
          <HeaderActions
            member={member}
            isSelf={isSelf}
            onEdit={onEdit}
            onRemoved={onRemoved}
          />
        ) : null}
      </div>

      <div className="p-5">
        {mode === "edit" && canEdit ? (
          <EditMemberForm
            member={member}
            isSelf={isSelf}
            onSaved={onSaved}
            onCancel={onCancelEdit}
          />
        ) : (
          <Overview member={member} />
        )}
      </div>
    </div>
  )
}

/* ---------------------------- Header actions ----------------------------- */

function HeaderActions({
  member,
  isSelf,
  onEdit,
  onRemoved,
}: {
  member: Member
  isSelf: boolean
  onEdit: () => void
  onRemoved: () => void
}) {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [removing, startRemove] = useTransition()
  const label = member.name || member.email

  function handleRemove() {
    startRemove(async () => {
      const res = await deleteUser(member.id)
      if (res?.ok) {
        toast.success(res.message)
        setConfirmOpen(false)
        onRemoved()
      } else {
        toast.error(res?.message ?? "Couldn't remove user.")
      }
    })
  }

  return (
    <div className="flex flex-none items-center gap-2">
      <Button variant="outline" size="sm" onClick={onEdit}>
        Edit
      </Button>
      {/* Removing yourself / the last owner is blocked server-side too. */}
      {!isSelf ? (
        <>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="outline"
                  size="icon"
                  className="size-8"
                  aria-label="More actions"
                />
              }
            >
              <RiMore2Line className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                className="text-destructive"
                onClick={() => setConfirmOpen(true)}
              >
                <RiDeleteBinLine />
                Remove user
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Remove {label}?</AlertDialogTitle>
                <AlertDialogDescription>
                  This permanently deletes their account and revokes access —
                  including any linked sign-in methods. This can’t be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={removing}>
                  Cancel
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={(e) => {
                    e.preventDefault()
                    handleRemove()
                  }}
                  disabled={removing}
                  className="bg-destructive text-white hover:bg-destructive/90"
                >
                  {removing ? "Removing…" : "Remove user"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      ) : null}
    </div>
  )
}

/* ------------------------------- Overview -------------------------------- */

function DefRow({
  label,
  children,
  last,
}: {
  label: string
  children: React.ReactNode
  last?: boolean
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 py-2.5 text-[13px]",
        !last && "border-b"
      )}
    >
      <span className="flex-none text-muted-foreground">{label}</span>
      <span className="min-w-0 truncate text-right">{children}</span>
    </div>
  )
}

function Overview({ member }: { member: Member }) {
  const methods = member.loginMethods.length
    ? member.loginMethods.join(", ")
    : "No sign-in method"
  return (
    <div className="max-w-xl">
      <SectionTitle>Overview</SectionTitle>
      <div className="mt-2">
        <DefRow label="Member ID">
          <span className="font-mono text-xs">{member.id}</span>
        </DefRow>
        <DefRow label="Email">
          <span className="inline-flex items-center gap-2">
            {member.email}
            {member.emailVerified ? (
              <span className="text-xs font-semibold text-emerald-600">
                Verified
              </span>
            ) : null}
          </span>
        </DefRow>
        <DefRow label="Role">{ROLE_LABELS[member.role]}</DefRow>
        <DefRow label="Sign-in method">
          <span className="inline-flex items-center gap-2">
            {member.usesGoogle ? <GoogleMark /> : null}
            {methods}
          </span>
        </DefRow>
        <DefRow label="Date added" last>
          {member.joined}
        </DefRow>
      </div>
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div className="text-[13px] font-semibold">{children}</div>
}

/* ------------------------------ Edit member ------------------------------ */

function EditMemberForm({
  member,
  isSelf,
  onSaved,
  onCancel,
}: {
  member: Member
  isSelf: boolean
  onSaved: () => void
  onCancel: () => void
}) {
  const [state, action, pending] = useActionState(updateUser, null)

  useEffect(() => {
    if (state?.ok) onSaved()
  }, [state, onSaved])

  return (
    <form action={action} className="max-w-xl">
      <input type="hidden" name="id" value={member.id} />
      <SectionTitle>Edit member</SectionTitle>
      <div className="mt-0.5 text-xs text-muted-foreground">
        Update profile and access. Changes apply immediately.
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="member-name">Full name</FieldLabel>
          <Input
            id="member-name"
            name="name"
            autoComplete="off"
            placeholder="No name set"
            defaultValue={member.name ?? ""}
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="member-email">Email address</FieldLabel>
          <Input
            id="member-email"
            name="email"
            type="email"
            autoComplete="off"
            required
            defaultValue={member.email}
          />
        </Field>

        <Field className="sm:col-span-2">
          <FieldLabel htmlFor="member-role">Role</FieldLabel>
          {/* Disabled inputs don't submit; when self-editing, carry the
              unchanged role via a hidden field so the action still gets it. */}
          {isSelf ? (
            <input type="hidden" name="role" value={member.role} />
          ) : null}
          <Select
            name={isSelf ? undefined : "role"}
            defaultValue={member.role}
            disabled={isSelf}
          >
            <SelectTrigger id="member-role" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ROLES.map((r) => (
                <SelectItem key={r} value={r}>
                  {ROLE_LABELS[r]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {isSelf ? (
            <FieldDescription>You can’t change your own role.</FieldDescription>
          ) : null}
        </Field>
      </div>

      <div className="mt-5 flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save changes"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={pending}
          onClick={onCancel}
        >
          Cancel
        </Button>
        {state && !state.ok ? (
          <span className="text-sm text-destructive">{state.message}</span>
        ) : null}
      </div>
    </form>
  )
}

/* ------------------------------- New member ------------------------------ */

function NewMemberForm({
  onCreated,
  onCancel,
}: {
  onCreated: () => void
  onCancel: () => void
}) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [role, setRole] = useState<Role>("teammate")
  const formRef = useRef<HTMLFormElement>(null)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setPending(true)
    setError(null)

    const fd = new FormData(e.currentTarget)
    const payload = {
      name: fd.get("name"),
      email: fd.get("email"),
      role: fd.get("role"),
      password: fd.get("password"),
    }

    try {
      const res = await fetch("/api/backflip/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = (await res.json().catch(() => null)) as {
        ok?: boolean
        message?: string
      } | null

      if (!res.ok || !data?.ok) {
        setError(data?.message ?? "Something went wrong.")
        return
      }

      toast.success(data.message ?? "User added.")
      formRef.current?.reset()
      router.refresh()
      onCreated()
    } catch {
      setError("Network error. Please try again.")
    } finally {
      setPending(false)
    }
  }

  return (
    <form
      ref={formRef}
      onSubmit={onSubmit}
      className="flex max-w-md flex-col gap-5"
    >
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Add member</h2>
        <p className="text-sm text-muted-foreground">
          Create a platform account. They’ll receive a welcome email if email
          sending is configured.
        </p>
      </div>

      <Field>
        <FieldLabel htmlFor="new-name">Full name</FieldLabel>
        <Input
          id="new-name"
          name="name"
          autoComplete="off"
          placeholder="Optional"
        />
      </Field>

      <Field>
        <FieldLabel htmlFor="new-email">Email</FieldLabel>
        <Input
          id="new-email"
          name="email"
          type="email"
          autoComplete="off"
          required
          placeholder="person@example.com"
        />
      </Field>

      <div className="flex flex-col gap-2">
        <FieldLabel htmlFor="new-role-teammate">Role</FieldLabel>
        <div className="grid gap-2">
          {ROLES.map((r) => {
            const checked = role === r
            return (
              <label
                key={r}
                htmlFor={`new-role-${r}`}
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors",
                  checked
                    ? "border-primary bg-muted/50 ring-1 ring-primary"
                    : "hover:bg-muted/40"
                )}
              >
                <input
                  id={`new-role-${r}`}
                  type="radio"
                  name="role"
                  value={r}
                  checked={checked}
                  onChange={() => setRole(r)}
                  className="sr-only"
                />
                <span
                  className={cn(
                    "mt-0.5 size-4 flex-none rounded-full border",
                    checked ? "border-4 border-primary" : "border-input"
                  )}
                />
                <span className="min-w-0">
                  <span className="block text-sm font-medium">
                    {ROLE_LABELS[r]}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {ROLE_DESC[r]}
                  </span>
                </span>
              </label>
            )
          })}
        </div>
      </div>

      <Field>
        <FieldLabel htmlFor="new-password">Password</FieldLabel>
        <Input
          id="new-password"
          name="password"
          type="password"
          autoComplete="new-password"
          placeholder="Optional"
        />
        <FieldDescription>
          Leave blank for Google-only sign-in (the email must be pre-registered
          to sign in with Google).
        </FieldDescription>
      </Field>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Adding…" : "Create user"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={pending}
          onClick={onCancel}
        >
          Cancel
        </Button>
        {error ? (
          <span className="text-sm text-destructive">{error}</span>
        ) : null}
      </div>
    </form>
  )
}
