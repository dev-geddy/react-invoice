"use server"

import { revalidatePath } from "next/cache"

import { db, invoiceEntries, invoiceParties, invoices } from "@workspace/db"
import { eq } from "drizzle-orm"

import { auth } from "@/app/_lib/auth"
import { canManageInvoice, canUseInvoices } from "@/app/_lib/auth/permissions"
import { firstError } from "@/app/_lib/validation"
import { invoiceDraftSchema, type InvoiceDraftInput } from "../_lib/validation"

/**
 * Invoice write actions. Reading is shared platform-wide (every signed-in user
 * sees every invoice); writing is limited to the invoice's creator plus the
 * platform operators, and a locked invoice refuses edits until it is unlocked.
 *
 * @spec L2-INVOICE-05, L2-INVOICE-07
 */

/** Rejection carrying an operator-facing message out of a transaction. */
class ActionError extends Error {}

export type InvoiceActionState =
  | { ok: true; message: string; id: string }
  | { ok: false; message: string }

const LIST_PATH = "/backflip/invoicing/invoices"

/**
 * Create or update an invoice and its provider/customer/lines in one
 * transaction. Child rows are rewritten wholesale — the form owns the whole
 * document, so diffing individual lines would buy nothing but drift.
 */
export async function saveInvoice(
  input: InvoiceDraftInput
): Promise<InvoiceActionState> {
  const session = await auth()
  if (!session?.user || !canUseInvoices(session.user.role)) {
    return { ok: false, message: "Unauthorized" }
  }

  const parsed = invoiceDraftSchema.safeParse(input)
  if (!parsed.success) return { ok: false, message: firstError(parsed.error) }
  const { id, meta, provider, customer, entries } = parsed.data

  const row = {
    invoiceDate: meta.invoiceDate,
    series: meta.series,
    number: meta.number,
    currency: meta.currency,
    vatRate: meta.vatRate,
    brandName: meta.brandName,
    brandSubName: meta.brandSubName,
    updatedAt: new Date(),
  }

  let invoiceId: string
  try {
    invoiceId = await db.transaction(async (tx) => {
      let targetId = id

      if (targetId) {
        const [current] = await tx
          .select({ ownerId: invoices.ownerId, locked: invoices.locked })
          .from(invoices)
          .where(eq(invoices.id, targetId))
          .for("update")
        if (!current) throw new ActionError("Invoice not found.")
        if (!canManageInvoice(session.user.role, current.ownerId, session.user.id))
          throw new ActionError("This invoice belongs to someone else.")
        if (current.locked)
          throw new ActionError("Unlock the invoice before editing it.")

        await tx.update(invoices).set(row).where(eq(invoices.id, targetId))
        await tx
          .delete(invoiceParties)
          .where(eq(invoiceParties.invoiceId, targetId))
        await tx
          .delete(invoiceEntries)
          .where(eq(invoiceEntries.invoiceId, targetId))
      } else {
        const [created] = await tx
          .insert(invoices)
          .values({ ...row, ownerId: session.user.id })
          .returning({ id: invoices.id })
        targetId = created!.id
      }

      await tx.insert(invoiceParties).values([
        { invoiceId: targetId, kind: "provider" as const, ...provider },
        { invoiceId: targetId, kind: "customer" as const, ...customer },
      ])

      if (entries.length > 0) {
        await tx.insert(invoiceEntries).values(
          entries.map((entry, position) => ({
            invoiceId: targetId!,
            position,
            ...entry,
          }))
        )
      }

        return targetId
    })
  } catch (e) {
    if (e instanceof ActionError) return { ok: false, message: e.message }
    throw e
  }

  revalidatePath(LIST_PATH)
  return {
    ok: true,
    message: id ? "Invoice saved." : "Invoice created.",
    id: invoiceId,
  }
}

/**
 * Lock (freeze) or unlock an invoice. Locking is the reference app's "this one
 * has been issued" marker: while locked, `saveInvoice` and `deleteInvoice`
 * refuse to touch it.
 */
export async function setInvoiceLock(
  id: string,
  locked: boolean
): Promise<InvoiceActionState> {
  const session = await auth()
  if (!session?.user) return { ok: false, message: "Unauthorized" }

  const [current] = await db
    .select({ ownerId: invoices.ownerId })
    .from(invoices)
    .where(eq(invoices.id, id))
  if (!current) return { ok: false, message: "Invoice not found." }
  if (!canManageInvoice(session.user.role, current.ownerId, session.user.id)) {
    return { ok: false, message: "This invoice belongs to someone else." }
  }

  await db
    .update(invoices)
    .set({ locked, updatedAt: new Date() })
    .where(eq(invoices.id, id))

  revalidatePath(LIST_PATH)
  return { ok: true, message: locked ? "Invoice locked." : "Invoice unlocked.", id }
}

/** Delete an invoice and (by cascade) its parties and lines. */
export async function deleteInvoice(id: string): Promise<InvoiceActionState> {
  const session = await auth()
  if (!session?.user) return { ok: false, message: "Unauthorized" }

  const [current] = await db
    .select({ ownerId: invoices.ownerId, locked: invoices.locked })
    .from(invoices)
    .where(eq(invoices.id, id))
  if (!current) return { ok: false, message: "Invoice not found." }
  if (!canManageInvoice(session.user.role, current.ownerId, session.user.id)) {
    return { ok: false, message: "This invoice belongs to someone else." }
  }
  if (current.locked) {
    return { ok: false, message: "Unlock the invoice before deleting it." }
  }

  await db.delete(invoices).where(eq(invoices.id, id))

  revalidatePath(LIST_PATH)
  return { ok: true, message: "Invoice deleted.", id }
}
