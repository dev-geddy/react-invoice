"use client"

import { CommandBlock } from "../../_components/command-block"
import { type Guidance, GuidancePanel } from "../../_components/guidance-panel"
import {
  DEFAULT_APP_NAME,
  DEFAULT_APP_PORT,
  resolve,
  type SetupVars,
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

function guidanceFor(field: keyof SetupVars, vars: SetupVars): Guidance {
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
          "The public hostname nginx will serve this app on.",
          <>
            Its DNS <Mono>A</Mono> record must already point at the droplet IP
            before TLS can be issued — Let’s Encrypt verifies over HTTP.
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
    case "certbotEmail":
      return {
        title: "Let’s Encrypt email",
        body: [
          "Where Let’s Encrypt sends renewal failures and certificate expiry notices.",
          "Any mailbox you actually read — it is not published anywhere and nothing else is sent to it.",
        ],
      }
    case "appName":
      return {
        title: "App name",
        body: [
          "Only needed when one droplet runs several instances. It names the pm2 process and the nginx site.",
          <>
            Leave blank for <Mono>{DEFAULT_APP_NAME}</Mono>, the script default.
          </>,
        ],
      }
    case "appPort":
      return {
        title: "App port",
        body: [
          "The loopback port nginx proxies to. It is never exposed publicly — only nginx talks to it.",
          <>
            Must be unique per instance on the droplet. Leave blank for{" "}
            <Mono>{DEFAULT_APP_PORT}</Mono>, the script default.
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

/**
 * Maps the focused field to its guidance and hands it to the shared panel.
 */
export function FieldGuidance({
  field,
  vars,
}: {
  field: keyof SetupVars | null
  vars: SetupVars
}) {
  return <GuidancePanel guidance={field ? guidanceFor(field, vars) : null} />
}
