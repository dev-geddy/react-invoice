"use server"

import { revalidatePath } from "next/cache"

import { customers, db } from "@workspace/db"
import { eq } from "drizzle-orm"

import { auth } from "@/app/_lib/auth"
import { canUseInvoices } from "@/app/_lib/auth/permissions"
import { firstError } from "@/app/_lib/validation"
import { customerSchema, type CustomerInput } from "../_lib/validation"

/**
 * The customer address book. Anyone who may raise invoices may keep it — it is
 * operational data, not platform configuration.
 *
 * @spec L2-INVOICE-29
 */

export type CustomerActionState = { ok: boolean; message: string }

const CUSTOMERS_PATH = "/backflip/invoicing/customers"

export async function saveCustomer(
  input: CustomerInput
): Promise<CustomerActionState> {
  const session = await auth()
  if (!session?.user || !canUseInvoices(session.user.role)) {
    return { ok: false, message: "Unauthorized" }
  }

  const parsed = customerSchema.safeParse(input)
  if (!parsed.success) return { ok: false, message: firstError(parsed.error) }
  const { id, ...fields } = parsed.data

  if (id) {
    await db
      .update(customers)
      .set({ ...fields, updatedAt: new Date() })
      .where(eq(customers.id, id))
  } else {
    await db.insert(customers).values(fields)
  }

  revalidatePath(CUSTOMERS_PATH)
  revalidatePath("/backflip/invoicing/invoices")
  return { ok: true, message: id ? "Customer saved." : "Customer added." }
}

/**
 * Remove a customer from the address book. Invoices already raised for them
 * are untouched — they carry their own copy of the details.
 */
export async function deleteCustomer(
  id: string
): Promise<CustomerActionState> {
  const session = await auth()
  if (!session?.user || !canUseInvoices(session.user.role)) {
    return { ok: false, message: "Unauthorized" }
  }

  await db.delete(customers).where(eq(customers.id, id))

  revalidatePath(CUSTOMERS_PATH)
  revalidatePath("/backflip/invoicing/invoices")
  return { ok: true, message: "Customer removed." }
}
