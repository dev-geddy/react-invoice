"use client"

import { Button } from "@workspace/ui/components/button"

import { BrandIcon } from "./brand-icon"
import { ThemeToggle } from "./theme-toggle"

function Wordmark({ className }: { className?: string }) {
  return (
    <a
      href="/"
      className={`flex items-center gap-2 text-base font-bold tracking-tight ${className ?? ""}`}
    >
      <span className="inline-flex size-[22px] items-center justify-center rounded-md border bg-card">
        <BrandIcon className="text-primary" />
      </span>
      Backflip
    </a>
  )
}

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur">
      <nav
        aria-label="Primary"
        className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-6"
      >
        <Wordmark />
        <div className="flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            render={<a href="/getting-started" />}
          >
            Getting started
          </Button>
          <ThemeToggle />
          <Button size="sm" render={<a href="/backflip" />}>
            Admin
          </Button>
        </div>
      </nav>
    </header>
  )
}
