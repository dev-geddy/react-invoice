import { NextResponse } from "next/server"

import { auth } from "@/app/_lib/auth"
import { can } from "@/app/_lib/auth/permissions"
import { pdfFilename } from "@/app/backflip/(protected)/invoicing/_lib/calc"
import { renderInvoicePdf } from "@/app/backflip/(protected)/invoicing/_lib/pdf/invoice-document"
import { invoiceDraftSchema } from "@/app/backflip/(protected)/invoicing/_lib/validation"

// @react-pdf/renderer renders through fontkit — Node runtime, not edge.
export const runtime = "nodejs"

/**
 * POST /api/backflip/invoices/pdf — render the posted invoice to a PDF
 * download. The body is the draft as edited, not an id: what the operator sees
 * in the preview is what they get, so an unsaved edit downloads correctly
 * instead of silently exporting the stored version. Nothing is read or written
 * to the database here; the capability check is the whole authorisation, since
 * the caller is only ever handed back the document they submitted.
 *
 * Status codes: 200 pdf · 400 validation · 401 unauth · 403 forbidden.
 *
 * @spec L2-INVOICE-39
 */
export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 })
  }
  if (!can(session.user.role, "invoices")) {
    return NextResponse.json({ error: "Not permitted." }, { status: 403 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 })
  }

  const parsed = invoiceDraftSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid invoice." }, { status: 400 })
  }

  const draft = parsed.data
  const pdf = await renderInvoicePdf(draft)

  return new NextResponse(new Uint8Array(pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${pdfFilename(draft)}"`,
      "Cache-Control": "no-store",
    },
  })
}
