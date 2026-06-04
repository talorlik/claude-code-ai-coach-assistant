import { test, expect } from "@playwright/test"

/**
 * Homepage E2E. Guest-reachable smoke coverage for the localized landing page:
 * both locales render the hero, the new-client and login CTAs preserve the
 * active locale, and the localized document title is emitted from
 * `generateMetadata`.
 */

test.describe("homepage", () => {
  test("renders the English hero and locale-preserving CTAs", async ({
    page,
  }) => {
    await page.goto("/en")
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible()

    const newClient = page.getByRole("link", { name: /start as a new client/i })
    await expect(newClient).toHaveAttribute("href", /\/en\/register$/)

    const login = page.getByRole("link", { name: /already have an account/i })
    await expect(login).toHaveAttribute("href", /\/en\/login$/)
  })

  test("renders the Hebrew hero with rtl direction and locale CTAs", async ({
    page,
  }) => {
    await page.goto("/he")
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl")
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible()
    // Match the primary CTA by its locale-prefixed href, which is
    // language-independent (the visible label is Hebrew).
    await expect(
      page.locator('a[href$="/he/register"]')
    ).toBeVisible()
  })

  test("emits a localized document title", async ({ page }) => {
    await page.goto("/en")
    await expect(page).toHaveTitle(/Studio Itai/i)
  })

  test("the new-client CTA navigates to the locale register route", async ({
    page,
  }) => {
    await page.goto("/en")
    await page.getByRole("link", { name: /start as a new client/i }).click()
    // /register redirects to the sign-up tab of /login, preserving the locale.
    await expect(page).toHaveURL(/\/en\/login/, { timeout: 15_000 })
  })
})
