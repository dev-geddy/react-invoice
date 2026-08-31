import { decryptSecret } from "@workspace/db"

const DOTS = "•".repeat(8)

/** Server-side secret masking for config previews. @spec L2-AI-06, L2-EMAIL-06 */

/**
 * Masked preview of a stored secret for display: first 3 + last 4 chars around
 * a fixed dot run (dot count fixed so the real length never leaks). Keys of 8
 * chars or fewer are fully masked. Never returns the plaintext.
 */
export function maskKey(plain: string): string {
  if (plain.length <= 8) return DOTS
  return `${plain.slice(0, 3)}${DOTS}${plain.slice(-4)}`
}

/** Decrypt an encrypted key column and return its masked preview, or null. */
export function keyPreview(
  apiKeyEnc: string | null | undefined
): string | null {
  if (!apiKeyEnc) return null
  return maskKey(decryptSecret(apiKeyEnc))
}
