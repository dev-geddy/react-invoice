"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@workspace/ui/components/command"
import { RiSearchLine } from "@remixicon/react"

import { JUMP_GROUPS } from "./jump-targets"

/**
 * Overview quick-jump (design 5A) — a prominent search field that opens the
 * ⌘K command palette to jump to any page/action. Shares `JUMP_GROUPS` with the
 * header search.
 */
export function OverviewJump() {
  const router = useRouter()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        setOpen((o) => !o)
      }
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [])

  function go(href: string) {
    setOpen(false)
    router.push(href)
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-12 w-full items-center gap-3 rounded-xl border bg-card px-4 text-left transition-colors hover:border-ring"
      >
        <RiSearchLine className="size-5 text-muted-foreground" />
        <span className="flex-1 text-sm text-muted-foreground">
          Jump to a page or action — try “users”, “email”, “password”…
        </span>
        <kbd className="rounded border px-1.5 py-0.5 font-sans text-xs text-muted-foreground">
          ⌘K
        </kbd>
      </button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <Command>
          <CommandInput placeholder="Jump to a page or action…" />
          <CommandList>
            <CommandEmpty>No matches.</CommandEmpty>
            {JUMP_GROUPS.map((g) => (
              <CommandGroup key={g.heading} heading={g.heading}>
                {g.items.map((it) => (
                  <CommandItem
                    key={`${g.heading}-${it.label}`}
                    value={`${it.label} ${it.keywords}`}
                    onSelect={() => go(it.href)}
                  >
                    {it.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  )
}
