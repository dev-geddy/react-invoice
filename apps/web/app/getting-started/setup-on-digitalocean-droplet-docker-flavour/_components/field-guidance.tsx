"use client"

import { CommandBlock } from "../../_components/command-block"
import { type Guidance, GuidancePanel } from "../../_components/guidance-panel"
import {
  DEFAULT_APP_NAME,
  DEFAULT_APP_PORT,
  DEFAULT_DB_NAME,
  DEFAULT_DB_USER,
  type DockerSetupVars,
  resolve,
} from "./setup-vars"

function Mono({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.8125em] break-all">
      {children}
    </code>
  )
}

/**
 * `chmod 600 <path>` for the key the operator is actually using, falling back to
 * a highlighted `<your-key>` placeholder while the field is still empty.
 */
function chmodLine(sshKey: string) {
  const path = sshKey.trim()
  return `chmod 600 ${path || "~/.ssh/<your-key>"}`
}

function guidanceFor(
  field: keyof DockerSetupVars,
  vars: DockerSetupVars
): Guidance {
  const appUrl = resolve(vars).appUrl

  switch (field) {
    case "host":
      return {
        title: "Droplet host or IP",
        body: [
          "The droplet’s public IPv4 address — every command in this guide connects to it over SSH.",
          "In the panel: Droplets → your droplet → the ipv4 value at the top. A hostname works too, as long as it resolves to that droplet.",
        ],
        link: {
          href: "https://cloud.digitalocean.com/droplets",
          label: "DigitalOcean → Droplets",
        },
      }
    case "sshKey":
      return {
        title: "SSH private key path",
        body: [
          <>
            Path on your machine to the <strong>private</strong> key — the file
            without the <Mono>.pub</Mono> ending. Its public half is what you
            added to the droplet as root’s key when creating it.
          </>,
          "It must be the droplet’s root key: the setup and deploy scripts all connect as root. Permissions must be 0600, or ssh refuses to use it:",
        ],
        link: {
          href: "https://cloud.digitalocean.com/account/security",
          label: "DigitalOcean → Settings → Security (SSH keys)",
        },
        extra: (
          <div className="flex flex-col gap-2">
            <CommandBlock lines={[chmodLine(vars.sshKey)]} compact />
            <p className="text-sm leading-relaxed text-muted-foreground">
              No key? Generating one is covered in step 1, Get a droplet — the
              key must exist on the droplet before this guide can connect.
            </p>
          </div>
        ),
      }
    case "domain":
      return {
        title: "Domain",
        body: [
          "The public hostname Caddy will serve this app on. It also lands in the droplet’s .env as DOMAIN — the deploy renders the Caddyfile from it.",
          <>
            Its DNS <Mono>A</Mono> record must already point at the droplet IP
            before TLS can be issued — Caddy fetches the certificate on first
            start and verifies over HTTP.
          </>,
          <>
            If the domain’s DNS is on DigitalOcean: Networking → Domains → your
            domain → create record — type <Mono>A</Mono>, hostname{" "}
            <Mono>@</Mono> (or the subdomain, e.g. <Mono>app</Mono>), directed
            to your droplet. Otherwise add the same record at whichever provider
            hosts the domain’s nameservers.
          </>,
        ],
        link: {
          href: "https://cloud.digitalocean.com/networking/domains",
          label: "DigitalOcean → Networking → Domains",
        },
      }
    case "dbPassword":
      return {
        title: "Database password",
        body: [
          <>
            You choose this one. The Postgres container is created with it on
            first start, as role <Mono>{DEFAULT_DB_USER}</Mono> owning database{" "}
            <Mono>{DEFAULT_DB_NAME}</Mono>.
          </>,
          <>
            It goes into <Mono>.env.production</Mono> twice — as{" "}
            <Mono>POSTGRES_PASSWORD</Mono> and inside <Mono>DATABASE_URL</Mono>.
            The env step below prints both lines filled in.
          </>,
          "Set it before the first deploy: changing it afterwards means changing it inside the running database too, since the container only reads it when the data volume is first created.",
        ],
      }
    case "appName":
      return {
        title: "App name",
        body: [
          "Only needed when one droplet runs several instances. It names the pm2 process.",
          <>
            Leave blank for <Mono>{DEFAULT_APP_NAME}</Mono>, the script default.
          </>,
          "Caddy on this flavour is rendered as a single site, so multi-instance is really a pm2-flavour feature — one app per docker-flavour droplet is the supported path.",
        ],
      }
    case "appPort":
      return {
        title: "App port",
        body: [
          "The loopback port Caddy proxies to. It is never exposed publicly — only Caddy talks to it.",
          <>
            Leave blank for <Mono>{DEFAULT_APP_PORT}</Mono>, the script default.
          </>,
        ],
      }
    case "adminEmail":
      return {
        title: "Owner email",
        body: [
          <>
            The first admin account, seeded in step 8. It signs in at{" "}
            <Mono>{appUrl}/backflip</Mono>.
          </>,
          "Use an address you can receive mail at — verification and password resets go there.",
        ],
      }
    case "adminPassword":
      return {
        title: "Owner password",
        body: [
          "You choose this one; nothing hands it to you. It becomes the owner’s sign-in password on the admin console.",
          "Leave it blank for a Google-only owner. This page never stores it — it stays in memory and is gone after a reload, so refill it before running step 8.",
        ],
      }
  }
}

/** Maps the focused field to its guidance and hands it to the shared panel. */
export function FieldGuidance({
  field,
  vars,
}: {
  field: keyof DockerSetupVars | null
  vars: DockerSetupVars
}) {
  return <GuidancePanel guidance={field ? guidanceFor(field, vars) : null} />
}
