"use client"

import {
  RiDownloadLine,
  RiExternalLinkLine,
  RiGitForkLine,
} from "@remixicon/react"

import { Button } from "@workspace/ui/components/button"

import { CommandBlock } from "../../_components/command-block"
import {
  ChecklistRow,
  EnvRow,
  Mono,
  Note,
  RowCard,
  RunOn,
  SubSection,
} from "../../_components/step-chrome"
import type { StepMeta } from "../../_components/wizard-stepper"
import {
  databaseCommand,
  databaseStatusCommands,
  DEFAULT_DB_PORT,
  type DockerSetupVars,
  envCopyCommands,
  firstDeployCommand,
  googleOAuthLines,
  claudeHandoffPrompt,
  ownerSeedCommands,
  productionEnvLines,
  productionEnvLocalLines,
  provisionCommand,
  redeployCommand,
  resolve,
  rollbackCommands,
  summaryDocument,
} from "./setup-vars"
import { VariablesForm } from "./variables-form"

/** The wizard's running order. Index = step number - 1. */
export const STEPS: StepMeta[] = [
  {
    id: "get-droplet",
    title: "Get a droplet",
    short: "Get droplet",
    lead: "You need a fresh Ubuntu droplet to deploy to. Create one on DigitalOcean, note its IP, and come back — everything else happens from your machine.",
  },
  {
    id: "clone",
    title: "Clone Backflip locally",
    short: "Clone",
    lead: "Everything in this guide runs from a local clone — provisioning, deploys, migrations, the admin seed. Grab the repo and the few tools the scripts expect.",
  },
  {
    id: "variables",
    title: "Your variables",
    short: "Variables",
    lead: "Fill these in once. Every command in the following steps rewrites itself from these values, so you only ever copy a finished line.",
  },
  {
    id: "droplet",
    title: "Provision the droplet",
    short: "Droplet",
    lead: "One-time, idempotent. Installs Docker (for the database), Node 24 + corepack yarn 4 and pm2 from apt, native Caddy for TLS, hardens SSH to key-only, adds fail2ban and 2 GB of swap, and opens ports 22, 80 and 443 only.",
  },
  {
    id: "database",
    title: "Provision the database engine",
    short: "Database",
    lead: "Makes sure Docker and the compose plugin are on the droplet. The Postgres container itself is started by the first deploy, once the droplet has its env file.",
  },
  {
    id: "env",
    title: "Fill in the env files",
    short: "Env files",
    lead: "Two files on your machine. The first deploy uploads them to the droplet as .env and .env.local, mode 0600 — they are never committed. Compose reads the same .env for the database credentials.",
  },
  {
    id: "deploy",
    title: "First deploy",
    short: "Deploy",
    lead: "Syncs the repo, starts the database container, installs, builds the Next standalone bundle, runs the Drizzle migrations, flips the release symlink, restarts pm2 and reloads Caddy. The env flags upload your files — pass them on the first run only.",
  },
  {
    id: "seed",
    title: "Seed the admin account",
    short: "Admin",
    lead: "One-off, after the first deploy. Writes a temporary .env.init, hands it to the locked backflip user on the droplet, runs the seed, then removes it on both ends.",
  },
  {
    id: "summary",
    title: "Save your summary",
    short: "Summary",
    lead: "Everything you entered plus the day-two command reference, as one plain-text file. This page forgets your values when the tab closes — this file doesn't.",
  },
]

/**
 * The body of one wizard step. Split from the shell so the shell only deals
 * with navigation and persistence; all guide copy and command blocks live here.
 *
 * Docker flavour throughout: Postgres in compose, Caddy for TLS, Node and pm2
 * from apt. Where a command differs from the pm2-flavour guide, it differs
 * because the script does.
 */
