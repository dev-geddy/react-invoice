import type { Metadata } from "next"

import { Card } from "@workspace/ui/components/card"

import { SiteFooter } from "../_components/site-footer"
import { SiteHeader } from "../_components/site-header"

export const metadata: Metadata = {
  title: "Getting started",
  description:
    "Getting started with Backflip in three phases: discover what it is, set it up on a droplet, then build your first feature with prompts.",
}

type Guide = {
  href: string
  title: string
  body: string
  soon?: boolean
}

/** The three phases of getting started; each phase lists its guides in order. */
const PHASES: { n: string; title: string; lead: string; guides: Guide[] }[] = [
  {
    n: "01",
    title: "Discover",
    lead: "What Backflip is, what ships in the box, and whether it fits what you're building.",
    guides: [
      {
        href: "/getting-started/intro",
        title: "What is Backflip",
        body: "The foundation in one page: public site + admin, auth, database, integrations, deploys — and who it's for.",
      },
    ],
  },
  {
    n: "02",
    title: "Set up",
    lead: "Take it to production: provision a droplet, create the database, ship the first deploy.",
    guides: [
      {
        href: "/getting-started/setup-on-digitalocean-droplet",
        title: "Setup on a DigitalOcean droplet",
        body: "Provision a droplet, create the database, fill your env files and ship the first deploy — a step-by-step wizard with copy-ready commands.",
      },
      {
        href: "/getting-started/setup-on-digitalocean-droplet-docker-flavour",
        title: "Droplet setup — Docker flavour",
        body: "Same droplet, Postgres in a container and Caddy issuing TLS on its own — a step-by-step wizard with copy-ready commands.",
      },
    ],
  },
  {
    n: "03",
    title: "Start building",
    lead: "Extend the platform with a coding agent — plain-language prompts, no boilerplate.",
    guides: [
      {
        href: "/getting-started/start-building",
        title: "Build your first feature with prompts",
        body: "Copy-ready prompts that add a contact form to the public site and its admin view — paste into Claude Code, review the diffs.",
      },
    ],
  },
]

export default function GettingStartedPage() {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <SiteHeader />
      <main>
        <section className="border-b">
          <div className="mx-auto max-w-6xl px-6 py-18">
            <span className="font-mono text-xs tracking-[0.08em] text-primary uppercase">
              Getting started
            </span>
            <h1 className="mt-2 text-[clamp(1.75rem,4vw,2.5rem)] font-semibold tracking-tight">
              From clone to your product, in three phases
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
              Discover what the foundation gives you, set it up on your own
              droplet, then start building the parts only you can build.
            </p>
          </div>
        </section>
        {PHASES.map((phase, i) => (
          <section
            key={phase.n}
            aria-label={phase.title}
            className={i < PHASES.length - 1 ? "border-b" : undefined}
          >
            <div className="mx-auto max-w-6xl px-6 py-12">
              <div className="flex items-baseline gap-3">
                <span className="font-mono text-sm font-semibold text-primary">
                  {phase.n}
                </span>
                <h2 className="text-lg font-semibold tracking-tight">
                  {phase.title}
                </h2>
              </div>
              <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-muted-foreground">
                {phase.lead}
              </p>
              <div className="mt-6 grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-4 lg:grid-cols-2">
                {phase.guides.map((g) => (
                  <a key={g.href} href={g.href} className="group">
                    <Card className="h-full p-6 transition-colors group-hover:border-primary/50">
                      <h3 className="text-[1.0625rem] font-semibold">
                        {g.title}
                      </h3>
                      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                        {g.body}
                      </p>
                      <span className="mt-4 inline-block text-sm font-medium text-primary">
                        {g.soon ? "Preview →" : "Open guide →"}
                      </span>
                    </Card>
                  </a>
                ))}
              </div>
            </div>
          </section>
        ))}
      </main>
      <SiteFooter />
    </div>
  )
}
