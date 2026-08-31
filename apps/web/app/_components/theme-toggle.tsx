"use client"

import { useEffect, useState } from "react"
import { RiMoonLine, RiSunLine } from "@remixicon/react"
import { useTheme } from "next-themes"

import { Button } from "@workspace/ui/components/button"

/**
 * Dark/light mode switch shared by the public and admin headers.
 */
export function ThemeToggle({
  variant = "outline",
  className,
}: {
  variant?: "outline" | "ghost"
  className?: string
}) {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const isDark = resolvedTheme === "dark"
  return (
    <Button
      variant={variant}
      size="icon"
      aria-label="Toggle theme"
      className={className}
      onClick={() => setTheme(isDark ? "light" : "dark")}
    >
      {/* Mount guard avoids hydration mismatch before the theme resolves. */}
      {mounted && isDark ? (
        <RiSunLine className="size-[18px]" aria-hidden="true" />
      ) : (
        <RiMoonLine className="size-[18px]" aria-hidden="true" />
      )}
    </Button>
  )
}
