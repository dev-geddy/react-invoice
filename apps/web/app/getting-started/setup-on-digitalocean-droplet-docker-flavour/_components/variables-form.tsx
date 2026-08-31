"use client"

import { RiArrowRightSLine } from "@remixicon/react"
import { useState } from "react"

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@workspace/ui/components/collapsible"

import {
  GroupLabel,
  isAppName,
  isDomain,
  isEmail,
  isHost,
  isKeyPath,
  isPort,
  SecretField,
  TextField,
} from "../../_components/wizard-fields"
import { FieldGuidance } from "./field-guidance"
import {
  DEFAULT_APP_NAME,
  DEFAULT_APP_PORT,
  type DockerSetupVars,
} from "./setup-vars"

/**
 * Per-field "looks right" checks — light validation for the green tick only.
 * Nothing blocks: commands render either way, placeholders fill the gaps.
 */
const VALID: Record<keyof DockerSetupVars, (value: string) => boolean> = {
  host: isHost,
  sshKey: isKeyPath,
  domain: isDomain,
  // Goes into a URL unencoded — reject what would break DATABASE_URL parsing.
  dbPassword: (v) => v.length >= 12 && !/[@/:\s]/.test(v),
  appName: isAppName,
  appPort: isPort,
  adminEmail: isEmail,
  adminPassword: (v) => v.length >= 8,
}

type FieldSpec = {
  key: keyof DockerSetupVars
  label: string
  placeholder: string
  type?: "text" | "email"
}

const CORE: FieldSpec[] = [
  { key: "host", label: "Droplet host or IP", placeholder: "203.0.113.10" },
  {
    key: "sshKey",
    label: "SSH private key path",
    placeholder: "~/.ssh/id_ed25519",
  },
  { key: "domain", label: "Domain", placeholder: "app.example.com" },
]

const OPTIONAL: FieldSpec[] = [
  { key: "appName", label: "App name", placeholder: DEFAULT_APP_NAME },
  { key: "appPort", label: "App port", placeholder: DEFAULT_APP_PORT },
]

/** A value the operator has set to something other than the script default. */
function overridden(value: string, fallback: string) {
  const trimmed = value.trim()
  return trimmed !== "" && trimmed !== fallback
}

function hasInstanceOverride(vars: DockerSetupVars) {
  return (
    overridden(vars.appName, DEFAULT_APP_NAME) ||
    overridden(vars.appPort, DEFAULT_APP_PORT)
  )
}

/**
 * The variables step of the docker-flavour guide. Same shape as the pm2
 * guide's form, minus the Let's Encrypt email (Caddy issues certificates on
 * its own) and plus the Postgres password, which this flavour's operator picks
 * rather than receives.
 *
 * Neither password is persisted — the wizard shell only mirrors the keys it is
 * handed, and both are left out of that list.
 */
export function VariablesForm({
  vars,
  onChange,
}: {
  vars: DockerSetupVars
  onChange: (key: keyof DockerSetupVars, value: string) => void
}) {
  const [focused, setFocused] = useState<keyof DockerSetupVars | null>(null)
  // `null` = untouched, follow the values: collapsed by default, but already
  // open when a non-default instance name/port is present. Restored values
  // arrive after mount (the shell reads sessionStorage in an effect), so this
  // has to be derived rather than an initial state. Any manual toggle wins.
  const [optionalToggled, setOptionalToggled] = useState<boolean | null>(null)
  const optionalOpen = optionalToggled ?? hasInstanceOverride(vars)

  function renderField(spec: FieldSpec) {
    return (
      <TextField
        key={spec.key}
        id={`var-${spec.key}`}
        label={spec.label}
        type={spec.type}
        value={vars[spec.key]}
        placeholder={spec.placeholder}
        valid={VALID[spec.key](vars[spec.key].trim())}
        onFocus={() => setFocused(spec.key)}
        onValue={(value) => onChange(spec.key, value)}
      />
    )
  }

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-8">
      <div className="w-full max-w-[26rem] min-w-0 flex-1 rounded-xl border bg-card px-5 py-5">
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-4">{CORE.map(renderField)}</div>

          <div className="flex flex-col gap-4 border-t pt-5">
            <GroupLabel>Database — step 6 only</GroupLabel>
            <SecretField
              id="var-dbPassword"
              label="Postgres password"
              value={vars.dbPassword}
              placeholder="a long random password"
              valid={VALID.dbPassword(vars.dbPassword)}
              description="Not stored — refill after a reload."
              onFocus={() => setFocused("dbPassword")}
              onValue={(value) => onChange("dbPassword", value)}
            />
          </div>

          <Collapsible
            open={optionalOpen}
            onOpenChange={(open) => setOptionalToggled(open)}
            className="flex flex-col gap-4 border-t pt-5"
          >
            <CollapsibleTrigger className="group flex w-full items-center gap-1.5 text-left">
              <RiArrowRightSLine
                className="size-4 flex-none text-muted-foreground transition-transform group-data-[panel-open]:rotate-90"
                aria-hidden="true"
              />
              <GroupLabel>Optional — instance name and port</GroupLabel>
            </CollapsibleTrigger>
            <CollapsibleContent className="flex flex-col gap-4">
              {OPTIONAL.map(renderField)}
            </CollapsibleContent>
          </Collapsible>

          <div className="flex flex-col gap-4 border-t pt-5">
            <GroupLabel>Owner account — step 8 only</GroupLabel>
            <TextField
              id="var-adminEmail"
              label="Owner email"
              type="email"
              value={vars.adminEmail}
              placeholder="you@example.com"
              valid={VALID.adminEmail(vars.adminEmail.trim())}
              onFocus={() => setFocused("adminEmail")}
              onValue={(value) => onChange("adminEmail", value)}
            />
            <SecretField
              id="var-adminPassword"
              label="Owner password"
              value={vars.adminPassword}
              placeholder="a long random passphrase"
              valid={VALID.adminPassword(vars.adminPassword)}
              description="Not stored — refill after a reload."
              onFocus={() => setFocused("adminPassword")}
              onValue={(value) => onChange("adminPassword", value)}
            />
          </div>
        </div>
      </div>

      <div className="w-full max-w-[26rem] min-w-0 lg:w-80 lg:max-w-none lg:flex-none">
        <FieldGuidance field={focused} vars={vars} />
      </div>
    </div>
  )
}
