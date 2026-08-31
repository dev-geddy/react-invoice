# Notes (L3) — email

> L3 = how / volatile. AI writes free. Cites L2 IDs up. Matches code as-is.

## File map
- `apps/web/app/backflip/(protected)/settings/page.tsx` — server; loads single `email_config` row (provider `resend`), maps to view model (no key decryption; `hasKey` boolean). Satisfies `L2-EMAIL-01`.
- `settings/_components/email-section.tsx` — client; toggles **summary** (configured/enabled `Badge`, masked key preview + from/reply rows, or "Not configured" + "Edit settings") and **edit** view (`EmailConfigForm` + explanation column). `onSaved`/`onCancel` return to summary on save.
- `settings/_components/email-config-form.tsx` — client; flat form; `useActionState(saveEmailConfig)`. Fields: API key (password, write-only, masked preview in placeholder), fromEmail, fromName, replyTo (`Input`), enabled (`Switch`).
- `settings/_lib/mask.ts` — shared with `ai`; `keyPreview` decrypts + masks the stored key (`L2-DB-16`). Satisfies `L2-EMAIL-06`.
- `settings/_actions.ts` — `saveEmailConfig` (`"use server"`): auth-gate → upsert on `provider` → encrypt key if provided → `revalidatePath`. Satisfies `L2-EMAIL-02`, `L2-EMAIL-06/07`.
- `packages/db` — `email_config` table + `encryptSecret`/`decryptSecret` (`L2-DB-16/18`).
- `apps/web/app/_lib/email/send.tsx` — send layer. Private `send(build)` core: reads single `email_config` row → soft-skip when disabled/keyless/no fromEmail → decrypt key (`L2-DB-16`) → `render(react)` → `resend.emails.send({html})`. Returns `SendResult` (`{sent:true,id}` | `{sent:false,reason:"not_configured"}` | `{sent:false,reason:"error"}`); never throws. Public: `sendWelcomeEmail`, `sendPasswordResetEmail`, `sendPasswordChangedEmail`, `sendEmailChangeVerification`, `sendEmailChangedNotice`, plus `appUrl()` (link base). Satisfies `L2-EMAIL-11`, `L2-EMAIL-13`, `L2-EMAIL-16`.
- `apps/web/app/_lib/email/layout.tsx` — shared GitHub-style shell: `EmailShell` (Html/Head/Preview/card/header/footer), `PrimaryButton` (green CTA), `FallbackUrl`, + exported text/link styles. Inline styles only. All templates compose it. Satisfies `L2-EMAIL-12`.
- `apps/web/app/_lib/email/*-email.tsx` — react-email templates: `welcome-email` (new user → login), `password-reset-email` (reset link), `password-changed-email` (security notice), `email-change-verify-email` (confirm link → NEW address), `email-changed-email` (heads-up → OLD address). Satisfies `L2-EMAIL-12`, `L2-EMAIL-16`.
- **Consumers:** `POST /api/backflip/users` → welcome (see [[auth]]); account actions `changePassword`/`requestEmailChange`/`confirmEmailChange` → password-changed / verify / email-changed; `(auth)` actions `requestPasswordReset`/`resetPassword` → reset / password-changed. All best-effort.

## App URL
- CTA link base = `APP_URL ?? AUTH_URL ?? NEXTAUTH_URL ?? http://localhost:3070`, `+ /backflip/login`.

## State
- Sending lands: `resend@6` + `@react-email/components@1` installed in `web`.
- Five transactional emails: welcome, password-reset, password-changed, email-change-verify, email-changed. All share `layout.tsx` (GitHub style).
- Not-configured is non-fatal everywhere EXCEPT it blocks the two flows that *require* delivery to function: `requestEmailChange` and (implicitly) password reset — those surface a "configure email first" message. (`L2-EMAIL-13`)
- Config still admin-managed in Settings → Email.
- Verified: typecheck + lint clean; full build passes; all 5 templates render (previewed).

## TODO
- "Send test email" action — deferred.
- `react-email` preview/dev tooling — not wired; templates are code-only (rendered ad hoc for review).
