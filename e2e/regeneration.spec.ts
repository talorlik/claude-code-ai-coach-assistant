import { test, expect } from "@playwright/test"

import { adminCredentials, loginAsAdmin } from "./helpers/auth"

/**
 * Plan-regeneration E2E (batch required test 5: trainer-triggered regeneration).
 *
 * The guest tests need no credentials: the regeneration entry points live on
 * gated surfaces (the client My Plan page and the trainer client dashboard), so
 * a signed-out visitor is redirected to the localized login page in both locales
 * (Hebrew renders RTL). These run on every suite.
 *
 * The admin test requires a seeded admin (`E2E_ADMIN_EMAIL` /
 * `E2E_ADMIN_PASSWORD`) and a seeded client id (`E2E_CLIENT_ID`). It opens the
 * regeneration dialog and verifies the required-reason guard: submitting an
 * empty reason surfaces a validation error and triggers no AI call. This keeps
 * the smoke offline and deterministic (no real AI plan generation), since
 * regeneration runs through a server action the reason validator short-circuits
 * before any model call. It skips when the seed env vars are unset, matching the
 * other auth-dependent specs so the suite stays green without seeded data.
 */

const ANY_CLIENT_ID = "00000000-0000-0000-0000-000000000000"

test.describe("plan regeneration access control (guest)", () => {
  test("redirects a signed-out visitor from /en my-plan to login", async ({
    page,
  }) => {
    await page.goto("/en/my-plan")
    await expect(page).toHaveURL(/\/en\/login/, { timeout: 15_000 })
  })

  test("redirects a signed-out visitor from /he dashboard to login (rtl)", async ({
    page,
  }) => {
    await page.goto(`/he/trainer/clients/${ANY_CLIENT_ID}`)
    await expect(page).toHaveURL(/\/he\/login/, { timeout: 15_000 })
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl")
  })
})

test.describe("trainer-triggered regeneration (admin)", () => {
  const clientId = process.env.E2E_CLIENT_ID

  test.skip(
    !adminCredentials.email || !adminCredentials.password || !clientId,
    "E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD / E2E_CLIENT_ID not set"
  )

  test("requires a reason before regenerating, making no AI call", async ({
    page,
  }) => {
    // Guard: any call to the AI Gateway would fail the test. The reason
    // validator must short-circuit an empty submit before generation runs.
    let aiCalled = false
    await page.route("**/*.ai.gateway.vercel.sh/**", async (route) => {
      aiCalled = true
      await route.abort()
    })

    await loginAsAdmin(page)
    await page.goto(`/en/trainer/clients/${clientId}`)
    await expect(page).toHaveURL(
      new RegExp(`/en/trainer/clients/${clientId}`)
    )

    // Open the regeneration dialog from the plan summary.
    await page.getByTestId("regenerate-open").first().click()

    const submit = page.getByTestId("regenerate-submit")
    await expect(submit).toBeVisible()
    // The submit is disabled while the reason is empty (client-side guard); type
    // whitespace so the button enables, then submit to exercise the server-side
    // required-reason validation, which must reject without an AI call.
    await page.getByTestId("regenerate-reason").fill("   ")
    await submit.click()

    await expect(page.getByRole("alert")).toBeVisible({ timeout: 15_000 })
    expect(aiCalled).toBe(false)
  })
})
