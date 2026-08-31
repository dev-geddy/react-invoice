import path from "node:path"
import { fileURLToPath } from "node:url"

import { expect, test, type Page } from "@playwright/test"

import { OWNER } from "./env"

/**
 * Screenshot capture — separate Playwright project ("screenshots"), never part
 * of the default e2e run. Writes viewport-sized (1200×720) PNGs into the
 * gitignored `.screenshots/` at the repo root.
 *
 * @spec L2-TEST-09
 */

const SHOTS_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../.screenshots"
)

function shot(page: Page, name: string) {
  return page.screenshot({
    path: path.join(SHOTS_DIR, `${name}.png`),
    animations: "disabled",
  })
}

async function loginAsOwner(page: Page) {
  await page.goto("/backflip/login")
  await page.getByLabel("Email").fill(OWNER.email)
  await page.getByLabel("Password").fill(OWNER.password)
  await page.getByRole("button", { name: "Sign in" }).click()
  await expect(page).toHaveURL("/backflip")
}

test("public homepage", async ({ page }) => {
  await page.goto("/")
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible()

  await shot(page, "public-homepage")
})

test("admin home page", async ({ page }) => {
  await loginAsOwner(page)
  await expect(
    page.getByRole("heading", { name: /Welcome back/ })
  ).toBeVisible()

  await shot(page, "admin-home")
})

test("admin integrations page", async ({ page }) => {
  await loginAsOwner(page)
  await page.goto("/backflip/settings")
  await expect(page).toHaveURL("/backflip/settings")

  await shot(page, "admin-integrations")
})

test("admin members page", async ({ page }) => {
  await loginAsOwner(page)
  await page.goto("/backflip/users")
  await expect(page).toHaveURL("/backflip/users")

  await shot(page, "admin-users")
})

test("admin account page", async ({ page }) => {
  await loginAsOwner(page)
  await page.goto("/backflip/account")
  await expect(page).toHaveURL("/backflip/account")

  await shot(page, "admin-account")
})

test("admin docs page", async ({ page }) => {
  await loginAsOwner(page)
  await page.goto("/backflip/docs")
  await expect(page.getByRole("heading", { name: "Docs" })).toBeVisible()

  await shot(page, "admin-docs")

  // Cascade: an invariant narrows contracts, which narrows notes.
  await page
    .getByRole("button", { name: /L1-ARCH-05/ })
    .first()
    .click()
  await page
    .getByRole("button", { name: /L2-UI-01/ })
    .first()
    .click()

  await shot(page, "admin-docs-cascade")
})
