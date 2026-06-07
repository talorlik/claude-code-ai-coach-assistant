import { test, expect, type Page } from "@playwright/test"

import { customerCredentials, injectSession } from "./helpers/auth"

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

/**
 * Signs the customer in by injecting a Supabase session (the login form is
 * captcha-blocked for headless browsers; see the auth helper). Leaves the
 * browser on the app with a valid session so `/join` is reachable.
 */
async function signInCustomer(page: Page): Promise<void> {
  const { email, password } = customerCredentials
  await injectSession(page.context(), email!, password!)
}

/**
 * The wizard's own "Next" control, scoped to the form region. Scoping avoids
 * matching the Next.js dev-tools overlay button (also named "Next"), which is
 * injected outside `<main>` during `next dev`.
 */
function nextButton(page: Page) {
  return page
    .getByRole("main")
    .getByRole("button", { name: /^(next|הבא)$/i })
}

/**
 * Fills step 1 with valid identity + age and advances. Clears each field first
 * so the helper is deterministic even when the seeded account already has saved
 * onboarding data that prefills the form.
 */
async function fillStep1(page: Page): Promise<void> {
  // Name allows letters/space/dot/hyphen only - no digits (matches NAME_RE).
  await page.locator('input[name="fullName"]').fill("Test Tester")
  // Phone is required and validated as E.164 (leading +country, non-zero).
  await page.locator('input[name="phone"]').fill("+972541234567")
  await page.locator('input[name="age"]').fill("30")
  await nextButton(page).click()
}

/**
 * Fills step 2 (goal popover + the two native selects) and advances. Ensures
 * "Build muscle" ends up selected regardless of the starting state: ticking an
 * already-selected goal would toggle it OFF, so the helper only ticks when the
 * trigger does not already show the goal. Robust to a seeded account that
 * carries a previously chosen goal.
 */
async function fillStep2(page: Page): Promise<void> {
  const goalTrigger = page.getByTestId("goal-trigger")
  const triggerText = (await goalTrigger.textContent()) ?? ""
  // Ticking an already-selected goal would toggle it OFF, so only open the
  // popover and select when the trigger does not already show the goal.
  if (!/build muscle|בניית שריר/i.test(triggerText)) {
    await goalTrigger.click()
    await page.getByText(/^(build muscle|בניית שריר)$/i).first().click()
    await page.keyboard.press("Escape")
  }

  await page
    .locator('select[name="fitnessLevel"]')
    .selectOption("intermediate")
  await page.locator('select[name="preferredLocation"]').selectOption("gym")
  await nextButton(page).click()
}

/**
 * Walks the three onboarding steps, saves the profile, then generates the plan.
 * `locale` selects the URL prefix; assertions key off locale-independent
 * controls and the localized save / generate button names and success status.
 */
async function completeOnboarding(
  page: Page,
  locale: "en" | "he",
  saveName: RegExp,
  generateName: RegExp,
  successText: RegExp
): Promise<void> {
  await page.goto(`/${locale}/join`)
  await expect(page).toHaveURL(new RegExp(`/${locale}/join`))

  await fillStep1(page)
  await fillStep2(page)

  // Step 3: pick at least one day, save the profile, then generate the plan.
  // Day options are checkbox-role rows; the first one (Mon/ב׳) is locale-agnostic
  // by position within the day group.
  await page
    .getByRole("group")
    .filter({ hasText: /train|להתאמן/i })
    .getByRole("checkbox")
    .first()
    .check()
  await page.getByRole("button", { name: saveName }).click()

  // The generate button unlocks only once the save completes.
  const generate = page.getByRole("button", { name: generateName })
  await expect(generate).toBeEnabled({ timeout: 15_000 })
  await generate.click()

  await expect(page.getByText(successText)).toBeVisible({ timeout: 30_000 })
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
      /save details/i,
      /create my workout plan/i,
      /you're all set/i
    )
  })

  test("a client completes onboarding in Hebrew", async ({ page }) => {
    await completeOnboarding(
      page,
      "he",
      /שמירת פרטים/,
      /צרו לי תוכנית אימונים/,
      /הכול מוכן/
    )
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl")
  })

  test("blocks advancing past step 1 when required fields are invalid", async ({
    page,
  }) => {
    await page.goto("/en/join")
    // Clear the required fields (the seeded account may prefill them), so the
    // step is genuinely invalid; clicking Next must not advance.
    await page.locator('input[name="fullName"]').fill("")
    await page.locator('input[name="phone"]').fill("")
    await page.locator('input[name="age"]').fill("")
    await page.locator('select[name="ageRange"]').selectOption("")
    await nextButton(page).click()
    await expect(page.getByText(/step 1 of 3/i)).toBeVisible()
    await expect(page.getByText(/enter your name/i)).toBeVisible()
    await expect(page.getByText(/enter your phone number/i)).toBeVisible()
  })

  test("advances step 2 to step 3 without bouncing back to step 1", async ({
    page,
  }) => {
    await page.goto("/en/join")
    await fillStep1(page)
    await expect(page.getByText(/step 2 of 3/i)).toBeVisible()
    await fillStep2(page)
    // The historic bug sent the user back to step 1 here; assert we are on 3.
    await expect(page.getByText(/step 3 of 3/i)).toBeVisible()
  })

  test("saves each step so a client can resume after leaving", async ({
    page,
  }) => {
    await page.goto("/en/join")
    await fillStep1(page)
    await expect(page.getByText(/step 2 of 3/i)).toBeVisible()

    // Re-open /join in a fresh navigation: the saved step-1 answers prefill.
    await page.goto("/en/join")
    await expect(page.locator('input[name="fullName"]')).toHaveValue(
      "Test Tester"
    )
    await expect(page.locator('input[name="phone"]')).toHaveValue(
      "+972541234567"
    )
    await expect(page.locator('input[name="age"]')).toHaveValue("30")
  })

  test("the onboarding form has no horizontal overflow at mobile width", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto("/en/join")
    await page.waitForSelector('input[name="fullName"]')
    // Scope to the form's main region: the age + age-range row collapses to a
    // single column below the sm breakpoint, so the form must not overflow its
    // own width. (The shared site header's mobile layout is tracked separately.)
    const overflow = await page.evaluate(() => {
      const main = document.querySelector("main")
      if (!main) return Number.NaN
      return main.scrollWidth - main.clientWidth
    })
    expect(overflow).toBeLessThanOrEqual(1)
  })
})
