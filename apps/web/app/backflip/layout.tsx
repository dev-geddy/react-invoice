import type { ReactNode } from "react"

/**
 * Root layout for the /backflip admin scope.
 * Wraps both the public (auth) and (protected) route groups.
 * Setup-only: shell/nav to be implemented in a later phase.
 */
export default function BackflipLayout({ children }: { children: ReactNode }) {
  return <div className="min-h-svh">{children}</div>
}
