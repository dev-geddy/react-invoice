import type { Metadata } from "next"

import { SiteFooter } from "../../_components/site-footer"
import { SiteHeader } from "../../_components/site-header"
import { GuideHero } from "../_components/guide-hero"
import { SetupGuide } from "./_components/setup-guide"

export const metadata: Metadata = {
  title: "Setup on a DigitalOcean droplet",
  description:
    "A guided, step-by-step wizard for deploying Backflip to a DigitalOcean droplet — fill in your variables and copy the ready-made commands.",
}

// Server Component (RSC) shell around the client guide island. The guide is
// interactive but purely local: the operator's values never leave the browser.
export default function SetupOnDigitalOceanDropletPage() {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <SiteHeader />
      <main>
        <GuideHero
          title={["Setup on a", "DigitalOcean droplet"]}
          flavour="pm2 · nginx · native Postgres"
          lead="A few guided steps from a bare Ubuntu droplet to Backflip live on your domain, over HTTPS. Fill in your variables once and copy the commands — they run from the repo root on your own machine."
        />
        <SetupGuide />
      </main>
      <SiteFooter />
    </div>
  )
}
