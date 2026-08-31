"use client"

import { WizardShell } from "../../_components/wizard-shell"
import { EMPTY_VARS, type SetupVars } from "./setup-vars"
import { STEPS, StepBody } from "./setup-steps"

/**
 * Everything except the owner password, which is deliberately memory-only: a
 * plaintext credential has no business surviving a reload.
 */
const PERSISTED: (keyof SetupVars)[] = [
  "host",
  "sshKey",
  "domain",
  "certbotEmail",
  "appName",
  "appPort",
  "adminEmail",
]

/** pm2-flavour guide: the shared wizard shell wired to this flavour's steps. */
export function SetupGuide() {
  return (
    <WizardShell<SetupVars>
      steps={STEPS}
      emptyVars={EMPTY_VARS}
      persisted={PERSISTED}
      storageKey="backflip.setup"
      renderStep={({ index, vars, onChange }) => (
        <StepBody index={index} vars={vars} onChange={onChange} />
      )}
    />
  )
}
