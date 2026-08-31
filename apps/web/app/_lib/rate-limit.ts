/**
 * Tiny in-process fixed-window rate limiter. No external store — counters live
 * in a module-scoped Map, so limits hold within a single Node process only.
 * That matches this app's deployment (one pm2 process / one container per
 * instance, app bound to loopback). A multi-instance deployment would need a
 * shared store (Redis/DB) instead; callers document that where it matters.
 *
 * Two usage shapes:
 * - count-every-call (AI test endpoint): `hit()` each request, reject when
 *   `blocked()`.
 * - count-failures-only (login): `blocked()` first, `hit()` on failure,
 *   `reset()` on success.
 *
 * @spec L2-AUTH-40, L2-AI-22
 */

type Bucket = { count: number; resetAt: number }

/** Soft cap on tracked keys; expired entries are pruned before this bites. */
const MAX_KEYS = 10_000

export type RateLimiter = {
  /** True when `key` has reached the cap within the current window. */
  blocked: (key: string) => boolean
  /** Record one event against `key` (opens a window if none is active). */
  hit: (key: string) => void
  /** Clear `key`'s counter (e.g. on a successful login). */
  reset: (key: string) => void
  /** Milliseconds until `key`'s window resets (0 if none active). */
  retryAfterMs: (key: string) => number
}

export function createRateLimiter(opts: {
  max: number
  windowMs: number
  now?: () => number
}): RateLimiter {
  const { max, windowMs } = opts
  const now = opts.now ?? (() => Date.now())
  const buckets = new Map<string, Bucket>()

  /** Return the live bucket for `key`, dropping it if its window has passed. */
  function live(key: string): Bucket | undefined {
    const b = buckets.get(key)
    if (b && now() >= b.resetAt) {
      buckets.delete(key)
      return undefined
    }
    return b
  }

  function prune(): void {
    const t = now()
    for (const [k, b] of buckets) if (t >= b.resetAt) buckets.delete(k)
  }

  return {
    blocked(key) {
      const b = live(key)
      return b ? b.count >= max : false
    },
    hit(key) {
      if (buckets.size >= MAX_KEYS) prune()
      const b = live(key)
      if (!b) buckets.set(key, { count: 1, resetAt: now() + windowMs })
      else b.count += 1
    },
    reset(key) {
      buckets.delete(key)
    },
    retryAfterMs(key) {
      const b = live(key)
      return b ? Math.max(0, b.resetAt - now()) : 0
    },
  }
}
