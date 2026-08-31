"use client"

import { useState } from "react"
import {
  RiCheckLine,
  RiEyeLine,
  RiEyeOffLine,
  RiRefreshLine,
} from "@remixicon/react"

import { Button } from "@workspace/ui/components/button"
import {
  Field,
  FieldDescription,
  FieldLabel,
} from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"

/**
 * Form primitives + "looks right" checks shared by the setup wizards. The
 * checks drive the green tick only — nothing blocks, since commands render
 * either way with `<placeholder>` tokens filling the gaps.
 */

const HOSTNAME_RE =
  /^(?=.{1,253}$)[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/i
const IPV4_RE = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function isHost(value: string) {
  const m = value.match(IPV4_RE)
  if (m) return m.slice(1).every((octet) => Number(octet) <= 255)
  return HOSTNAME_RE.test(value)
}

export function isDomain(value: string) {
  return HOSTNAME_RE.test(value) && value.includes(".")
}

export function isEmail(value: string) {
  return EMAIL_RE.test(value)
}

/** A private key path — not the `.pub` half. */
export function isKeyPath(value: string) {
  return /^(~\/|\.{0,2}\/|\/)\S+$/.test(value) && !value.endsWith(".pub")
}

export function isAppName(value: string) {
  return /^[a-z0-9][a-z0-9-_]*$/i.test(value)
}

export function isPort(value: string) {
  return /^\d+$/.test(value) && Number(value) >= 1 && Number(value) <= 65535
}

// Unambiguous alphabet (no 0/O, 1/l/I) — the operator may need to retype this.
const PASSWORD_ALPHABET =
  "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789-_!"

/** 24 chars via crypto.getRandomValues — rejection-sampled, no modulo bias. */
export function generatePassword() {
  const out: string[] = []
  const max = 256 - (256 % PASSWORD_ALPHABET.length)
  while (out.length < 24) {
    const bytes = crypto.getRandomValues(new Uint8Array(32))
    for (const b of bytes) {
      if (b < max && out.length < 24) {
        out.push(PASSWORD_ALPHABET[b % PASSWORD_ALPHABET.length]!)
      }
    }
  }
  return out.join("")
}

/** Fixed-width slot left of every input: green tick when valid, else empty. */
export function ValidTick({ valid }: { valid: boolean }) {
  return (
    <span className="flex size-4 flex-none items-center justify-center self-center">
      {valid ? (
        <RiCheckLine
          className="size-4 text-emerald-600 dark:text-emerald-400"
          aria-label="Looks valid"
        />
      ) : null}
    </span>
  )
}

/** Uppercase micro-label heading a field group. */
export function GroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-mono text-xs tracking-[0.08em] text-muted-foreground uppercase">
      {children}
    </span>
  )
}

export function TextField({
  id,
  label,
  value,
  placeholder,
  valid,
  type = "text",
  onValue,
  onFocus,
}: {
  id: string
  label: string
  value: string
  placeholder: string
  valid: boolean
  type?: "text" | "email"
  onValue: (value: string) => void
  onFocus?: () => void
}) {
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <div className="flex gap-2">
        <ValidTick valid={valid} />
        <Input
          id={id}
          name={id}
          type={type}
          autoComplete="off"
          spellCheck={false}
          value={value}
          placeholder={placeholder}
          onFocus={onFocus}
          onChange={(event) => onValue(event.target.value)}
        />
      </div>
    </Field>
  )
}

/**
 * A password field with reveal + generate. Callers keep these values out of
 * `persisted` — a plaintext credential has no business surviving a reload, and
 * the description says so.
 */
export function SecretField({
  id,
  label,
  value,
  placeholder,
  valid,
  description,
  onValue,
  onFocus,
}: {
  id: string
  label: string
  value: string
  placeholder: string
  valid: boolean
  description?: string
  onValue: (value: string) => void
  onFocus?: () => void
}) {
  const [reveal, setReveal] = useState(false)

  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <div className="flex gap-2">
        <ValidTick valid={valid} />
        <Input
          id={id}
          name={id}
          type={reveal ? "text" : "password"}
          autoComplete="new-password"
          spellCheck={false}
          value={value}
          placeholder={placeholder}
          onFocus={onFocus}
          onChange={(event) => onValue(event.target.value)}
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="flex-none"
          aria-label={reveal ? "Hide password" : "Show password"}
          onClick={() => setReveal((shown) => !shown)}
        >
          {reveal ? (
            <RiEyeOffLine aria-hidden="true" />
          ) : (
            <RiEyeLine aria-hidden="true" />
          )}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="flex-none"
          aria-label="Generate a random password"
          onClick={() => {
            onValue(generatePassword())
            onFocus?.()
            setReveal(true)
          }}
        >
          <RiRefreshLine aria-hidden="true" />
        </Button>
      </div>
      {description ? <FieldDescription>{description}</FieldDescription> : null}
    </Field>
  )
}
