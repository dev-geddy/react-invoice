import { cn } from "@workspace/ui/lib/utils"

/**
 * Deployed release marker: the root `package.json` version, inlined at build
 * time by `next.config.ts` (`NEXT_PUBLIC_APP_VERSION`). Read from the env var
 * rather than importing the JSON so the version travels with the standalone
 * bundle — the build-locally deploy ships no repo source to the droplet.
 *
 * Rendered small + low-contrast on the public footer and the admin Overview so
 * an operator can tell which release a given instance is serving.
 *
 * @spec L2-UI-19
 */
export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "0.0.0"

export function AppVersion({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "text-[11px] tracking-tight text-muted-foreground/60 tabular-nums",
        className
      )}
    >
      v{APP_VERSION}
    </span>
  )
}
