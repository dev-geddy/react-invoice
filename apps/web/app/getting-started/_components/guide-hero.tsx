import { RiBookOpenLine, RiTerminalBoxLine } from "@remixicon/react"

import { Badge } from "@workspace/ui/components/badge"

const DEVOPS_DOC = "https://github.com/dev-geddy/backflip/blob/master/devops.md"

/**
 * Hero band shared by the setup wizards. Same stripe-texture backdrop as the
 * homepage hero, shorter. Copy comes from the page — one hero, one flavour of
 * chrome, no per-guide fork.
 */
export function GuideHero({
  title,
  lead,
  flavour,
}: {
  /** Heading lines — rendered stacked, one `<br/>`-separated line each. */
  title: string[]
  lead: string
  /** Optional badge next to "Getting started" naming the droplet flavour. */
  flavour?: string
}) {
  return (
    <section
      aria-label="Introduction"
      className="relative overflow-hidden border-b"
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-card [background-image:repeating-linear-gradient(135deg,var(--muted)_0_2px,transparent_2px_22px)]"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[linear-gradient(90deg,var(--background)_0%,var(--background)_34%,transparent_82%),linear-gradient(0deg,var(--background)_2%,transparent_34%)]"
      />

      <div className="relative mx-auto max-w-6xl px-6 pt-16 pb-14">
        <div className="max-w-2xl">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="gap-1.5 rounded-full">
              <RiTerminalBoxLine
                className="size-3.5 text-primary"
                aria-hidden="true"
              />
              Getting started
            </Badge>
            {flavour ? <Badge variant="secondary">{flavour}</Badge> : null}
          </div>
          <h1 className="mt-5 text-[clamp(2rem,5vw,3.25rem)] leading-[1.05] font-bold tracking-tight">
            {title.map((line) => (
              <span key={line} className="block">
                {line}
              </span>
            ))}
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted-foreground">
            {lead}
          </p>
          <a
            href={DEVOPS_DOC}
            target="_blank"
            rel="noreferrer"
            className="mt-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <RiBookOpenLine className="size-4" aria-hidden="true" />
            Full reference: devops.md in the repo
          </a>
        </div>
      </div>
    </section>
  )
}
