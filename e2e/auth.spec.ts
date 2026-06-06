import { test, expect } from "@playwright/test"

import {
  adminCredentials,
  customerCredentials,
  loginAsAdmin,
  loginAsCustomer,
} from "./helpers/auth"

/**
 * Auth E2E. Guest gating needs no credentials and always runs. The role-based
 * redirect and signout tests need confirmed accounts supplied via
 * E2E_ADMIN_EMAIL/PASSWORD and E2E_CUSTOMER_EMAIL/PASSWORD; they skip when
 * unset.
 */

test.describe("guest gating", () => {
  for (const path of ["/chat", "/profile", "/admin"]) {
    test(`redirects a signed-out visitor from ${path} to /login`, async ({
      page,
    }) => {
      await page.goto(path)
      await expect(page).toHaveURL(/\/login/, { timeout: 15_000 })
      await expect(page.getByText(/please sign in to continue/i)).toBeVisible()
    })
  }
})

test.describe("admin login", () => {
  test.skip(
    !adminCredentials.email || !adminCredentials.password,
    "set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD to run"
  )

  test("admin lands on /admin and can sign out", async ({ page }) => {
    await loginAsAdmin(page)
    // The admin landing dashboard renders its localized H1 (the "signed in as
    // an administrator" copy predates the localized dashboard and no longer
    // exists). Asserting the heading is copy- and locale-agnostic, matching the
    // other admin specs.
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible({
      timeout: 15_000,
    })

    await page.goto("/profile")
    await page.getByRole("button", { name: /sign out/i }).click()
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 })
  })
})

test.describe("customer login", () => {
  test.skip(
    !customerCredentials.email || !customerCredentials.password,
    "set E2E_CUSTOMER_EMAIL and E2E_CUSTOMER_PASSWORD to run"
  )

  test("customer lands on /profile and is blocked from /admin", async ({
    page,
  }) => {
    await loginAsCustomer(page)
    await page.goto("/admin")
    // Non-admins are redirected to home by the admin guard.
    await expect(page).not.toHaveURL(/\/admin/, { timeout: 15_000 })
  })
})
