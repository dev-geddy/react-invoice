import { expect, test, type Page } from "@playwright/test"

import { OWNER, TEAMMATE } from "./env"

/**
 * The shared invoice ledger: create, list, share across users, and the
 * ownership rule that keeps another user's invoice read-only.
 *
 * @spec L2-INVOICE-05, L2-INVOICE-08, L2-INVOICE-09
 */

async function login(page: Page, email: string, password: string) {
  await page.goto("/backflip/login")
  await page.getByLabel("Email").fill(email)
  await page.getByLabel("Password").fill(password)
  await page.getByRole("button", { name: "Sign in" }).click()
  await expect(page).toHaveURL("/backflip")
}

async function createInvoice(page: Page, series: string, number: string) {
  await page.goto("/backflip/invoices")

  await page.getByLabel("Company name").first().fill("Provider Co")
  await page.getByLabel("VAT reg. no.").first().fill("GB123456789")
  await page.getByLabel("Company name").last().fill("Customer Ltd")
  await page.getByLabel("Address line 1").last().fill("1 Test Street")

  await page.getByLabel("Description", { exact: true }).fill("Consulting")
  await page.getByLabel("Quantity").fill("2")
  await page.getByLabel("Rate", { exact: true }).fill("100")

  await page.getByLabel("Series", { exact: true }).fill(series)
  await page.getByLabel("Number", { exact: true }).fill(number)
  await page.getByLabel("VAT rate %").fill("21")

  await page.getByRole("button", { name: "Create invoice" }).click()
  await expect(page.getByText("Invoice created.")).toBeVisible()
}

test("owner creates an invoice and sees it totalled and listed", async ({
  page,
}) => {
  await login(page, OWNER.email, OWNER.password)
  await createInvoice(page, "INV", "0001")

  // 2 × 100 net, 21% VAT → 242.00 payable.
  await expect(page.getByText("242.00").first()).toBeVisible()
  await expect(
    page.getByRole("button", { name: /INV0001/ }).first()
  ).toBeVisible()
})

test("a teammate reads another user's invoice but cannot edit it", async ({
  page,
}) => {
  await login(page, OWNER.email, OWNER.password)
  await createInvoice(page, "SHARED", "0001")

  await page.goto("/backflip")
  await page.getByRole("button", { name: OWNER.name }).click()
  await page.getByRole("menuitem", { name: "Log out" }).click()
  await expect(page).toHaveURL(/\/backflip\/login/)

  await login(page, TEAMMATE.email, TEAMMATE.password)
  await page.goto("/backflip/invoices")

  // Shared ledger: the invoice another user created is listed…
  await page.getByRole("button", { name: /SHARED0001/ }).first().click()

  // …but it is read-only for a teammate who does not own it.
  await expect(
    page.getByText("This invoice belongs to another user")
  ).toBeVisible()
})

test("locking an invoice freezes the form until it is unlocked", async ({
  page,
}) => {
  await login(page, OWNER.email, OWNER.password)
  await createInvoice(page, "LOCK", "0001")

  await page.getByRole("button", { name: "Lock", exact: true }).click()
  await expect(page.getByText("Invoice locked.")).toBeVisible()
  await expect(page.getByText("This invoice is locked.")).toBeVisible()

  await page.getByRole("button", { name: "Unlock" }).click()
  await expect(page.getByText("Invoice unlocked.")).toBeVisible()
  await expect(page.getByLabel("Series", { exact: true })).toBeEnabled()
})
