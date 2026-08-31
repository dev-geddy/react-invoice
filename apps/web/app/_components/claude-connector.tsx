import { RiEyeLine, RiShieldUserLine, RiToggleLine } from "@remixicon/react"

import { Card } from "@workspace/ui/components/card"

/**
 * Three parallel facts about the connector, not a sequence — no step numbers
 * here (contrast `HowItWorks`, which is genuinely ordered).
 */
const FACTS = [
  {
    icon: RiShieldUserLine,
    title: "Signed in as a real user",
    body: "OAuth 2.1, not a shared API key. It authenticates as an actual account on your platform, scoped to that person's existing role.",
  },
  {
    icon: RiEyeLine,
    title: "Read-only, for now",
    body: "Ask about users, the dashboard summary, and integration status. No write tools in this phase.",
  },
  {
    icon: RiToggleLine,
    title: "Off until you turn it on",
    body: "Disabled by default — an owner enables it and creates the client in settings. Disconnect any time from the account page; a password change revokes it too.",
  },
]

export function ClaudeConnector() {
  return (
    <section
      aria-label="Connect Claude to your platform"
      className="mx-auto max-w-6xl px-6 py-20"
    >
      <div className="mb-9 flex flex-col gap-2">
        <span className="font-mono text-xs tracking-[0.08em] text-primary uppercase">
          Claude connector
        </span>
        <h2 className="text-[clamp(1.625rem,3.4vw,2.125rem)] font-semibold tracking-tight">
          Ask your platform questions from Claude
        </h2>
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Connect claude.ai, Claude Desktop or Claude Code straight to your
          platform over the Model Context Protocol, as an authenticated
          connector. It signs in as a real account, so it only ever sees what
          that user&apos;s role already allows.
        </p>
      </div>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-4">
        {FACTS.map((f) => (
          <Card key={f.title} className="p-6">
            <f.icon className="size-5 text-primary" aria-hidden="true" />
            <h3 className="mt-3.5 text-[1.0625rem] font-semibold">{f.title}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
              {f.body}
            </p>
          </Card>
        ))}
      </div>
    </section>
  )
}
