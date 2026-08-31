import { Button } from "@workspace/ui/components/button"
import { Card } from "@workspace/ui/components/card"

const STEPS = [
  {
    n: "01",
    title: "Clone",
    body: "Pull the foundation and install. Auth, DB, and UI come with it.",
    cta: {
      href: "https://github.com/dev-geddy/backflip",
      label: "View on GitHub",
      external: true,
    },
  },
  {
    n: "02",
    title: "Configure",
    body: "Drop in your env keys and pick an AI provider. Set your theme tokens.",
    cta: { href: "/getting-started", label: "Getting started" },
  },
  {
    n: "03",
    title: "Ship",
    body: "Build the features that make your product yours — the plumbing is done.",
    cta: { href: "/getting-started/start-building", label: "Start building" },
  },
]

export function HowItWorks() {
  return (
    <section aria-label="How it works" className="border-y bg-muted">
      <div className="mx-auto max-w-6xl px-6 py-18">
        <div className="mb-9 flex flex-col gap-2">
          <span className="font-mono text-xs tracking-[0.08em] text-primary uppercase">
            How it works
          </span>
          <h2 className="text-[clamp(1.625rem,3.4vw,2.125rem)] font-semibold tracking-tight">
            From clone to shipped in three steps
          </h2>
        </div>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-4">
          {STEPS.map((s) => (
            <Card key={s.n} className="p-6">
              <div className="font-mono text-sm text-primary">{s.n}</div>
              <h3 className="mt-3.5 text-[1.0625rem] font-semibold">
                {s.title}
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                {s.body}
              </p>
              {s.cta ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-4 self-start"
                  render={
                    <a
                      href={s.cta.href}
                      {...("external" in s.cta && s.cta.external
                        ? { target: "_blank", rel: "noreferrer" }
                        : {})}
                    />
                  }
                >
                  {s.cta.label}
                </Button>
              ) : null}
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}
