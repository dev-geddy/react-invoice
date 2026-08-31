import type { Metadata } from "next"

import { SiteFooter } from "../../_components/site-footer"
import { SiteHeader } from "../../_components/site-header"
import { GuideHero } from "../_components/guide-hero"
import { DockerSetupGuide } from "./_components/setup-guide"

export const metadata: Metadata = {
  title: "Setup on a DigitalOcean droplet — Docker flavour",
  description:
    "A guided, step-by-step wizard for deploying Backflip to a DigitalOcean droplet with Postgres in Docker and Caddy for automatic TLS — fill in your variables and copy the ready-made commands.",
}

// Server Component (RSC) shell around the client guide island. The guide is
// interactive but purely local: the operator's values never leave the browser.
export default function SetupOnDropletDockerFlavourPage() {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <SiteHeader />
      <main>
        <GuideHero
          title={["Setup on a DigitalOcean", "droplet — Docker flavour"]}
          flavour="Docker Postgres · Caddy"
          lead="The same droplet in nine guided steps, with Postgres in a container and Caddy issuing TLS on its own. Fill in your variables once and copy the commands — they run from the repo root on your own machine."
        />
        <DockerSetupGuide />
      </main>
      <SiteFooter />
    </div>
  )
}
