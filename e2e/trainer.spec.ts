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

test.describe("admin landing dashboard (admin)", () => {
  test.skip(
    !adminCredentials.email || !adminCredentials.password,
    "E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD not set"
  )

  test("an admin lands on /en/admin and can follow the trainer-area link", async ({
    page,
  }) => {
    await signIn(page, adminCredentials.email!, adminCredentials.password!)
    // resolvePostAuthDestination sends admins to the localized /admin dashboard.
    await page.goto("/en/admin")
    await expect(page).toHaveURL(/\/en\/admin/)
    await expect(
      page.getByRole("heading", { level: 1 })
    ).toBeVisible({ timeout: 15_000 })
    // The primary card links to the trainer area, staying in the same locale.
    const trainerLink = page.locator('a[href="/en/trainer"]').first()
    await expect(trainerLink).toBeVisible()
    await trainerLink.click()
    await expect(page).toHaveURL(/\/en\/trainer/, { timeout: 15_000 })
  })

  test("the admin dashboard renders RTL under /he/admin", async ({ page }) => {
    await signIn(page, adminCredentials.email!, adminCredentials.password!)
    await page.goto("/he/admin")
    await expect(page).toHaveURL(/\/he\/admin/)
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl")
    // The trainer-area link preserves the Hebrew locale.
    const trainerLink = page.locator('a[href="/he/trainer"]').first()
    await expect(trainerLink).toBeVisible({ timeout: 15_000 })
    await trainerLink.click()
    await expect(page).toHaveURL(/\/he\/trainer/, { timeout: 15_000 })
  })
})

test.describe("trainer dashboard hub navigation (admin)", () => {
  test.skip(
    !adminCredentials.email || !adminCredentials.password,
    "E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD not set"
  )

  for (const locale of ["en", "he"] as const) {
    test(`an admin navigates /admin -> /trainer -> /trainer/plans preserving the ${locale} locale`, async ({
      page,
    }) => {
      await signIn(page, adminCredentials.email!, adminCredentials.password!)

      // Hop 1: the admin dashboard's trainer-area card lands on /trainer.
      await page.goto(`/${locale}/admin`)
      await expect(page).toHaveURL(new RegExp(`/${locale}/admin`))
      const trainerLink = page.locator(`a[href="/${locale}/trainer"]`).first()
      await expect(trainerLink).toBeVisible({ timeout: 15_000 })
      await trainerLink.click()
      await expect(page).toHaveURL(new RegExp(`/${locale}/trainer(\\b|$)`), {
        timeout: 15_000,
      })

      // Hop 2: the trainer dashboard's plan-templates card lands on
      // /trainer/plans, keeping the active locale (no drop to the default).
      const plansLink = page
        .locator(`a[href="/${locale}/trainer/plans"]`)
        .first()
      await expect(plansLink).toBeVisible({ timeout: 15_000 })
      await plansLink.click()
      await expect(page).toHaveURL(new RegExp(`/${locale}/trainer/plans`), {
        timeout: 15_000,
      })
    })
  }
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
