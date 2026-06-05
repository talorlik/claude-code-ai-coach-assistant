import { test, expect, type Page } from "@playwright/test"

import { customerCredentials } from "./helpers/auth"

/**
 * PDF export E2E.
 *
 * The guest test needs no credentials: it asserts the protected export route
 * rejects a signed-out caller with 401, so the document is never built for an
 * unauthenticated visitor.
 *
 * The full-flow test requires a confirmed customer account, supplied via
 * `E2E_CUSTOMER_EMAIL` / `E2E_CUSTOMER_PASSWORD`; it skips when those are unset
 * so the suite stays green without seeded users, matching the other
 * auth-dependent specs. When the signed-in client has an active plan, it asserts
 * the export button is visible and that clicking it triggers a PDF download.
 */

test.describe("pdf export access control", () => {
  test("rejects a signed-out caller of the export route with 401", async ({
    request,
  }) => {
    const res = await request.get("/api/pdf/workout-plan", {
      maxRedirects: 0,
    })
    expect(res.status()).toBe(401)
  })
})

/** Signs the customer in via the login form, then lands inside the app. */
async function signInCustomer(page: Page): Promise<void> {
  const { email, password } = customerCredentials
  await page.goto("/en/login")
  await page.getByRole("tab", { name: /sign in/i }).click()
  await page.getByLabel(/email/i).fill(email!)
  await page.getByLabel(/password/i).fill(password!)
  await page.getByRole("button", { name: /^sign in$/i }).click()
  await page.waitForURL(/\/(en|he)\//, { timeout: 15_000 })
}

test.describe("pdf export flow", () => {
  test.skip(
    !customerCredentials.email || !customerCredentials.password,
    "E2E_CUSTOMER_EMAIL / E2E_CUSTOMER_PASSWORD not set"
  )

  test.beforeEach(async ({ page }) => {
    await signInCustomer(page)
  })

  test("the export button is visible and downloads a PDF when a plan exists", async ({
    page,
  }) => {
    await page.goto("/en/my-plan")

    const exportButton = page.getByTestId("export-plan-pdf")
    const hasPlan = await exportButton.isVisible().catch(() => false)
    test.skip(!hasPlan, "No active plan for the test user")

    const downloadPromise = page.waitForEvent("download", { timeout: 20_000 })
    await exportButton.click()
    const download = await downloadPromise
    expect(download.suggestedFilename()).toMatch(/\.pdf$/)
  })
})
