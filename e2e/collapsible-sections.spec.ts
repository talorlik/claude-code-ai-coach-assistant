import { test, expect } from "@playwright/test"

import { adminCredentials, loginAsAdmin } from "./helpers/auth"

/**
 * Verifies the trainer client-detail collapsible sections: they start
 * collapsed, expand on click, and the open state survives a reload
 * (localStorage persistence). Requires a seeded admin and client id; skips
 * otherwise, matching the other auth-dependent specs.
 */
test.describe("trainer dashboard collapsible sections (admin)", () => {
  const clientId = process.env.E2E_CLIENT_ID

  test.skip(
    !adminCredentials.email || !adminCredentials.password || !clientId,
    "E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD / E2E_CLIENT_ID not set"
  )

  test("plan-detail section is collapsed by default, expands, and persists", async ({
    page,
  }) => {
    await loginAsAdmin(page)
    await page.goto(`/en/trainer/clients/${clientId}`)
    await expect(page).toHaveURL(new RegExp(`/en/trainer/clients/${clientId}`))

    const trigger = page.getByTestId("section-plan-detail")
    await expect(trigger).toBeVisible()

    // Collapsed by default: inner workout blocks are not rendered.
    await expect(trigger).toHaveAttribute("aria-expanded", "false")
    await expect(page.getByTestId("plan-detail-workout")).toHaveCount(0)

    // Expands on click.
    await trigger.click()
    await expect(trigger).toHaveAttribute("aria-expanded", "true")
    await expect(
      page.getByTestId("plan-detail-workout").first()
    ).toBeVisible({ timeout: 15_000 })

    // The open state survives a reload (localStorage persistence).
    await page.reload()
    const triggerAfter = page.getByTestId("section-plan-detail")
    await expect(triggerAfter).toHaveAttribute("aria-expanded", "true", {
      timeout: 15_000,
    })
  })
})
