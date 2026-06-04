import { test, expect } from "@playwright/test"

import { adminCredentials, loginAsAdmin } from "./helpers/auth"

/**
 * Trainer client dashboard E2E.
 *
 * The guest tests need no credentials: a signed-out visitor to a dashboard URL
 * is redirected to the localized login page by `requireTrainerAdmin`, in both
 * locales (Hebrew renders RTL). These run on every suite.
 *
 * The admin "open dashboard and add a note" test requires a seeded admin
 * (`E2E_ADMIN_EMAIL` / `E2E_ADMIN_PASSWORD`) and a seeded client id
 * (`E2E_CLIENT_ID`) whose dashboard is reachable. It skips when those are unset,
 * matching the other auth-dependent specs, so the suite stays green without
 * seeded data.
 */

const ANY_CLIENT_ID = "00000000-0000-0000-0000-000000000000"

test.describe("trainer dashboard access control (guest)", () => {
  test("redirects a signed-out visitor from /en dashboard to login", async ({
    page,
  }) => {
    await page.goto(`/en/trainer/clients/${ANY_CLIENT_ID}`)
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

test.describe("trainer dashboard (admin)", () => {
  const clientId = process.env.E2E_CLIENT_ID

  test.skip(
    !adminCredentials.email || !adminCredentials.password || !clientId,
    "E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD / E2E_CLIENT_ID not set"
  )

  test("an admin can open a client dashboard and add a private note", async ({
    page,
  }) => {
    await loginAsAdmin(page)
    await page.goto(`/en/trainer/clients/${clientId}`)
    await expect(page).toHaveURL(
      new RegExp(`/en/trainer/clients/${clientId}`)
    )

    // The private-notes panel is present.
    const noteText = `e2e note ${Date.now()}`
    const textarea = page.getByPlaceholder(/add a private note/i)
    await expect(textarea).toBeVisible()

    await textarea.fill(noteText)
    await page.getByRole("button", { name: /^add note$/i }).click()

    // The new note appears in the list.
    await expect(page.getByText(noteText)).toBeVisible({ timeout: 15_000 })

    // Clean up: delete the note we just added.
    const noteItem = page
      .locator("li", { hasText: noteText })
      .first()
    await noteItem.getByRole("button", { name: /delete/i }).click()
    await expect(page.getByText(noteText)).toHaveCount(0, { timeout: 15_000 })
  })
})
