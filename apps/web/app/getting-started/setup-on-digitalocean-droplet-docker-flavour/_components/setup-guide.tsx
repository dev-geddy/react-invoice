"use client"

import { WizardShell } from "../../_components/wizard-shell"
import { type DockerSetupVars, EMPTY_VARS } from "./setup-vars"
import { STEPS, StepBody } from "./setup-steps"

/**
 * Everything except the two passwords, deliberately memory-only: a plaintext
 * credential has no business surviving a reload.
 */
const PERSISTED: (keyof DockerSetupVars)[] = [
  "host",
  "sshKey",
  "domain",
  "appName",
  "appPort",
  "adminEmail",
]

/**
 * Docker-flavour guide: the shared wizard shell wired to this flavour's steps.
 * Its own storage namespace, so switching between the two guides in one tab
 * never mixes their values.
 */
export function DockerSetupGuide() {
  return (
    <WizardShell<DockerSetupVars>
      steps={STEPS}
      emptyVars={EMPTY_VARS}
      persisted={PERSISTED}
      storageKey="backflip.setup.docker"
      renderStep={({ index, vars, onChange }) => (
        <StepBody index={index} vars={vars} onChange={onChange} />
      )}
    />
  )
}
