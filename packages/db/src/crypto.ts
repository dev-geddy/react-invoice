import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto"

/** @spec L2-DB-16, L2-DB-19 */

/**
 * Symmetric encryption for secrets at rest (e.g. AI provider API keys).
 * AES-256-GCM. The 32-byte key is derived (sha256) from `ENCRYPTION_KEY`
 * so any sufficiently-random env value works. Server-only.
 */
function key(): Buffer {
  const raw = process.env.ENCRYPTION_KEY
  if (!raw) throw new Error("ENCRYPTION_KEY is not set")
  return createHash("sha256").update(raw).digest()
}

/** Returns `base64(iv).base64(tag).base64(ciphertext)`. */
export function encryptSecret(plain: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", key(), iv)
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()])
  const tag = cipher.getAuthTag()
  return [iv, tag, ct].map((b) => b.toString("base64")).join(".")
}

export function decryptSecret(enc: string): string {
  const [ivB, tagB, ctB] = enc.split(".")
  if (!ivB || !tagB || !ctB) throw new Error("Malformed encrypted value")
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(ivB, "base64"))
  decipher.setAuthTag(Buffer.from(tagB, "base64"))
  return Buffer.concat([
    decipher.update(Buffer.from(ctB, "base64")),
    decipher.final(),
  ]).toString("utf8")
}

/**
 * A URL-safe, high-entropy token for one-time links (password reset, email
 * change). Return value is the RAW token — put it in the link, never store it.
 * Persist only `hashToken(raw)`.
 */
export function generateToken(): string {
  return randomBytes(32).toString("base64url")
}

/** SHA-256 (hex) of a raw token — what gets stored + looked up. */
export function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex")
}
