import { test, expect, type Page } from "@playwright/test"

import { customerCredentials, injectSession } from "./helpers/auth"

/**
 * Phone country-code selector E2E.
 *
 * Exercises the searchable country combobox on onboarding step 1 (`/en/join`):
 * the user opens the popover, searches the country list on three independent
 * axes (dial code, ISO2, English name), selects a country, and types a national
 * number. The test asserts the selection propagated to the trigger (dial code +
 * country name) and that the national input holds the typed value.
 *
 * Auth reuses the project's `injectSession` helper: the Supabase login form is
 * Turnstile-blocked for headless browsers, so a session is minted via the
 * secret-key grant and its cookies injected into the browser context. The test
 * skips when the customer credentials are unset, matching the other
 * auth-dependent specs.
 *
 * Persistence (recombination into E.164 and round-tripping through save/reload)
 * is covered by the integration tests for the phone field and profile actions,
 * so this spec stays focused on the interactive search + select behavior.
 */

/**
 * The country combobox trigger. It is the popover trigger button whose
 * accessible name is the localized dial code + country name (e.g. "+972
 * Israel"); matching on a dial code keeps the locator robust against the
 * surrounding markup.
 */
function countryTrigger(page: Page) {
  return page.getByRole("button", { name: /\+\d/ })
}

/** The cmdk search box inside the open popover, found by its placeholder. */
function countrySearch(page: Page) {
  return page.getByPlaceholder("Search country or code…")
}

/**
 * Clears the search box and types a fresh query. cmdk filters live, so a clear
 * is required between axes or the previous query keeps narrowing the list.
 */
async function search(page: Page, value: string): Promise<void> {
  const box = countrySearch(page)
  await box.fill("")
  await box.fill(value)
}

test.describe("phone country selector", () => {
  test.skip(
    !customerCredentials.email || !customerCredentials.password,
    "E2E_CUSTOMER_EMAIL / E2E_CUSTOMER_PASSWORD not set"
  )

  test.beforeEach(async ({ page }) => {
    const { email, password } = customerCredentials
    await injectSession(page.context(), email!, password!)
    await page.goto("/en/join")
    await expect(page).toHaveURL(/\/en\/join/, { timeout: 15_000 })
    // Step 1 carries the phone field; wait for it before interacting.
    await page.waitForSelector('input[name="fullName"]')
  })

  test("searches the country list by code, ISO2, and name then selects", async ({
    page,
  }) => {
    // Open the combobox.
    await countryTrigger(page).click()
    await expect(countrySearch(page)).toBeVisible()

    const israelOption = page.getByRole("option", { name: /israel/i })

    // Axis 1: dial code.
    await search(page, "972")
    await expect(israelOption).toBeVisible()

    // Axis 2: ISO2.
    await search(page, "IL")
    await expect(israelOption).toBeVisible()

    // Axis 3: English name, then select.
    await search(page, "Isr")
    await expect(israelOption).toBeVisible()
    await israelOption.click()

    // The popover closes and the trigger reflects the selection.
    await expect(countrySearch(page)).toBeHidden()
    const trigger = countryTrigger(page)
    await expect(trigger).toContainText("+972")
    await expect(trigger).toContainText(/israel/i)

    // The national-number input accepts a number and holds it.
    const national = page.locator('input[name="phone-national"]')
    await national.fill("541234567")
    await expect(national).toHaveValue("541234567")
  })
})
