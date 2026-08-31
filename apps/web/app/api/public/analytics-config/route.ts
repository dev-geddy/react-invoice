import { NextResponse } from "next/server"

import { analyticsConfig, db } from "@workspace/db"
import { eq } from "drizzle-orm"

// Uses pg (db) — Node runtime, not edge. `force-dynamic` keeps it out of the
// build-time prerender pass (no database is reachable during `next build`) and
// off the full route cache; freshness is bounded by the Cache-Control below.
export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * GET /api/public/analytics-config — the only analytics surface public pages
 * touch. Unauthenticated by design; every field it returns is already public
 * (the GA measurement id ships in the gtag URL, the banner copy is rendered to
 * every visitor). It deliberately exposes **nothing else** from the row — no
 * id, no timestamps.
 *
 * Fetching this client-side (rather than reading the DB in a server component)
 * is what keeps `/` and `/getting-started/*` statically prerendered.
 *
 * Cached ~5 min at the CDN/browser, so an admin change reaches visitors within
 * that window. Never 500s: on a DB error it reports analytics-off so a broken
 * database cannot take the public site's chrome down with it.
 *
 * @spec L2-ANALYTICS-03
 */
export async function GET() {
  const off = {
    measurementId: null,
    cookieBannerEnabled: false,
    cookieBannerText: "",
  }

  try {
    const [row] = await db
      .select({
        measurementId: analyticsConfig.measurementId,
        cookieBannerEnabled: analyticsConfig.cookieBannerEnabled,
        cookieBannerText: analyticsConfig.cookieBannerText,
      })
      .from(analyticsConfig)
      .where(eq(analyticsConfig.kind, "google_analytics"))

    return NextResponse.json(
      {
        measurementId: row?.measurementId ?? null,
        cookieBannerEnabled: row?.cookieBannerEnabled ?? false,
        cookieBannerText: row?.cookieBannerText ?? "",
      },
      {
        headers: {
          "Cache-Control":
            "public, max-age=60, s-maxage=300, stale-while-revalidate=600",
        },
      }
    )
  } catch {
    return NextResponse.json(off, {
      headers: { "Cache-Control": "no-store" },
    })
  }
}
