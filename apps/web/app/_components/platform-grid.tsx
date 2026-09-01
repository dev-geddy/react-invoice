import type { RemixiconComponentType } from "@remixicon/react"
import {
  RiDashboardLine,
  RiDatabase2Line,
  RiPaletteLine,
  RiPlugLine,
  RiRocket2Line,
  RiShieldKeyholeLine,
} from "@remixicon/react"

import { Card } from "@workspace/ui/components/card"

/**
 * What sits under the ledger: the Backflip baseline. Each card names something
 * a fork inherits on day one, so the invoicing reads as the first feature
 * rather than the whole product.
 */

const PLATFORM: {
  icon: RemixiconComponentType
  title: string
  body: string
}[] = [
  {
    icon: RiShieldKeyholeLine,
    title: "Auth, built in",
    body: "Google OAuth and email + password, sessions and guards already configured.",
  },
  {
    icon: RiDashboardLine,
    title: "Admin console",
    body: "Users, records, integrations and settings — a working surface from the first deploy.",
  },
  {
    icon: RiDatabase2Line,
    title: "Postgres + Drizzle",
    body: "Typed schema, migrations and a query layer — a real database from commit one.",
  },
  {
    icon: RiPaletteLine,
    title: "shadcn UI system",
    body: "Base UI components, theme tokens and dark mode, consistent across every surface.",
  },
  {
    icon: RiPlugLine,
    title: "Keys, not rewrites",
    body: "Paste a key in the admin to switch on AI, email or speech. Stored encrypted, swappable in a minute.",
  },
  {
    icon: RiRocket2Line,
    title: "Deploys included",
    body: "DigitalOcean droplet scripts for PM2 or Docker, plus GitHub Actions and Drone pipelines.",
  },
]

export function PlatformGrid() {
  return (
    <section
      id="platform"
      aria-label="Built on Backflip"
      className="border-y bg-muted"
    >
      <div className="mx-auto max-w-6xl px-6 py-20">
        <div className="mb-9 flex flex-col gap-2">
          <span className="font-mono text-xs tracking-[0.08em] text-[var(--brand)] uppercase">
            Backflip baseline
          </span>
          <h2 className="text-[clamp(1.625rem,3.4vw,2.125rem)] font-semibold tracking-tight">
            Invoicing is the first feature, not the whole product
          </h2>
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Underneath the ledger sits Backflip: auth, roles, an admin console,
            Postgres + Drizzle, a shadcn UI system, AI and email wiring, deploy
            scripts. Keep the invoicing, or strip it out and build something
            else on the same baseline — it was designed to be extended.
          </p>
        </div>

        <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-4">
          {PLATFORM.map((item) => (
            <Card key={item.title} className="gap-1.5 p-6">
              <item.icon
                className="size-5 text-[var(--brand)]"
                aria-hidden="true"
              />
              <h3 className="mt-2 text-[1.0625rem] font-semibold">
                {item.title}
              </h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {item.body}
              </p>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}
