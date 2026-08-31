"use server"

import { revalidatePath } from "next/cache"

import { db, invoiceSeries, invoices } from "@workspace/db"
import { eq } from "drizzle-orm"

import { auth } from "@/app/_lib/auth"
import { canManageInvoiceSettings } from "@/app/_lib/auth/permissions"
import { firstError } from "@/app/_lib/validation"
import { invoiceSeriesSchema } from "../_lib/validation"

/**
 * Invoice series management — operator configuration (owner/admin), separate
 * from raising invoices, which every user may do.
 *
 * @spec L2-INVOICE-22, L2-INVOICE-23
 */

export type SeriesActionState = { ok: boolean; message: string }

function isUniqueViolation(e: unknown) {
  return (
    typeof e === "object" &&
    e !== null &&
    "code" in e &&
    (e as { code?: string }).code === "23505"
  )
}

const SETTINGS_PATH = "/backflip/invoices/settings"

/** Create a series, or update the one identified by `id`. */
export async function saveInvoiceSeries(input: {
  id?: string
  code: string
  brandName: string
  brandSubName: string
}): Promise<SeriesActionState> {
  const session = await auth()
  if (!session?.user || !canManageInvoiceSettings(session.user.role)) {
    return { ok: false, message: "Unauthorized" }
  }

  const parsed = invoiceSeriesSchema.safeParse(input)
  if (!parsed.success) return { ok: false, message: firstError(parsed.error) }
  const { id, code, brandName, brandSubName } = parsed.data

  try {
    if (id) {
      await db
        .update(invoiceSeries)
        .set({ code, brandName, brandSubName, updatedAt: new Date() })
        .where(eq(invoiceSeries.id, id))
    } else {
      await db.insert(invoiceSeries).values({ code, brandName, brandSubName })
    }
  } catch (e) {
    if (isUniqueViolation(e)) {
      return { ok: false, message: `Series "${code}" already exists.` }
    }
    throw e
  }

  revalidatePath(SETTINGS_PATH)
  revalidatePath("/backflip/invoices")
  return { ok: true, message: id ? "Series saved." : "Series added." }
}

/**
 * Delete a series. Refused while invoices still carry its code — those
 * invoices keep their own snapshot, but removing the definition would strand
 * the numbering they continue from.
 */
export async function deleteInvoiceSeries(
  id: string
): Promise<SeriesActionState> {
  const session = await auth()
  if (!session?.user || !canManageInvoiceSettings(session.user.role)) {
    return { ok: false, message: "Unauthorized" }
  }

  const [series] = await db
    .select({ code: invoiceSeries.code })
    .from(invoiceSeries)
    .where(eq(invoiceSeries.id, id))
  if (!series) return { ok: false, message: "Series not found." }

  const [inUse] = await db
    .select({ id: invoices.id })
    .from(invoices)
    .where(eq(invoices.series, series.code))
    .limit(1)
  if (inUse) {
    return {
      ok: false,
      message: `Invoices already use "${series.code}" — it can't be removed.`,
    }
  }

  await db.delete(invoiceSeries).where(eq(invoiceSeries.id, id))

  revalidatePath(SETTINGS_PATH)
  revalidatePath("/backflip/invoices")
  return { ok: true, message: "Series removed." }
}
