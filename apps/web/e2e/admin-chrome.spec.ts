import { expect, test, type Locator, type Page } from "@playwright/test"

import { OWNER } from "./env"

/**
 * Admin chrome — collapsed ("icon") sidebar rail.
 *
 * Regression guard: the header brand block and the footer user chip both put a
 * `flex-1` label next to their icon. `flex-1` keeps its intrinsic width, so in
 * the 3.5rem rail the label pushed the icon out of the button's overflow box
 * (measured x = -24px for the brand tile) — the mark simply vanished. Labels
 * must leave the flow when collapsed, icon centred inside the rail.
 */

async function loginAsOwner(page: Page) {
  await page.goto("/backflip/login")
  await page.getByLabel("Email").fill(OWNER.email)
  await page.getByLabel("Password").fill(OWNER.password)
  await page.getByRole("button", { name: "Sign in" }).click()
  await expect(page).toHaveURL("/backflip")
}

async function expectInsideRail(icon: Locator, rail: Locator) {
  const railBox = (await rail.boundingBox())!
  const iconBox = (await icon.boundingBox())!
  expect(iconBox.x).toBeGreaterThanOrEqual(railBox.x)
  expect(iconBox.x + iconBox.width).toBeLessThanOrEqual(
    railBox.x + railBox.width
  )
}

test("collapsed sidebar rail shows icons only", async ({ page }) => {
  await loginAsOwner(page)
  await page.getByRole("button", { name: /toggle sidebar/i }).click()

  const rail = page.locator('[data-slot="sidebar-container"]')
  // settled at --sidebar-width-icon (3.5rem), not mid-transition
  await expect
    .poll(async () => (await rail.boundingBox())!.width)
    .toBeLessThan(80)

  await expect(page.getByText("Admin console")).toBeHidden()
  await expectInsideRail(
    page.locator('[data-slot="sidebar-header"] a svg').first(),
    rail
  )
  await expectInsideRail(
    page.locator('[data-slot="sidebar-footer"] [data-slot="avatar"]').first(),
    rail
  )
})
