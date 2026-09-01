import type { Metadata } from "next"

import { CtaBand } from "./_components/cta-band"
import { DocumentSection } from "./_components/document-section"
import { Hero } from "./_components/hero"
import { HowItWorks } from "./_components/how-it-works"
import { PaperFloatKeyframes } from "./_components/paper-float"
import { PlatformGrid } from "./_components/platform-grid"
import { SellingPoints } from "./_components/selling-points"
import { SiteFooter } from "./_components/site-footer"
import { SiteHeader } from "./_components/site-header"
import { WordmarkBand } from "./_components/wordmark-band"

export const metadata: Metadata = {
  title: "Backflip Invoice — invoicing you own outright",
  description:
    "Self-hosted invoicing on the Backflip foundation: a shared ledger behind your own login, a live preview that is the printed document, and an A4 PDF at the end of it. MIT licensed, no seats, your Postgres.",
}

/**
 * The brand accent. Red is the homepage's own voice — the admin console stays
 * on the neutral theme primary — so the tokens are scoped to this page rather
 * than added to the shared stylesheet, and every consumer reads them through a
 * `var(--brand, var(--primary))` fallback.
 *
 * Dark values are lighter and less saturated: the same hue at the light-mode
 * lightness goes muddy against a near-black ground.
 */
const BRAND_TOKENS = [
  "[--brand:oklch(0.56_0.215_27.5)]",
  "[--brand-soft:oklch(0.96_0.022_27.5)]",
  "[--brand-line:oklch(0.88_0.07_27.5)]",
  "[--brand-ink:oklch(0.99_0_0)]",
  "[--brand-stripe:oklch(1_0_0/0.7)]",
  "[--brand-paper:oklch(1_0_0/0.55)]",
  "[--paper-shadow:oklch(0.145_0_0/0.12)]",
  "dark:[--brand:oklch(0.7_0.19_27.5)]",
  "dark:[--brand-soft:oklch(0.26_0.05_27.5)]",
  "dark:[--brand-line:oklch(0.42_0.1_27.5)]",
  "dark:[--brand-ink:oklch(0.16_0.02_27.5)]",
  "dark:[--brand-stripe:oklch(1_0_0/0.06)]",
  "dark:[--brand-paper:oklch(1_0_0/0.05)]",
  "dark:[--paper-shadow:oklch(0_0_0/0.5)]",
].join(" ")

// Server Component (RSC). No client hooks here — the only interactive island is
// the theme toggle inside <SiteHeader />.
export default function HomePage() {
  return (
    <div className={`min-h-dvh bg-background text-foreground ${BRAND_TOKENS}`}>
      <PaperFloatKeyframes />
      <SiteHeader />
      <main>
        <Hero />
        <SellingPoints />
        <DocumentSection />
        <PlatformGrid />
        <HowItWorks />
        <CtaBand />
        <WordmarkBand />
      </main>
      <SiteFooter />
    </div>
  )
}