export function StepBody({
  index,
  vars,
  onChange,
}: {
  index: number
  vars: DockerSetupVars
  onChange: (key: keyof DockerSetupVars, value: string) => void
}) {
  const r = resolve(vars)

  if (index === 0) {
    return (
      <div className="flex flex-col gap-4">
        <RowCard className="max-w-xl">
          <ChecklistRow term="Image">
            Ubuntu LTS (24.04 or newer), plain image — not the Docker
            marketplace image. Provisioning installs Docker itself.
          </ChecklistRow>
          <ChecklistRow term="Size">
            2 GB RAM or more. This flavour builds the app{" "}
            <em>on the droplet</em>, with the database container running beside
            it — the 512 MB size that suits the pm2 build-locally flow is tight
            here, even with the 2 GB of swap provisioning adds.
          </ChecklistRow>
          <ChecklistRow term="Authentication">
            choose SSH key and add your <em>public</em> key during creation. No
            key yet? Generate one below first.
          </ChecklistRow>
          <ChecklistRow term="After creation">
            copy the droplet&apos;s public IP; it&apos;s the first variable in
            step 3.
          </ChecklistRow>
          <ChecklistRow term="Point your domain at it">
            add a DNS <Mono>A</Mono> record for the domain you&apos;ll use,
            directed at the droplet&apos;s IP, right after creation. Caddy
            requests the certificate the first time it starts and proves
            ownership over HTTP, so until DNS resolves to this droplet there is
            no TLS and the site isn&apos;t reachable at your domain. If DNS is
            on DigitalOcean: Networking → Domains → your domain → <Mono>A</Mono>{" "}
            record, hostname <Mono>@</Mono> (or a subdomain), directed to the
            droplet. Records take a few minutes to propagate — adding it now
            means it&apos;s live by the time you deploy.
          </ChecklistRow>
        </RowCard>
        <Note>
          You don&apos;t have to run any of this by hand. Fill in the variables
          as you go and the last step gives you a summary you can paste into{" "}
          <strong>Claude Code</strong>, running in your clone of the project —
          it drives the same <Mono>devops/</Mono> scripts for you.
        </Note>
        <div className="flex flex-col gap-2">
          <RunOn>your machine — any shell</RunOn>
          <CommandBlock
            lines={[
              'ssh-keygen -t ed25519 -f ~/.ssh/id_backflip -C "backflip"',
              "cat ~/.ssh/id_backflip.pub",
            ]}
            label="generate an ssh key (skip if you have one)"
          />
        </div>
        <Note>
          Upload the printed <Mono>.pub</Mono> contents in the DigitalOcean
          panel under Settings → Security → SSH keys, then pick that key when
          creating the droplet. The private half (
          <Mono>~/.ssh/id_backflip</Mono>) stays on your machine — it&apos;s the
          key path variable in step 3.
        </Note>
        <div>
          <Button
            size="lg"
            render={
              <a
                href="https://m.do.co/c/773b078c800a"
                target="_blank"
                rel="noopener noreferrer"
              />
            }
          >
            Create a droplet on DigitalOcean
            <RiExternalLinkLine aria-hidden="true" />
          </Button>
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Referral link — new DigitalOcean accounts get free starting credit,
          and it supports this project. Already have a droplet? Skip straight to
          the next step.
        </p>
      </div>
    )
  }

  if (index === 1) {
    return (
      <div className="flex flex-col gap-4">
        <RowCard className="max-w-xl">
          <ChecklistRow term="git">
            to clone the repo and pull updates.
          </ChecklistRow>
          <ChecklistRow term="Node.js 24 + corepack">
            same major the droplet runs; corepack ships with Node and activates
            the pinned yarn 4 automatically. <Mono>nvm</Mono> is the easiest way
            to get it. Only the local typecheck preflight uses it — this flavour
            builds remotely.
          </ChecklistRow>
          <ChecklistRow term="OpenSSH + rsync + openssl">
            the deploy syncs the repo with <Mono>rsync</Mono> over{" "}
            <Mono>ssh</Mono>, and two env secrets are generated with{" "}
            <Mono>openssl rand</Mono>. Preinstalled on macOS and Linux; on
            Windows use WSL.
          </ChecklistRow>
        </RowCard>
        <div className="flex flex-col gap-3">
          <p className="text-sm leading-relaxed text-muted-foreground">
            Fork it first if you intend to keep what you build. The project then
            lives in your own repository — your commits, your history — and you
            can still pull updates from upstream later.
          </p>
          <div>
            <Button
              variant="outline"
              render={
                <a
                  href="https://github.com/dev-geddy/backflip/fork"
                  target="_blank"
                  rel="noopener noreferrer"
                />
              }
            >
              <RiGitForkLine aria-hidden="true" />
              Fork it, make it yours
            </Button>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <RunOn>your machine — any shell</RunOn>
          <CommandBlock
            lines={[
              "git clone https://github.com/<your-github-account>/backflip.git",
              "cd backflip",
              "corepack enable",
              "corepack yarn install",
            ]}
            label="clone your fork"
          />
          <CommandBlock
            lines={[
              "git clone https://github.com/dev-geddy/backflip.git",
              "cd backflip",
              "corepack enable",
              "corepack yarn install",
            ]}
            label="or clone this repo directly"
          />
        </div>
        <Note>
          Docker is <strong>not</strong> needed on your machine — only on the
          droplet, where it runs the database. Nothing here builds an image of
          the app itself: the app runs on the host under pm2, exactly like the
          pm2 flavour.
        </Note>
        <Note>
          Backflip is developed primarily with <strong>Claude Code</strong> —
          the repo ships instructions, skills and doc contracts tuned for it
          (that&apos;s what the Start building phase leans on). Other AI coding
          agents are untested. That is also what makes the handoff in the last
          step work: point Claude Code at this clone and it can run the rest of
          this guide for you, docker flavour included.
        </Note>
      </div>
    )
  }

  if (index === 2) return <VariablesForm vars={vars} onChange={onChange} />

  if (index === 3) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <RunOn>your machine — repo root</RunOn>
          <CommandBlock lines={provisionCommand(r)} />
        </div>
        <Note>
          No certificate email is asked for anywhere in this flavour: Caddy
          registers with Let&apos;s Encrypt on its own and renews without a cron
          job or a certbot timer. The DNS <Mono>A</Mono> record still has to
          resolve to this droplet before the first deploy, or the certificate
          request fails and Caddy serves HTTP only.
        </Note>
        <Note>
          Re-running is safe — every step checks before it acts. The firewall
          also opens <Mono>443/udp</Mono> here, which is what lets Caddy serve
          HTTP/3.
        </Note>
      </div>
    )
  }

  if (index === 4) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <RunOn>your machine — repo root</RunOn>
          <CommandBlock lines={databaseCommand(r)} />
        </div>
        <Note>
          The provisioning step already installed Docker, so on a droplet set up
          with the command from step 4 this one just confirms the engine and the
          compose plugin are present. Run it when you are adding a dockerized
          database to a droplet provisioned another way.
        </Note>
        <Note>
          Nothing is created yet. The <Mono>postgres:17-alpine</Mono> container
          starts on the first deploy, publishes on{" "}
          <Mono>127.0.0.1:{DEFAULT_DB_PORT}</Mono> only, and keeps its data in
          the named volume <Mono>backflip_pgdata</Mono> — deploys and container
          restarts never touch it. The role and database are created from the
          <Mono>POSTGRES_*</Mono> values you set in the next step.
        </Note>
      </div>
    )
  }

  if (index === 5) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <RunOn>your machine — repo root</RunOn>
          <CommandBlock lines={envCopyCommands()} />
        </div>

        <RowCard>
          <EnvRow
            fields="POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB, POSTGRES_PORT"
            file=".env.production"
          >
            Compose creates the container from these on first start. The
            password is the one you picked in step 3.
          </EnvRow>
          <EnvRow fields="DATABASE_URL" file=".env.production">
            What the app and the migrations connect with. Must match the four
            values above — the block below has it already assembled.
          </EnvRow>
          <EnvRow fields="ENCRYPTION_KEY" file=".env.production">
            Encrypts secrets at rest (AI provider API keys). Generate it with{" "}
            <Mono>openssl rand -base64 32</Mono>.
          </EnvRow>
          <EnvRow fields="DOMAIN" file=".env.production">
            The public domain Caddy serves. The deploy renders the Caddyfile
            from this value, so a typo here means a certificate for the wrong
            name.
          </EnvRow>
          <EnvRow fields="AUTH_SECRET" file=".env.production.local">
            Signs Auth.js sessions. Generate it with{" "}
            <Mono>openssl rand -base64 33</Mono>.
          </EnvRow>
          <EnvRow
            fields="AUTH_TRUST_HOST, AUTH_URL"
            file=".env.production.local"
          >
            The app sits behind Caddy, so both are required.
          </EnvRow>
          <EnvRow
            fields="AUTH_GOOGLE_ID, AUTH_GOOGLE_SECRET"
            file=".env.production.local"
          >
            Optional. From a Google Cloud Console OAuth 2.0 client — see below.
            Google sign-in only works for emails already registered on the
            platform.
          </EnvRow>
        </RowCard>

        <div className="flex flex-col gap-2">
          <RunOn>your machine — any shell</RunOn>
          <div className="grid gap-3 sm:grid-cols-2">
            <CommandBlock
              lines={["openssl rand -base64 32"]}
              label="ENCRYPTION_KEY"
            />
            <CommandBlock
              lines={["openssl rand -base64 33"]}
              label="AUTH_SECRET"
            />
          </div>
        </div>

        <CommandBlock
          lines={productionEnvLines(r)}
          label=".env.production"
          prompt={false}
        />
        <CommandBlock
          lines={productionEnvLocalLines(r)}
          label=".env.production.local"
          prompt={false}
        />

        <Note>
          The database password is only read when the data volume is first
          created. Changing it later means changing it inside the running
          Postgres too — pick it once, here.
        </Note>

        <SubSection title="Optional — Google sign-in">
          <p className="text-sm leading-relaxed text-muted-foreground">
            In Google Cloud Console, create an OAuth 2.0 Web application client
            under APIs &amp; Services → Credentials, and register these two URLs
            on it. Its client ID and secret are the <Mono>AUTH_GOOGLE_*</Mono>{" "}
            values.
          </p>
          <CommandBlock
            lines={googleOAuthLines(r)}
            label="Google Cloud Console → Credentials"
            prompt={false}
          />
        </SubSection>
      </div>
    )
  }

  if (index === 6) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <RunOn>your machine — repo root</RunOn>
          <CommandBlock lines={firstDeployCommand(r)} label="first deploy" />
          <CommandBlock lines={redeployCommand(r)} label="every run after" />
        </div>
        <Note>
          Later runs drop the two <Mono>--env</Mono> flags: they never touch the
          droplet’s env files again. The release is assembled in the inactive
          slot (<Mono>blue</Mono>/<Mono>green</Mono>) and the{" "}
          <Mono>current</Mono> symlink flips only at the end, so anything that
          fails before the flip leaves the previous release serving. When it
          finishes, the app is live at <Mono>{r.appUrl}</Mono>.
        </Note>
        <Note>
          The first run takes a while: it pulls the Postgres image, installs
          dependencies and builds Next on the droplet. Add{" "}
          <Mono>--skip-migrations</Mono> to any run that shouldn&apos;t touch
          the schema.
        </Note>

        <SubSection title="Rolling back">
          <p className="text-sm leading-relaxed text-muted-foreground">
            There is no <Mono>rollback-for-docker.sh</Mono> — the slot-flipping
            rollback script today assumes the pm2 flavour&apos;s nvm layout. On
            this flavour, roll back by redeploying an older ref; it rebuilds
            that version and flips as usual. Migrations are not reverted either
            way.
          </p>
          <div className="flex flex-col gap-2">
            <RunOn>your machine — repo root</RunOn>
            <CommandBlock lines={rollbackCommands(r)} />
          </div>
        </SubSection>

        <SubSection title="Checking on it afterwards">
          <div className="flex flex-col gap-2">
            <RunOn>your machine — any shell</RunOn>
            <CommandBlock lines={databaseStatusCommands(r)} label="database" />
          </div>
          <Note>
            Compose is always invoked from <Mono>{r.appDir}</Mono> with{" "}
            <Mono>--project-directory .</Mono> so it reads the droplet&apos;s{" "}
            <Mono>.env</Mono> for the credentials. Postgres is published on
            loopback only, so this is the way in — there is no exposed port.
          </Note>
        </SubSection>
      </div>
    )
  }

  if (index === 7) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <RunOn>your machine — repo root</RunOn>
          <CommandBlock lines={ownerSeedCommands(r)} />
        </div>
        <Note>
          All four lines run locally — <Mono>scp</Mono> and <Mono>ssh</Mono>{" "}
          reach the droplet for you. Never commit <Mono>.env.init</Mono>: it is
          gitignored, and the last line deletes it.
        </Note>
        <Note>
          No <Mono>nvm</Mono> here, unlike the pm2 flavour: Node is installed
          system-wide from apt on this droplet, so the locked{" "}
          <Mono>backflip</Mono> user finds <Mono>corepack</Mono> on its PATH.
        </Note>
        <Note>
          Done. Sign in at <Mono>{r.appUrl}/backflip</Mono> with the owner email
          and password from step 3. Leave the password blank for a Google-only
          owner.
        </Note>
      </div>
    )
  }

  const doc = summaryDocument(vars)
  return (
    <div className="flex flex-col gap-4">
      <div>
        <Button
          type="button"
          onClick={() => {
            const url = URL.createObjectURL(
              new Blob([doc], { type: "text/plain;charset=utf-8" })
            )
            const a = document.createElement("a")
            a.href = url
            a.download = "backflip-setup-summary-docker.txt"
            a.click()
            URL.revokeObjectURL(url)
          }}
        >
          <RiDownloadLine aria-hidden="true" />
          Download backflip-setup-summary-docker.txt
        </Button>
      </div>
      <Note>
        The file includes the database password, and the owner password when one
        was set — store it somewhere private (a password manager beats a
        Downloads folder).
      </Note>
      <CommandBlock
        lines={doc.split("\n")}
        label="backflip-setup-summary-docker.txt"
        prompt={false}
      />
      <SubSection title="Or hand the whole setup to Claude Code">
        <p className="text-sm leading-relaxed text-muted-foreground">
          Open <strong>Claude Code</strong> in your clone of the project (the
          fork from step 2), paste the prompt below, then paste the summary
          under it. It reads the repo, runs the same <Mono>devops/</Mono>{" "}
          scripts in order, and asks before each command.
        </p>
        <CommandBlock
          lines={claudeHandoffPrompt()}
          label="paste into Claude Code"
          prompt={false}
        />
        <Note>
          The summary carries your secrets, so pasting it sends them to the
          model. Fine for a droplet you control; if you&apos;d rather not, leave
          the password lines out and type them when the agent asks.
        </Note>
      </SubSection>
    </div>
  )
}
