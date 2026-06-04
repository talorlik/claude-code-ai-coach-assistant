import { test, expect, type Page } from "@playwright/test"

import { adminCredentials, customerCredentials } from "./helpers/auth"

/**
 * Trainer plan-template management E2E.
 *
 * The guest tests need no credentials: a signed-out visitor to `/trainer/plans`
 * is redirected to the localized login page by `requireTrainerAdmin`, in both
 * locales (Hebrew renders RTL).
 *
 * The admin and blocked-customer tests require seeded accounts via
 * `E2E_ADMIN_EMAIL` / `E2E_ADMIN_PASSWORD` and `E2E_CUSTOMER_EMAIL` /
 * `E2E_CUSTOMER_PASSWORD`. They skip when those are unset, matching the other
 * auth-dependent specs, so the suite stays green without seeded users.
 */

test.describe("trainer plans access control (guest)", () => {
  test("redirects a signed-out visitor from /en/trainer/plans to login", async ({
    page,
  }) => {
    await page.goto("/en/trainer/plans")
    await expect(page).toHaveURL(/\/en\/login/, { timeout: 15_000 })
  })

  test("redirects a signed-out visitor from /he/trainer/plans to login (rtl)", async ({
    page,
  }) => {
    await page.goto("/he/trainer/plans")
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

test.describe("trainer plans (admin)", () => {
  test.skip(
    !adminCredentials.email || !adminCredentials.password,
    "E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD not set"
  )

  test("an admin can open the plan templates library", async ({ page }) => {
    await signIn(page, adminCredentials.email!, adminCredentials.password!)
    await page.goto("/en/trainer/plans")
    await expect(page).toHaveURL(/\/en\/trainer\/plans/)
    // The page renders the localized heading whether the library is full or empty.
    await expect(
      page.getByRole("heading", { name: /plan templates/i })
    ).toBeVisible({ timeout: 15_000 })
    // The "new template" action is present for authoring.
    await expect(
      page.getByRole("button", { name: /new template/i })
    ).toBeVisible()
  })
})

test.describe("trainer plans (customer blocked)", () => {
  test.skip(
    !customerCredentials.email || !customerCredentials.password,
    "E2E_CUSTOMER_EMAIL / E2E_CUSTOMER_PASSWORD not set"
  )

  test("a non-admin client is redirected away from /en/trainer/plans", async ({
    page,
  }) => {
    await signIn(
      page,
      customerCredentials.email!,
      customerCredentials.password!
    )
    await page.goto("/en/trainer/plans")
    // requireTrainerAdmin sends non-admins to the localized home page.
    await expect(page).not.toHaveURL(/\/trainer\/plans/, { timeout: 15_000 })
  })
})
