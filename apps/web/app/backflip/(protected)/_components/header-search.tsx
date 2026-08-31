"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@workspace/ui/components/command"
import { CommandDialog } from "@workspace/ui/components/command"
import { RiSearchLine } from "@remixicon/react"

import { JUMP_GROUPS } from "./jump-targets"

/**
 * Header quick-jump (design 5A) — a search button that opens a ⌘K command
 * palette to jump to admin pages/actions. Replicates the design's type-to-jump.
 */
export function HeaderSearch() {
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
        className="flex h-8 w-40 min-w-0 shrink items-center gap-2 rounded-md border px-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted/50 sm:w-56"
      >
        <RiSearchLine className="size-4" />
        <span className="flex-1 truncate text-left">Jump to…</span>
        <kbd className="hidden items-center rounded border px-1.5 py-0.5 font-sans text-xs leading-none sm:inline-flex">
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
