import { expect, test, type Page } from "@playwright/test"

import { OWNER, TEAMMATE } from "./env"

/**
 * Auth happy paths against a seeded `backflip_test` database.
 * Covers L2-AUTH-16, L2-AUTH-17, L2-AUTH-13, L2-AUTH-24 and sign-out.
 */

async function login(page: Page, email: string, password: string) {
  await page.goto("/backflip/login")
  await page.getByLabel("Email").fill(email)
  await page.getByLabel("Password").fill(password)
  await page.getByRole("button", { name: "Sign in" }).click()
}

test("unauthenticated /backflip redirects to login with from param", async ({
  page,
}) => {
  await page.goto("/backflip")

  await expect(page).toHaveURL("/backflip/login?from=%2Fbackflip")
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible()
})

test("owner signs in with credentials and reaches the dashboard", async ({
  page,
}) => {
  await login(page, OWNER.email, OWNER.password)

  await expect(page).toHaveURL("/backflip")
  await expect(
    page.getByRole("heading", {
      name: `Welcome back, ${OWNER.name.split(" ")[0]}`,
    })
  ).toBeVisible()
})

test("wrong password shows an error and grants no session", async ({
  page,
}) => {
  await login(page, OWNER.email, "not-the-password")

  await expect(page.getByText("Invalid email or password.")).toBeVisible()
  await expect(page).toHaveURL(/\/backflip\/login/)

  // No session was issued: the protected area still bounces to login.
  await page.goto("/backflip")
  await expect(page).toHaveURL("/backflip/login?from=%2Fbackflip")
})

test("teammate is redirected away from /backflip/settings", async ({
  page,
}) => {
  await login(page, TEAMMATE.email, TEAMMATE.password)
  await expect(page).toHaveURL("/backflip")

  await page.goto("/backflip/settings")

  await expect(page).toHaveURL("/backflip")
  await expect(
    page.getByRole("heading", {
      name: `Welcome back, ${TEAMMATE.name.split(" ")[0]}`,
    })
  ).toBeVisible()
})

test("signed-in owner can sign out", async ({ page }) => {
  await login(page, OWNER.email, OWNER.password)
  await expect(page).toHaveURL("/backflip")

  await page.getByRole("button", { name: OWNER.name }).click()
  await page.getByRole("menuitem", { name: "Log out" }).click()

  await expect(page).toHaveURL(/\/backflip\/login/)

  await page.goto("/backflip")
  await expect(page).toHaveURL("/backflip/login?from=%2Fbackflip")
})
