# Contract (L2) — email

> L2 = contract / what. AI proposes, human approves. Cite ≥1 L1.
> Style: terse. One fact per line.

> **Implements L1:** `L1-ARCH-01`
> **Depends on L2:** `db` (`email_config`, crypto), `auth` (admin gate)

## Owns
Email sending configuration (Resend provider config under `/backflip/settings`, backed by `email_config`) **and** transactional sending: a server send layer + a shared GitHub-style react-email shell + per-event templates (welcome, password reset, password changed, email-change verification, email changed).

## Interfaces
- `L2-EMAIL-01` — Route `/backflip/settings` Email section — admin Resend config UI (flat form). (`apps/web/app/backflip/(protected)/settings/`)
- `L2-EMAIL-02` — Server action `saveEmailConfig(prev, formData)` — upserts the single `email_config` row; encrypts the key if supplied. Admin-gated. (`settings/_actions.ts`)
- `L2-EMAIL-03` — Config persisted in `email_config` (`L2-DB-18`). Key encrypted via `L2-DB-16`.
- `L2-EMAIL-11` — Send layer `sendWelcomeEmail({ to, name })` (`apps/web/app/_lib/email/send.tsx`) — reads the single `email_config` row, decrypts the key server-side (`L2-DB-16`), renders the template, sends via Resend. Returns `SendResult`: `{sent:true,id}` | `{sent:false,reason:"not_configured"}` | `{sent:false,reason:"error",message}`. Never throws. Consumed by `POST /api/backflip/users` (auth, `L2-AUTH-25`).
- `L2-EMAIL-12` — Shared shell `EmailShell` + `PrimaryButton`/`FallbackUrl` (`apps/web/app/_lib/email/layout.tsx`) — GitHub-style (neutral grays, system font, bordered white card, single green CTA), inline styles only, rendered to HTML server-side. All templates compose it.
- `L2-EMAIL-16` — Transactional templates + send functions (all soft-fail per `L2-EMAIL-13`): `sendWelcomeEmail` (new user), `sendPasswordResetEmail` (reset link), `sendPasswordChangedEmail` (security notice), `sendEmailChangeVerification` (confirm link → NEW address), `sendEmailChangedNotice` (heads-up → OLD address). Links use `appUrl()` base (`L2-EMAIL-14`). (`apps/web/app/_lib/email/*-email.tsx`, `send.tsx`)

## Schemas
- `L2-EMAIL-04` — Provider: `resend` (fixed, single row). Extensible later.
- `L2-EMAIL-05` — Fields (UI): `apiKey` (write-only), `fromEmail`, `fromName`, `replyTo`, `enabled`.
- `L2-EMAIL-14` — Deps: `resend` + `@react-email/components` (`web`). CTA base URL: `APP_URL ?? AUTH_URL ?? NEXTAUTH_URL ?? http://localhost:3070`.

## Invariants
- `L2-EMAIL-06` — Full API key never sent to the client. UI may show a masked preview (first 3 + last 4 chars around a fixed dot run; keys ≤8 chars fully masked) decrypted server-side. Stored encrypted (`L2-DB-16`), never plaintext.
- `L2-EMAIL-07` — Blank API-key field on save keeps the existing key (no overwrite).
- `L2-EMAIL-13` — Sending is optional infrastructure: when Resend is not usable (disabled, no key, or no `fromEmail`) the send layer returns `not_configured` — it never throws and never blocks the caller. Callers (e.g. `POST /api/backflip/users`) treat this as a non-fatal info state and still succeed.

## Errors
- `L2-EMAIL-08` — Unauthenticated `saveEmailConfig` → `{ ok: false, "Unauthorized" }`, no write.
- `L2-EMAIL-09` — Missing `ENCRYPTION_KEY` → encrypt/decrypt throws (`L2-DB-16`).

## Acceptance
- `L2-EMAIL-10` — Saving persists from/reply-to/enabled; key round-trips (encrypt→decrypt) and is masked in UI.
- `L2-EMAIL-15` — Adding a user with Resend configured+enabled sends a GitHub-style welcome email. With Resend unconfigured, user creation still succeeds and reports "email sending not configured" (`L2-EMAIL-13`).

## Constrained L3
- `/docs/notes/email.md`

---
IDs: `L2-EMAIL-<NN>`. Permanent, never renumber.
Change: propose diff + affected-L3 → stop → await human.
