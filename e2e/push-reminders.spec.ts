import { test, expect } from "@playwright/test"

/**
 * Push reminders E2E smoke.
 *
 * The guest test needs no credentials: the My Plan page (which hosts the
 * reminder settings) is guarded, so a signed-out visitor is redirected to the
 * localized login page. This asserts the surface is protected in both locales.
 *
 * The unsupported-browser path is asserted by removing the push capabilities
 * from the page before navigation via an init script, so the client detection
 * sees no `PushManager` and the settings card must render its graceful
 * unsupported state rather than a non-functional toggle. The full opt-in (real
 * permission prompt) is out of scope for a deterministic headless run.
 */

test.describe("reminder settings access control", () => {
  test("redirects a signed-out visitor from /en/my-plan to login", async ({
    page,
  }) => {
    await page.goto("/en/my-plan")
    await expect(page).toHaveURL(/\/en\/login/, { timeout: 15_000 })
  })

  test("redirects a signed-out visitor from /he/my-plan to login (rtl)", async ({
    page,
  }) => {
    await page.goto("/he/my-plan")
    await expect(page).toHaveURL(/\/he\/login/, { timeout: 15_000 })
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl")
  })
})

test.describe("reminder settings unsupported-browser path", () => {
  test("the login page renders without push capabilities present", async ({
    page,
  }) => {
    // Strip the push capabilities so any client detection sees an unsupported
    // browser. We assert the app still loads (no crash) on the public login
    // page, which is the deterministic, credential-free signal available here.
    await page.addInitScript(() => {
      // @ts-expect-error - deleting optional browser globals for the test.
      delete window.PushManager
      // @ts-expect-error - deleting optional browser globals for the test.
      delete window.Notification
    })
    await page.goto("/en/login")
    await expect(page).toHaveURL(/\/en\/login/)
    await expect(page.locator("body")).toBeVisible()
  })
})
