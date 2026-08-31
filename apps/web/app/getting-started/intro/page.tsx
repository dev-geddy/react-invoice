import type { Metadata } from "next"

import { Button } from "@workspace/ui/components/button"
import { Card } from "@workspace/ui/components/card"

import { SiteFooter } from "../../_components/site-footer"
import { SiteHeader } from "../../_components/site-header"

export const metadata: Metadata = {
  title: "What is Backflip",
  description:
    "What Backflip is, what ships in the box, and who it's for — the discovery phase of getting started.",
}

const IN_THE_BOX = [
  {
    title: "Public site + admin console",
    body: "A marketing-style public surface and a full /backflip admin behind auth — users, settings, integrations, UI samples.",
  },
  {
    title: "Auth that's already wired",
    body: "Email + password and Google sign-in via Auth.js, role-based capabilities (owner / admin / teammate), password reset and email-change flows.",
  },
  {
    title: "Postgres + Drizzle",
    body: "One schema source, generated SQL migrations, encrypted secrets at rest. Config tables for every integration.",
  },
  {
    title: "Integrations panel",
    body: "AI providers (Anthropic, OpenAI, Google) with live model lists, Resend transactional email, Google Analytics with a consent-gated cookie banner, Deepgram speech.",
  },
  {
    title: "Production deploys",
    body: "Scripted DigitalOcean droplet provisioning and blue/green deploys — build locally, ship an artifact, roll back with one command.",
  },
  {
    title: "Built for AI-assisted development",
    body: "A three-level docs system (constitution → contracts → notes) keeps the codebase legible to coding agents, so plain-language prompts produce code that fits.",
  },
]

const AUDIENCE = [
  {
    title: "Builders shipping a product",
    body: "You have the idea; you don't want to spend the first month on login pages, migrations and deploy scripts.",
  },
  {
    title: "Developers who want to own their stack",
    body: "Self-hosted on your own droplet, no per-seat SaaS, no lock-in — everything is code in your repo.",
  },
  {
    title: "People building with coding agents",
    body: "The repo is structured so Claude Code and friends stay on the rails: contracts, conventions and prompts over boilerplate.",
  },
]

/** Phase 1 of getting started — discovery: what this is, whom it's for. */
export default function IntroPage() {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <SiteHeader />
      <main>
        <section className="border-b">
          <div className="mx-auto max-w-6xl px-6 py-18">
            <span className="font-mono text-xs tracking-[0.08em] text-primary uppercase">
              Getting started — discover
            </span>
            <h1 className="mt-2 text-[clamp(1.75rem,4vw,2.5rem)] font-semibold tracking-tight">
              What is Backflip
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
              Backflip is a self-hosted foundation for web products: a Next.js
              monorepo with auth, database, admin console, integrations and
              production deploys already working. You clone it, configure it,
              and spend your time on the features that make your product yours.
            </p>
          </div>
        </section>

        <section aria-label="What's in the box" className="border-b">
          <div className="mx-auto max-w-6xl px-6 py-12">
            <h2 className="font-mono text-xs tracking-[0.08em] text-muted-foreground uppercase">
              In the box
            </h2>
            <div className="mt-5 grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-4">
              {IN_THE_BOX.map((item) => (
                <Card key={item.title} className="p-6">
                  <h3 className="text-[1.0625rem] font-semibold">
                    {item.title}
                  </h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                    {item.body}
                  </p>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section aria-label="Who it's for">
          <div className="mx-auto max-w-6xl px-6 py-12">
            <h2 className="font-mono text-xs tracking-[0.08em] text-muted-foreground uppercase">
              Who it&apos;s for
            </h2>
            <div className="mt-5 grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-4">
              {AUDIENCE.map((item) => (
                <Card key={item.title} className="p-6">
                  <h3 className="text-[1.0625rem] font-semibold">
                    {item.title}
                  </h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                    {item.body}
                  </p>
                </Card>
              ))}
            </div>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button
                render={
                  <a href="/getting-started/setup-on-digitalocean-droplet" />
                }
              >
                Next: set it up →
              </Button>
              <Button variant="outline" render={<a href="/getting-started" />}>
                All phases
              </Button>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  )
}
