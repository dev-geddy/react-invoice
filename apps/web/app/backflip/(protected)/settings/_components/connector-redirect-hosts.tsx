"use client"

import {
  useActionState,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react"

import { toast } from "sonner"

import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Field,
  FieldDescription,
  FieldLabel,
} from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import { RiCloseLine } from "@remixicon/react"

import { addRedirectHost, removeRedirectHost } from "../_actions"

/** Redirect-host allowlist — Add / Remove (`L2-MCP-47`, enforced by `L2-MCP-49`). */
export function ConnectorRedirectHosts({ hosts }: { hosts: string[] }) {
  const [state, action, pending] = useActionState(addRedirectHost, null)
  const [removing, startRemove] = useTransition()
  const [removingHost, setRemovingHost] = useState<string | null>(null)
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (state?.ok) formRef.current?.reset()
  }, [state])

  function handleRemove(host: string) {
    setRemovingHost(host)
    startRemove(async () => {
      const fd = new FormData()
      fd.set("host", host)
      const res = await removeRedirectHost(null, fd)
      if (res?.ok) toast.success(res.message)
      else toast.error(res?.message ?? "Couldn't remove host.")
      setRemovingHost(null)
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="text-[13px] font-semibold">Redirect host allowlist</div>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Hosts an OAuth client&rsquo;s redirect address is allowed to use.
          Removing a host doesn&rsquo;t disconnect anyone right away — it breaks
          the clients that use it on their next connection attempt.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {hosts.length === 0 ? (
          <span className="text-xs text-muted-foreground">
            No hosts allowlisted — self-registration and any manual client with
            a non-loopback redirect will be refused.
          </span>
        ) : (
          hosts.map((host) => (
            <Badge
              key={host}
              variant="secondary"
              className="gap-1.5 py-1 pr-1 pl-2.5 font-mono text-xs"
            >
              {host}
              <button
                type="button"
                onClick={() => handleRemove(host)}
                disabled={removing && removingHost === host}
                aria-label={`Remove ${host}`}
                className="rounded-full p-0.5 hover:bg-muted-foreground/20 disabled:opacity-50"
              >
                <RiCloseLine className="size-3.5" />
              </button>
            </Badge>
          ))
        )}
      </div>

      <form ref={formRef} action={action} className="flex items-end gap-3">
        <Field className="max-w-xs">
          <FieldLabel htmlFor="redirect-host">Add host</FieldLabel>
          <Input
            id="redirect-host"
            name="host"
            autoComplete="off"
            spellCheck={false}
            placeholder="app.example.com"
            className="font-mono"
            pattern="[^/:\s]+"
            title="Bare hostname — no scheme, port, path or wildcard."
          />
          <FieldDescription>
            Bare hostname only — no scheme, port, path or wildcard.
          </FieldDescription>
        </Field>
        <Button type="submit" variant="outline" disabled={pending}>
          {pending ? "Adding…" : "Add"}
        </Button>
      </form>
      {state && !state.ok ? (
        <span className="text-sm text-destructive">{state.message}</span>
      ) : null}
    </div>
  )
}
