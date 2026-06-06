import { type Page, expect } from "@playwright/test"

/**
 * Admin credentials, read from the environment so no secret is committed. The
 * admin test skips when unset. Use an account whose email is confirmed and that
 * has been promoted to admin (see the plan's admin-seed step).
 */
export const adminCredentials = {
  email: process.env.E2E_ADMIN_EMAIL,
  password: process.env.E2E_ADMIN_PASSWORD,
}

/**
 * A non-admin customer account, read from the environment. The customer test
 * skips when unset. Use an account whose email is already confirmed.
 */
export const customerCredentials = {
  email: process.env.E2E_CUSTOMER_EMAIL,
  password: process.env.E2E_CUSTOMER_PASSWORD,
}

/** Fills the sign-in form and submits it. */
async function signIn(
  page: Page,
  email: string,
  password: string
): Promise<void> {
  await page.goto("/login")
  await page.getByRole("tab", { name: /sign in/i }).click()
  await page.getByLabel(/email/i).fill(email)
  await page.getByLabel(/password/i).fill(password)
  await page.getByRole("button", { name: /^sign in$/i }).click()
}

/** Logs in as the admin and waits for the /admin redirect. */
export async function loginAsAdmin(page: Page): Promise<void> {
  const { email, password } = adminCredentials
  if (!email || !password) {
    throw new Error("E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD are required")
  }
  await signIn(page, email, password)
  await expect(page).toHaveURL(/\/admin/, { timeout: 15_000 })
}

/**
 * Logs in as the customer and waits for the post-auth landing. Since batch 21
 * the destination depends on onboarding/plan state: a fresh customer lands on
 * `/join`, an onboarded one with a plan on `/my-plan`. The helper only asserts
 * the sign-in left `/login`, so it stays valid across all client states.
 */
export async function loginAsCustomer(page: Page): Promise<void> {
  const { email, password } = customerCredentials
  if (!email || !password) {
    throw new Error("E2E_CUSTOMER_EMAIL / E2E_CUSTOMER_PASSWORD are required")
  }
  await signIn(page, email, password)
  await expect(page).not.toHaveURL(/\/login/, { timeout: 15_000 })
}
