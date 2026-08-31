import type { Metadata } from "next"

import { SiteFooter } from "../../_components/site-footer"
import { SiteHeader } from "../../_components/site-header"
import { PromptBlock } from "./_components/prompt-block"

export const metadata: Metadata = {
  title: "Start building",
  description:
    "Copy-ready prompts for extending Backflip with a coding agent — a public contact form, its admin view, and email notifications.",
}

/**
 * Phase 3 of getting started: prompt samples, nothing else. Each block is a
 * complete prompt to paste into a coding agent run from the repo root; the
 * repo's own conventions (docs contracts, colocation, commit style) steer the
 * agent, so prompts stay product-level.
 */
const PROMPTS = [
  {
    label: "Prompt 1 — public contact form",
    text: `Add a contact form to the public site. Fields: name, email, message. Validate on the server, store submissions in a new database table via a migration, and show an inline success state after sending. Match the visual style of the existing public pages.`,
  },
  {
    label: "Prompt 2 — admin view for submissions",
    text: `Add an admin page under /backflip that lists the contact form submissions, newest first, with a sidebar menu item. Show name, email, message and received date; let me mark a submission as read or unread and delete one. Gate it with the same capability system the other admin pages use.`,
  },
  {
    label: "Prompt 3 — email notification (optional)",
    text: `When a contact form submission is saved, send me a notification email through the configured Resend integration with the submission's details. If no Resend key is configured or sending fails, keep the submission anyway — email is best-effort.`,
  },
  {
    label: "Prompt 4 — polish (optional)",
    text: `Add spam protection to the contact form: a honeypot field and a per-IP rate limit on the server action. No CAPTCHA. Then show an unread-submissions count badge on the admin menu item.`,
  },
]

export default function StartBuildingPage() {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <SiteHeader />
      <main>
        <section className="border-b">
          <div className="mx-auto max-w-6xl px-6 py-18">
            <span className="font-mono text-xs tracking-[0.08em] text-primary uppercase">
              Getting started — start building
            </span>
            <h1 className="mt-2 text-[clamp(1.75rem,4vw,2.5rem)] font-semibold tracking-tight">
              Build your first feature with prompts
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
              Backflip is built to be extended by a coding agent. Open Claude
              Code (or your agent of choice) in the repo root and paste these
              prompts one at a time — the repo&apos;s docs and conventions steer
              the agent, so plain product language is enough. Review each diff
              before moving on.
            </p>
          </div>
        </section>
        <section aria-label="Prompts">
          <div className="mx-auto max-w-3xl px-6 py-12">
            <div className="flex flex-col gap-4">
              {PROMPTS.map((p) => (
                <PromptBlock key={p.label} label={p.label} text={p.text} />
              ))}
            </div>
            <p className="mt-6 text-sm leading-relaxed text-muted-foreground">
              The pattern generalizes: describe the feature, where it lives
              (public site or{" "}
              <span className="font-mono text-[0.8125em]">/backflip</span>{" "}
              admin), and what data it keeps — the agent handles schema,
              migrations, routes and UI to match what&apos;s already there.
            </p>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  )
}
