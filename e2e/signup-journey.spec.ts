import { test, expect } from "@playwright/test"

import { customerCredentials } from "./helpers/auth"

/**
 * Post-auth routing E2E (batch 21). Verifies that after login a client lands on
 * the destination chosen by `resolvePostAuthDestination`, with the localized URL
 * preserved, in both `/en` and `/he`.
 *
 * These need a confirmed customer account via `E2E_CUSTOMER_EMAIL` /
 * `E2E_CUSTOMER_PASSWORD`, plus the account's onboarding/plan state seeded the
 * way the harness already seeds customer data. They skip when unset so the suite
 * stays green without seeded users, matching the existing auth-dependent specs.
 *
 * Set `E2E_CUSTOMER_ONBOARDED=1` when the seeded customer has an active plan
 * (expected landing `/my-plan`); leave it unset for a fresh, un-onboarded
 * customer (expected landing `/join`).
 */

const onboarded = process.env.E2E_CUSTOMER_ONBOARDED === "1"

/** Signs the customer in on the given locale's login form. */
async function signIn(page: import("@playwright/test").Page, locale: string) {
  const { email, password } = customerCredentials
  await page.goto(`/${locale}/login`)
  await page.getByRole("tab", { name: /sign in/i }).click()
  await page.getByLabel(/email/i).fill(email!)
  await page.getByLabel(/password/i).fill(password!)
  await page.getByRole("button", { name: /^sign in$/i }).click()
}

test.describe("post-auth routing", () => {
  test.skip(
    !customerCredentials.email || !customerCredentials.password,
    "set E2E_CUSTOMER_EMAIL and E2E_CUSTOMER_PASSWORD to run"
  )

  for (const locale of ["en", "he"]) {
    test(`a ${onboarded ? "plan-holding" : "fresh"} customer lands on the resolved page (${locale})`, async ({
      page,
    }) => {
      await signIn(page, locale)
      const expected = onboarded
        ? new RegExp(`/${locale}/my-plan`)
        : new RegExp(`/${locale}/join`)
      await expect(page).toHaveURL(expected, { timeout: 15_000 })
    })
  }

  test("a fresh customer's localized URL is preserved on /he (rtl)", async ({
    page,
  }) => {
    test.skip(onboarded, "only meaningful for an un-onboarded customer")
    await signIn(page, "he")
    await expect(page).toHaveURL(/\/he\/(join|my-plan)/, { timeout: 15_000 })
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl")
  })
})
