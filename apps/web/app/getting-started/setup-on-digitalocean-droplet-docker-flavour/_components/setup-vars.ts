/**
 * Operator variables + the command strings of the docker-flavour droplet guide.
 *
 * Docker flavour = Postgres in a compose container, Caddy for automatic TLS,
 * Node/pm2 from apt (no nvm). Every builder below mirrors a real `devops/`
 * script signature — if a flag or path changes in `devops/`, it changes here
 * too. The pm2-flavour counterpart lives in the sibling guide's `setup-vars.ts`.
 *
 * Pure module, no state, no I/O: values live only in the browser component that
 * owns them and are never sent anywhere.
 *
 * @spec L2-DEVOPS-01, L2-DEVOPS-02, L2-DEVOPS-06
 */

export type DockerSetupVars = {
  host: string
  sshKey: string
  domain: string
  dbPassword: string
  appName: string
  appPort: string
  adminEmail: string
  adminPassword: string
}

/** Script defaults — an operator only passes `-n`/`--app-port` to override. */
export const DEFAULT_APP_NAME = "backflip"
export const DEFAULT_APP_PORT = "3070"
/** compose.prod.yml defaults: role, database and loopback port of the db. */
export const DEFAULT_DB_USER = "backflip"
export const DEFAULT_DB_NAME = "backflip"
export const DEFAULT_DB_PORT = "5432"

export const EMPTY_VARS: DockerSetupVars = {
  host: "",
  sshKey: "",
  domain: "",
  dbPassword: "",
  appName: "",
  appPort: "",
  adminEmail: "",
  adminPassword: "",
}

/** Trimmed value, or a visible `<placeholder>` so a command is never blank. */
function or(value: string, placeholder: string) {
  return value.trim() || `<${placeholder}>`
}

type Resolved = {
  host: string
  sshKey: string
  domain: string
  dbPassword: string
  adminEmail: string
  adminPassword: string
  /** ` -n name --app-port port`, only for non-default instance identity. */
  instance: string
  appName: string
  appDir: string
  appUrl: string
  databaseUrl: string
}

export function resolve(vars: DockerSetupVars): Resolved {
  const domain = or(vars.domain, "domain")
  const name = vars.appName.trim()
  const port = vars.appPort.trim()
  const dbPassword = or(vars.dbPassword, "postgres-password")

  const flags: string[] = []
  if (name && name !== DEFAULT_APP_NAME) flags.push(`-n ${name}`)
  if (port && port !== DEFAULT_APP_PORT) flags.push(`--app-port ${port}`)

  return {
    host: or(vars.host, "host"),
    sshKey: or(vars.sshKey, "ssh-key-path"),
    domain,
    dbPassword,
    adminEmail: or(vars.adminEmail, "owner-email"),
    adminPassword: or(vars.adminPassword, "owner-password"),
    instance: flags.length > 0 ? ` ${flags.join(" ")}` : "",
    appName: name || DEFAULT_APP_NAME,
    appDir: `/var/www/${domain}`,
    appUrl: `https://${domain}`,
    databaseUrl: `postgres://${DEFAULT_DB_USER}:${dbPassword}@127.0.0.1:${DEFAULT_DB_PORT}/${DEFAULT_DB_NAME}`,
  }
}

export function provisionCommand(r: Resolved) {
  return [
    `./devops/setup-droplet-for-docker.sh -h ${r.host} -i ${r.sshKey} -d ${r.domain}`,
  ]
}

export function databaseCommand(r: Resolved) {
  return [`./devops/setup-droplet-db-docker.sh -h ${r.host} -i ${r.sshKey}`]
}

export function envCopyCommands() {
  return [
    "cp devops/env/production.env.example .env.production",
    "cp devops/env/production.env.local.example .env.production.local",
  ]
}

/** The `.env.production` lines that follow from the variables above. */
export function productionEnvLines(r: Resolved) {
  return [
    `POSTGRES_USER=${DEFAULT_DB_USER}`,
    `POSTGRES_PASSWORD=${r.dbPassword}`,
    `POSTGRES_DB=${DEFAULT_DB_NAME}`,
    `POSTGRES_PORT=${DEFAULT_DB_PORT}`,
    `DATABASE_URL=${r.databaseUrl}`,
    `DOMAIN=${r.domain}`,
  ]
}

/** The `.env.production.local` lines that follow from the variables above. */
export function productionEnvLocalLines(r: Resolved) {
  return ["AUTH_TRUST_HOST=true", `AUTH_URL=${r.appUrl}`]
}

export function googleOAuthLines(r: Resolved) {
  return [
    `Authorized JavaScript origin   ${r.appUrl}`,
    `Authorized redirect URI        ${r.appUrl}/api/auth/callback/google`,
  ]
}

export function firstDeployCommand(r: Resolved) {
  return [
    `./devops/deploy-for-docker.sh -h ${r.host} -i ${r.sshKey} -d ${r.domain}${r.instance} --env .env.production --env-local .env.production.local`,
  ]
}

export function redeployCommand(r: Resolved) {
  return [
    `./devops/deploy-for-docker.sh -h ${r.host} -i ${r.sshKey} -d ${r.domain}${r.instance}`,
  ]
}

