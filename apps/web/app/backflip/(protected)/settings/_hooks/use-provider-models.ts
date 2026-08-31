"use client"

import { useEffect, useState } from "react"

import { listAiModels } from "../_actions"
import { MODELS, type ProviderConfig } from "../_components/ai-config-form"

export type ModelOption = { id: string; label: string }

/**
 * Live models from the provider's models API (via `listAiModels`). The static
 * suggestions only bridge loading/fetch-failure once a key is saved — with no
 * key there is nothing trustworthy to show, so the list stays empty.
 *
 * Shared by the provider pane and the test modal.
 */
export function useProviderModels(cfg: ProviderConfig) {
  const fallback: ModelOption[] = cfg.keyPreview
    ? MODELS[cfg.provider].map((id) => ({ id, label: id }))
    : []
  const [models, setModels] = useState<ModelOption[]>(fallback)
  const [live, setLive] = useState(false)
  const [loading, setLoading] = useState(Boolean(cfg.keyPreview))

  useEffect(() => {
    if (!cfg.keyPreview) return
    let cancelled = false
    setLoading(true)
    listAiModels(cfg.provider)
      .then((res) => {
        if (cancelled) return
        if (res.ok) {
          setModels(res.models)
          setLive(true)
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [cfg.provider, cfg.keyPreview])

  // Keep the saved model selectable even if the live list doesn't include it.
  if (cfg.model && !models.some((m) => m.id === cfg.model)) {
    return {
      models: [{ id: cfg.model, label: cfg.model }, ...models],
      live,
      loading,
    }
  }
  return { models, live, loading }
}
