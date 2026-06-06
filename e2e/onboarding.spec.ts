import { test, expect, type Page } from "@playwright/test"

import { customerCredentials } from "./helpers/auth"

/**
 * Onboarding E2E.
 *
 * The guest tests need no credentials: they assert that `/join` is guarded and
 * redirects a signed-out visitor to the localized login page, in both locales.
 *
 * The full-flow tests (English and Hebrew) require a confirmed customer account,
 * supplied via `E2E_CUSTOMER_EMAIL` / `E2E_CUSTOMER_PASSWORD`. They skip when
 * those are unset so the suite stays green in environments without seeded test
 * users, matching the existing auth-dependent specs.
 */

test.describe("onboarding access control", () => {
  test("redirects a signed-out visitor from /en/join to login", async ({
    page,
  }) => {
    await page.goto("/en/join")
    await expect(page).toHaveURL(/\/en\/login/, { timeout: 15_000 })
  })

  test("redirects a signed-out visitor from /he/join to login (rtl)", async ({
    page,
  }) => {
    await page.goto("/he/join")
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

/**
 * Walks the three onboarding steps and submits. `locale` selects the URL
 * prefix; the assertions key off locale-independent controls (the progress bar,
 * the submit button by its enabled state) and the localized success status.
 */
async function completeOnboarding(
  page: Page,
  locale: "en" | "he",
  submitName: RegExp,
  successText: RegExp
): Promise<void> {
  await page.goto(`/${locale}/join`)
  await expect(page).toHaveURL(new RegExp(`/${locale}/join`))

  // Step 1: name + age.
  await page.getByRole("textbox").first().fill("E2E Tester")
  await page.locator('input[name="age"]').fill("30")
  await page.getByRole("button", { name: /next|הבא/i }).click()

  // Step 2: goal (multi-select popover), level + location (native selects).
  // Open the goal popover (trigger shows the "Select…" placeholder when empty).
  await page.getByRole("button", { name: /select|בחר/i }).first().click()
  // Tick a goal by its row checkbox, then close the popover.
  await page
    .getByRole("checkbox", { name: /build muscle|בניית שריר/i })
    .click()
  await page.keyboard.press("Escape")
  await page
    .locator('select[name="fitnessLevel"]')
    .selectOption("intermediate")
  await page.locator('select[name="preferredLocation"]').selectOption("gym")
  await page.getByRole("button", { name: /next|הבא/i }).click()

  // Step 3: pick at least one day, then submit.
  await page.getByText(/^(mon|ב׳)$/i).first().click()
  await page.getByRole("button", { name: submitName }).click()

  await expect(page.getByText(successText)).toBeVisible({ timeout: 15_000 })
}

test.describe("onboarding flow", () => {
  test.skip(
    !customerCredentials.email || !customerCredentials.password,
    "E2E_CUSTOMER_EMAIL / E2E_CUSTOMER_PASSWORD not set"
  )

  test.beforeEach(async ({ page }) => {
    await signInCustomer(page)
  })

  test("a client completes onboarding in English", async ({ page }) => {
    await completeOnboarding(
      page,
      "en",
      /create my workout plan/i,
      /you're all set/i
    )
  })

  test("a client completes onboarding in Hebrew", async ({ page }) => {
    await completeOnboarding(
      page,
      "he",
      /צרו לי תוכנית אימונים/,
      /הכול מוכן/
    )
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl")
  })
})
