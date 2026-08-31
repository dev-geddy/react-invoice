"use client"

import { useCallback, useEffect, useState } from "react"

import { CookieBanner } from "./cookie-banner"

/** localStorage key holding the visitor's analytics choice. */
const CONSENT_KEY = "backflip.consent.analytics"
const SCRIPT_ID = "ga-gtag-js"

/**
 * Last-resort copy, matching the migration seed. Only reached if an operator
 * clears the text while leaving the banner on — a consent bar must never render
 * without an explanation.
 */
const FALLBACK_TEXT =
  "Can we count your visit? It shows us which pages actually help people — we only ever look at totals, and never use it for ads. It runs on Google Analytics cookies, and only if you accept."

type Consent = "granted" | "denied"

type Config = {
  measurementId: string | null
  cookieBannerEnabled: boolean
  cookieBannerText: string
}

declare global {
  interface Window {
    dataLayer?: unknown[]
  }
}

/** Inject gtag.js once. Only ever called when analytics is allowed to run. */
function loadGtag(measurementId: string) {
  if (document.getElementById(SCRIPT_ID)) return

  const script = document.createElement("script")
  script.id = SCRIPT_ID
  script.async = true
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`
  document.head.appendChild(script)

  window.dataLayer = window.dataLayer ?? []
  const gtag = (...args: unknown[]) => {
    window.dataLayer?.push(args)
  }
  gtag("js", new Date())
  gtag("config", measurementId)
}

function readConsent(): Consent | null {
  try {
    const v = window.localStorage.getItem(CONSENT_KEY)
    return v === "granted" || v === "denied" ? v : null
  } catch {
    // Private mode / storage blocked — treat as undecided.
    return null
  }
}

/**
 * Public-site analytics gate: fetches the public analytics config, then decides
 * whether Google Analytics may load and whether the cookie banner is shown.
 *
 * Rules:
 * - No measurement id → renders nothing, loads nothing (the banner exists only
 *   to gate analytics, so with nothing to gate there is no banner).
 * - Banner disabled → gtag.js loads unconditionally.
 * - Banner enabled → gtag.js loads **only after** an explicit Accept. Decline
 *   loads nothing at all. Either choice is persisted in localStorage, so the
 *   banner is never shown again.
 *
 * Mounted from public chrome only (`SiteFooter`) — never under `/backflip`.
 *
 * @spec L2-ANALYTICS-04, L2-ANALYTICS-06
 */
export function AnalyticsGate() {
  const [config, setConfig] = useState<Config | null>(null)
  const [consent, setConsent] = useState<Consent | null>(null)

  // Config first; the consent value is only meaningful once we know whether a
  // banner is even in play.
  useEffect(() => {
    let active = true
    fetch("/api/public/analytics-config")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: Config | null) => {
        if (!active || !data?.measurementId) return
        setConsent(readConsent())
        setConfig(data)
      })
      .catch(() => {
        // Analytics is optional: a failed config fetch just means no analytics.
      })
    return () => {
      active = false
    }
  }, [])

  const allowed =
    config !== null &&
    config.measurementId !== null &&
    (!config.cookieBannerEnabled || consent === "granted")

  useEffect(() => {
    if (allowed && config?.measurementId) loadGtag(config.measurementId)
  }, [allowed, config?.measurementId])

  const choose = useCallback((value: Consent) => {
    try {
      window.localStorage.setItem(CONSENT_KEY, value)
    } catch {
      // Storage blocked — honour the choice for this page view only.
    }
    setConsent(value)
  }, [])

  const showBanner =
    config !== null && config.cookieBannerEnabled && consent === null

  if (!showBanner) return null

  return (
    <CookieBanner
      text={config.cookieBannerText.trim() || FALLBACK_TEXT}
      onAccept={() => choose("granted")}
      onDecline={() => choose("denied")}
    />
  )
}
