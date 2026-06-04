import { test, expect, type Page } from "@playwright/test"

import { customerCredentials } from "./helpers/auth"

/**
 * My Plan E2E.
 *
 * The guest tests need no credentials: they assert that `/my-plan` is guarded
 * and redirects a signed-out visitor to the localized login page, in both
 * locales (and that Hebrew renders RTL).
 *
 * The full-flow tests require a confirmed customer account, supplied via
 * `E2E_CUSTOMER_EMAIL` / `E2E_CUSTOMER_PASSWORD`. They skip when those are unset
 * so the suite stays green in environments without seeded test users, matching
 * the existing auth-dependent specs. They view the plan and, when an active plan
 * exists, complete a workout.
 */

test.describe("my-plan access control", () => {
  test("redirects a signed-out visitor from /en/my-plan to login", async ({
    page,
  }) => {
    await page.goto("/en/my-plan")
    await expect(page).toHaveURL(/\/en\/login/, { timeout: 15_000 })
  })

  test("redirects a signed-out visitor from /he/my-plan to login (rtl)", async ({
    page,
  }) => {
    await page.goto("/he/my-plan")
    await expect(page).toHaveURL(/\/he\/login/, { timeout: 15_000 })
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl")
  })
})

/** Signs the customer in via the login form, then returns to the app root. */
async function signInCustomer(page: Page): Promise<void> {
  const { email, password } = customerCredentials
  await page.goto("/en/login")
  await page.getByRole("tab", { name: /sign in/i }).click()
  await page.getByLabel(/email/i).fill(email!)
  await page.getByLabel(/password/i).fill(password!)
  await page.getByRole("button", { name: /^sign in$/i }).click()
  await page.waitForURL(/\/(en|he)\//, { timeout: 15_000 })
}

test.describe("my-plan flow", () => {
  test.skip(
    !customerCredentials.email || !customerCredentials.password,
    "E2E_CUSTOMER_EMAIL / E2E_CUSTOMER_PASSWORD not set"
  )

  test.beforeEach(async ({ page }) => {
    await signInCustomer(page)
  })

  test("a client views the plan and can switch views", async ({ page }) => {
    await page.goto("/en/my-plan")
    await expect(page).toHaveURL(/\/en\/my-plan/)

    // Either the empty state (no active plan) or the plan view with tabs.
    const hasPlan = await page
      .getByRole("tab", { name: /list/i })
      .isVisible()
      .catch(() => false)

    if (!hasPlan) {
      await expect(page.getByText(/no active plan|onboarding/i)).toBeVisible()
      return
    }

    await page.getByRole("tab", { name: /list/i }).click()
    await page.getByRole("tab", { name: /calendar/i }).click()
  })

  test("a client completes a workout when an active plan exists", async ({
    page,
  }) => {
    await page.goto("/en/my-plan")

    const viewButton = page.getByRole("button", { name: /view workout/i }).first()
    const hasWorkout = await viewButton.isVisible().catch(() => false)
    test.skip(!hasWorkout, "No active plan with workouts for the test user")

    await viewButton.click()

    // The completion form lives in the detail dialog. If already completed for
    // today, the action button is absent; accept either terminal state.
    const complete = page.getByTestId("complete-workout")
    if (await complete.isVisible().catch(() => false)) {
      await complete.click()
      await expect(
        page.getByText(/already logged|done/i).first()
      ).toBeVisible({ timeout: 15_000 })
    } else {
      await expect(page.getByText(/already logged/i)).toBeVisible()
    }
  })
})
