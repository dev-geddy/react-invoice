import type { Metadata } from "next"

import { CapabilityList } from "./_components/capability-list"
import { ClaudeConnector } from "./_components/claude-connector"
import { FeatureList } from "./_components/feature-list"
import { Hero } from "./_components/hero"
import { HowItWorks } from "./_components/how-it-works"
import { SiteFooter } from "./_components/site-footer"
import { SiteHeader } from "./_components/site-header"
import { WordmarkBand } from "./_components/wordmark-band"

export const metadata: Metadata = {
  title: "Backflip — a batteries-included platform foundation",
  description:
    "Clone it and start building features, not boilerplate. Auth, admin dashboard, Postgres + Drizzle, a shadcn UI system, and AI wiring, ready on day one.",
}

// Server Component (RSC). No client hooks here — the only interactive island is
// the theme toggle inside <SiteHeader />.
export default function HomePage() {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <SiteHeader />
      <main>
        <Hero />
        <CapabilityList />
        <FeatureList />
        <HowItWorks />
        <ClaudeConnector />
        <WordmarkBand />
      </main>
      <SiteFooter />
    </div>
  )
}
