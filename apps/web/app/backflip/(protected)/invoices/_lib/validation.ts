import { z } from "zod"

/**
 * Input schema for the invoice save action. The form is wide and free-text by
 * design (the reference app let operators type any currency symbol or unit), so
 * validation guards shape and bounds rather than dictating vocabulary.
 *
 * @spec L2-INVOICE-06
 */

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

const text = (max = 200) => z.string().max(max).trim()

/** A decimal as typed: blank reads as "0" so a half-filled row still saves. */
const decimal = (max: number) =>
  z
    .string()
    .trim()
    .transform((v) => (v === "" ? "0" : v))
    .refine((v) => /^-?\d+(\.\d+)?$/.test(v), "Enter a number.")
    .refine((v) => Math.abs(Number(v)) <= max, "Number is out of range.")

const isoDate = z
  .string()
  .refine((v) => ISO_DATE.test(v), "Enter a date as yyyy-mm-dd.")

const partySchema = z.object({
  companyName: text(),
  companyRegNo: text(60),
  companyVatNo: text(60),
  name: text(),
  role: text(),
  addressLine1: text(),
  addressLine2: text(),
  addressLine3: text(),
  addressLine4: text(),
  billingBankAccountIban: text(60),
  billingBankAccountBic: text(60),
  billingBankAccountNo: text(60),
  billingBankAccountSortCode: text(60),
})

const entrySchema = z.object({
  dateProvided: isoDate,
  description: text(500),
  qty: decimal(9_999_999),
  qtyType: text(20),
  rate: decimal(9_999_999),
  total: decimal(999_999_999),
})

export const invoiceDraftSchema = z.object({
  id: z.string().trim().optional(),
  meta: z.object({
    invoiceDate: isoDate,
    series: text(20),
    number: text(20),
    currency: text(8),
    vatRate: decimal(100),
    brandName: text(60),
    brandSubName: text(60),
  }),
  provider: partySchema,
  customer: partySchema,
  entries: z.array(entrySchema).max(200, "Too many lines on one invoice."),
})

export type InvoiceDraftInput = z.infer<typeof invoiceDraftSchema>
