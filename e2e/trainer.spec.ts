import { test, expect, type Page } from "@playwright/test"

import { adminCredentials, customerCredentials } from "./helpers/auth"

/**
 * Trainer client list E2E.
 *
 * The guest test needs no credentials: a signed-out visitor to `/trainer` is
 * redirected to the localized login page by `requireTrainerAdmin`, in both
 * locales (Hebrew renders RTL).
 *
 * The admin and blocked-customer tests require seeded accounts via
 * `E2E_ADMIN_EMAIL` / `E2E_ADMIN_PASSWORD` and `E2E_CUSTOMER_EMAIL` /
 * `E2E_CUSTOMER_PASSWORD`. They skip when those are unset, matching the other
 * auth-dependent specs, so the suite stays green without seeded users.
 */

test.describe("trainer list access control (guest)", () => {
  test("redirects a signed-out visitor from /en/trainer to login", async ({
    page,
  }) => {
    await page.goto("/en/trainer")
    await expect(page).toHaveURL(/\/en\/login/, { timeout: 15_000 })
  })

  test("redirects a signed-out visitor from /he/trainer to login (rtl)", async ({
    page,
  }) => {
    await page.goto("/he/trainer")
    await expect(page).toHaveURL(/\/he\/login/, { timeout: 15_000 })
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl")
  })
})

/** Signs a user in via the localized login form. */
async function signIn(
  page: Page,
  email: string,
  password: string
): Promise<void> {
  await page.goto("/en/login")
  await page.getByRole("tab", { name: /sign in/i }).click()
  await page.getByLabel(/email/i).fill(email)
  await page.getByLabel(/password/i).fill(password)
  await page.getByRole("button", { name: /^sign in$/i }).click()
  await page.waitForURL(/\/(en|he)\//, { timeout: 15_000 })
}

test.describe("trainer list (admin)", () => {
  test.skip(
    !adminCredentials.email || !adminCredentials.password,
    "E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD not set"
  )

  test("an admin can open the client list", async ({ page }) => {
    await signIn(page, adminCredentials.email!, adminCredentials.password!)
    await page.goto("/en/trainer")
    await expect(page).toHaveURL(/\/en\/trainer/)
    // The page renders the localized heading whether the list is full or empty.
    await expect(
      page.getByRole("heading", { name: /clients/i })
    ).toBeVisible({ timeout: 15_000 })
  })
})

test.describe("trainer list (customer blocked)", () => {
  test.skip(
    !customerCredentials.email || !customerCredentials.password,
    "E2E_CUSTOMER_EMAIL / E2E_CUSTOMER_PASSWORD not set"
  )

  test("a non-admin client is redirected away from /en/trainer", async ({
    page,
  }) => {
    await signIn(
      page,
      customerCredentials.email!,
      customerCredentials.password!
    )
    await page.goto("/en/trainer")
    // requireTrainerAdmin sends non-admins to the localized home page.
    await expect(page).not.toHaveURL(/\/trainer/, { timeout: 15_000 })
  })
})