/** Redeploying an older ref — the docker flavour's rollback path. */
export function rollbackCommands(r: Resolved) {
  return [
    "git checkout <previous-ref>",
    `./devops/deploy-for-docker.sh -h ${r.host} -i ${r.sshKey} -d ${r.domain}${r.instance}`,
  ]
}

export function logsCommand(r: Resolved) {
  return [
    `ssh -i ${r.sshKey} root@${r.host} "sudo -H -u backflip bash -c 'cd; pm2 logs ${r.appName}'"`,
  ]
}

export function statusCommand(r: Resolved) {
  return [
    `ssh -i ${r.sshKey} root@${r.host} "sudo -H -u backflip bash -c 'cd; pm2 status'; readlink ${r.appDir}/current"`,
  ]
}

/** Postgres lives in compose here — db checks go through docker, not systemd. */
export function databaseStatusCommands(r: Resolved) {
  return [
    `ssh -i ${r.sshKey} root@${r.host} "cd ${r.appDir} && docker compose --project-directory . -f devops/compose.prod.yml ps"`,
    `ssh -i ${r.sshKey} root@${r.host} "cd ${r.appDir} && docker compose --project-directory . -f devops/compose.prod.yml logs --tail 50 db"`,
  ]
}

export function ownerSeedCommands(r: Resolved) {
  // Single-quoted printf args: passwords routinely contain $, !, spaces — and
  // an unquoted `<placeholder>` would be read as a shell redirection.
  // No nvm sourcing here: this flavour installs Node system-wide from apt.
  return [
    `printf 'ADMIN_EMAIL=%s\\nADMIN_PASSWORD=%s\\n' '${r.adminEmail}' '${r.adminPassword}' > .env.init`,
    `scp -i ${r.sshKey} .env.init root@${r.host}:${r.appDir}/.env.init`,
    `ssh -i ${r.sshKey} root@${r.host} 'chown backflip:backflip ${r.appDir}/.env.init && sudo -H -u backflip bash -c "cd ${r.appDir} && corepack yarn init-owner" && rm ${r.appDir}/.env.init'`,
    "rm .env.init",
  ]
}

/**
 * The prompt an operator can paste into Claude Code, in their clone of the
 * project, instead of running the steps by hand. It names the scripts rather
 * than the commands: the agent reads the repo (and `devops.md`) for the flags,
 * so this stays correct when a script signature changes.
 *
 * Paired with the summary document below — the values live there.
 */
export function claudeHandoffPrompt() {
  return [
    "Set up my DigitalOcean droplet for this project and deploy it.",
    "",
    "Use the docker-flavour scripts in devops/ (setup-droplet-for-docker.sh,",
    "setup-droplet-db-docker.sh, deploy-for-docker.sh) and follow devops.md.",
    "Take every value from the setup summary pasted below.",
    "",
    "Show me each command before you run it, stop on the first failure, and",
    "tell me what to check if Caddy can't get a certificate yet.",
    "",
    "--- setup summary ---",
    "<paste the contents of backflip-setup-summary-docker.txt here>",
  ]
}

/**
 * Plain-text summary the operator can save after the last step: every value
 * they entered plus the day-two command reference. Contains the database and
 * owner passwords when set — the document itself carries the warning.
 */
export function summaryDocument(vars: DockerSetupVars) {
  const r = resolve(vars)
  const rows: [string, string][] = [
    ["Droplet host / IP", r.host],
    ["SSH private key", r.sshKey],
    ["Domain", r.domain],
    ["App name (pm2)", r.appName],
    ["App port (loopback)", vars.appPort.trim() || DEFAULT_APP_PORT],
    ["Deploy directory", r.appDir],
    ["App URL", r.appUrl],
    ["Admin console", `${r.appUrl}/backflip`],
    [
      "Database (container)",
      `postgres:17-alpine on 127.0.0.1:${DEFAULT_DB_PORT}`,
    ],
    ["Database user / name", `${DEFAULT_DB_USER} / ${DEFAULT_DB_NAME}`],
    ["Database password", r.dbPassword],
    ["Owner email", r.adminEmail],
    [
      "Owner password",
      vars.adminPassword ? vars.adminPassword : "(not set — Google-only owner)",
    ],
  ]
  const pad = Math.max(...rows.map(([k]) => k.length))

  const section = (title: string, lines: string[]) =>
    [`${title}`, "-".repeat(title.length), ...lines, ""].join("\n")

  return [
    "BACKFLIP — DROPLET SETUP SUMMARY (DOCKER FLAVOUR)",
    "=================================================",
    "",
    "Keep this file private: it contains the database password, and the owner",
    "password when one was set.",
    "",
    section(
      "Your values",
      rows.map(([k, v]) => `${k.padEnd(pad)}  ${v}`)
    ),
    section("Provision droplet (one-time)", provisionCommand(r)),
    section("Provision database engine (one-time)", databaseCommand(r)),
    section("First deploy (uploads env files)", firstDeployCommand(r)),
    section("Redeploy", redeployCommand(r)),
    section("Roll back (redeploy an older ref)", rollbackCommands(r)),
    section("App logs", logsCommand(r)),
    section("Status (pm2 + live slot)", statusCommand(r)),
    section("Database container status / logs", databaseStatusCommands(r)),
    section("Seed the owner account (one-time)", ownerSeedCommands(r)),
    "All commands run on your machine, from the repo root.",
    "",
  ].join("\n")
}
