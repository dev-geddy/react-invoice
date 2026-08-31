/**
 * Operator variables + the command strings of the droplet setup guide.
 *
 * Every builder below mirrors a real `devops/` script signature. If a flag or
 * path changes in `devops/`, it changes here too — grep the @spec IDs.
 *
 * Pure module, no state, no I/O: values live only in the browser component that
 * owns them and are never sent anywhere.
 *
 * @spec L2-DEVOPS-01, L2-DEVOPS-02, L2-DEVOPS-06
 */

export type SetupVars = {
  host: string
  sshKey: string
  domain: string
  certbotEmail: string
  appName: string
  appPort: string
  adminEmail: string
  adminPassword: string
}

/** Script defaults — an operator only passes `-n`/`--app-port` to override. */
export const DEFAULT_APP_NAME = "backflip"
export const DEFAULT_APP_PORT = "3070"

export const EMPTY_VARS: SetupVars = {
  host: "",
  sshKey: "",
  domain: "",
  certbotEmail: "",
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
  certbotEmail: string
  adminEmail: string
  adminPassword: string
  /** ` -n name --app-port port`, only for non-default instance identity. */
  instance: string
  appDir: string
  appUrl: string
}

export function resolve(vars: SetupVars): Resolved {
  const domain = or(vars.domain, "domain")
  const name = vars.appName.trim()
  const port = vars.appPort.trim()

  const flags: string[] = []
  if (name && name !== DEFAULT_APP_NAME) flags.push(`-n ${name}`)
  if (port && port !== DEFAULT_APP_PORT) flags.push(`--app-port ${port}`)

  return {
    host: or(vars.host, "host"),
    sshKey: or(vars.sshKey, "ssh-key-path"),
    domain,
    certbotEmail: or(vars.certbotEmail, "letsencrypt-email"),
    adminEmail: or(vars.adminEmail, "owner-email"),
    adminPassword: or(vars.adminPassword, "owner-password"),
    instance: flags.length > 0 ? ` ${flags.join(" ")}` : "",
    appDir: `/var/www/${domain}`,
    appUrl: `https://${domain}`,
  }
}

export function provisionCommand(r: Resolved) {
  return [
    `./devops/setup-droplet-for-pm2.sh -h ${r.host} -i ${r.sshKey} -d ${r.domain} -m ${r.certbotEmail}${r.instance}`,
  ]
}

export function databaseCommand(r: Resolved) {
  return [`./devops/setup-droplet-db-native.sh -h ${r.host} -i ${r.sshKey}`]
}

export function envCopyCommands() {
  return [
    "cp devops/env/production.env.example .env.production",
    "cp devops/env/production.env.local.example .env.production.local",
  ]
}

/** The `.env.production` lines that follow from the variables above. */
export function productionEnvLines(r: Resolved) {
  return [`DOMAIN=${r.domain}`]
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
    `./devops/deploy-for-pm2.sh -h ${r.host} -i ${r.sshKey} -d ${r.domain}${r.instance} --env .env.production --env-local .env.production.local`,
  ]
}

/** Same flags, build done locally — `devops/deploy-for-pm2-build-locally.sh`. */
export function firstDeployLocalBuildCommand(r: Resolved) {
  return [
    `./devops/deploy-for-pm2-build-locally.sh -h ${r.host} -i ${r.sshKey} -d ${r.domain}${r.instance} --env .env.production --env-local .env.production.local`,
  ]
}

export function redeployCommand(r: Resolved) {
  return [
    `./devops/deploy-for-pm2.sh -h ${r.host} -i ${r.sshKey} -d ${r.domain}${r.instance}`,
  ]
}

/** Same flags, no env upload — the everyday fast deploy. */
export function redeployLocalBuildCommand(r: Resolved) {
  return [
    `./devops/deploy-for-pm2-build-locally.sh -h ${r.host} -i ${r.sshKey} -d ${r.domain}${r.instance}`,
  ]
}

