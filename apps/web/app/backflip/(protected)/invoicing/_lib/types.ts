import type { Role } from "@/app/_lib/auth/permissions"

/**
 * Client-side shape of an invoice. Money and quantities travel as strings —
 * the db columns are `numeric` (exact decimal) and the form edits raw text, so
 * parsing happens only where arithmetic happens (`calc.ts`).
 *
 * @spec L2-INVOICE-01
 */

export type PartyKind = "provider" | "customer"

export type InvoiceParty = {
  companyName: string
  companyRegNo: string
  companyVatNo: string
  name: string
  role: string
  addressLine1: string
  addressLine2: string
  addressLine3: string
  addressLine4: string
  billingBankAccountIban: string
  billingBankAccountBic: string
  billingBankAccountNo: string
  billingBankAccountSortCode: string
}

export type InvoiceEntry = {
  /** ISO `yyyy-mm-dd`. */
  dateProvided: string
  description: string
  qty: string
  qtyType: string
  rate: string
  total: string
}

export type InvoiceMeta = {
  /** ISO `yyyy-mm-dd`. */
  invoiceDate: string
  series: string
  number: string
  currency: string
  vatRate: string
  brandName: string
  brandSubName: string
}

/** An invoice as edited in the form — no id until it is first saved. */
export type InvoiceDraft = {
  meta: InvoiceMeta
  provider: InvoiceParty
  customer: InvoiceParty
  entries: InvoiceEntry[]
}

/** A stored invoice, as listed and loaded by the admin surface. */
export type Invoice = InvoiceDraft & {
  id: string
  locked: boolean
  ownerId: string
  ownerName: string | null
  ownerEmail: string
  createdAt: string
  /** Whether the signed-in user may edit/lock/delete this one (L2-INVOICE-05). */
  canManage: boolean
}

export type InvoiceSession = {
  id: string
  role?: Role
}

export const EMPTY_PARTY: InvoiceParty = {
  companyName: "",
  companyRegNo: "",
  companyVatNo: "",
  name: "",
  role: "",
  addressLine1: "",
  addressLine2: "",
  addressLine3: "",
  addressLine4: "",
  billingBankAccountIban: "",
  billingBankAccountBic: "",
  billingBankAccountNo: "",
  billingBankAccountSortCode: "",
}

export const PARTY_FIELDS = Object.keys(EMPTY_PARTY) as (keyof InvoiceParty)[]

/** A series definition as offered to the invoice form. */
export type InvoiceSeriesOption = {
  code: string
  currency: string
  brandName: string
  brandSubName: string
}