export function rollbackCommand(r: Resolved) {
  return [
    `./devops/rollback-for-pm2.sh -h ${r.host} -i ${r.sshKey} -d ${r.domain}${r.instance}`,
  ]
}

export function logsCommand(r: Resolved) {
  const name = varsAppName(r)
  return [
    `ssh -i ${r.sshKey} root@${r.host} "sudo -H -u backflip bash -c 'cd; . \\$HOME/.nvm/nvm.sh; pm2 logs ${name}'"`,
  ]
}

export function statusCommand(r: Resolved) {
  return [
    `ssh -i ${r.sshKey} root@${r.host} "sudo -H -u backflip bash -c 'cd; . \\$HOME/.nvm/nvm.sh; pm2 status'; readlink ${r.appDir}/current"`,
  ]
}

/** The pm2 process name embedded in an instance-flagged command set. */
function varsAppName(r: Resolved) {
  const m = r.instance.match(/-n (\S+)/)
  return m?.[1] ?? DEFAULT_APP_NAME
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
    "Use the pm2-flavour scripts in devops/ (setup-droplet-for-pm2.sh,",
    "setup-droplet-db-native.sh, deploy-for-pm2-build-locally.sh) and follow",
    "devops.md. Take every value from the setup summary pasted below.",
    "",
    "Show me each command before you run it, stop on the first failure, and",
    "tell me what to check if the TLS certificate can't be issued yet.",
    "",
    "--- setup summary ---",
    "<paste the contents of backflip-setup-summary.txt here>",
  ]
}

/**
 * Plain-text summary the operator can save after the last step: every value
 * they entered plus the day-two command reference. Contains the owner password
 * when one was set — the document itself carries the warning.
 */
export function summaryDocument(vars: SetupVars) {
  const r = resolve(vars)
  const rows: [string, string][] = [
    ["Droplet host / IP", r.host],
    ["SSH private key", r.sshKey],
    ["Domain", r.domain],
    ["Let's Encrypt email", r.certbotEmail],
    ["App name (pm2 / nginx)", varsAppName(r)],
    ["App port (loopback)", vars.appPort.trim() || DEFAULT_APP_PORT],
    ["Deploy directory", r.appDir],
    ["App URL", r.appUrl],
    ["Admin console", `${r.appUrl}/backflip`],
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
    "BACKFLIP — DROPLET SETUP SUMMARY",
    "================================",
    "",
    "Keep this file private: it contains the owner password when one was set.",
    "",
    section(
      "Your values",
      rows.map(([k, v]) => `${k.padEnd(pad)}  ${v}`)
    ),
    section("Provision droplet (one-time)", provisionCommand(r)),
    section("Provision database (one-time)", databaseCommand(r)),
    section("First deploy (uploads env files)", firstDeployCommand(r)),
    section("Redeploy — droplet build", redeployCommand(r)),
    section("Redeploy — fast, build locally", redeployLocalBuildCommand(r)),
    section("Rollback to the previous release", rollbackCommand(r)),
    section("App logs", logsCommand(r)),
    section("Status (pm2 + live slot)", statusCommand(r)),
    section("Seed the owner account (one-time)", ownerSeedCommands(r)),
    "All commands run on your machine, from the repo root.",
    "",
  ].join("\n")
}

export function ownerSeedCommands(r: Resolved) {
  // Single-quoted printf args: passwords routinely contain $, !, spaces — and
  // an unquoted `<placeholder>` would be read as a shell redirection.
  return [
    `printf 'ADMIN_EMAIL=%s\\nADMIN_PASSWORD=%s\\n' '${r.adminEmail}' '${r.adminPassword}' > .env.init`,
    `scp -i ${r.sshKey} .env.init root@${r.host}:${r.appDir}/.env.init`,
    `ssh -i ${r.sshKey} root@${r.host} 'chown backflip:backflip ${r.appDir}/.env.init && sudo -H -u backflip bash -c ". \\$HOME/.nvm/nvm.sh 2>/dev/null; cd ${r.appDir} && corepack yarn init-owner" && rm ${r.appDir}/.env.init'`,
    "rm .env.init",
  ]
}
