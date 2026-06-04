import { test, expect } from "@playwright/test"

/**
 * Theme persistence E2E. next-themes stores the chosen mode in `localStorage`
 * and applies it as a class on `<html>`; this asserts the full round trip:
 * pick a non-default mode through the header toggle, reload, and confirm the
 * selection survives. Reachable as a guest, so no credentials are needed.
 */

test.describe("theme persistence", () => {
  test("keeps the selected theme across a refresh", async ({ page }) => {
    await page.goto("/en")

    const html = page.locator("html")

    // Open the icon-only toggle (accessible name comes from the ThemeToggle
    // namespace) and pick Dark explicitly so the assertion is deterministic
    // regardless of the system default.
    await page.getByRole("button", { name: /toggle theme/i }).click()
    await page.getByRole("menuitem", { name: /^dark$/i }).click()

    await expect(html).toHaveClass(/dark/, { timeout: 10_000 })

    await page.reload()
    await expect(html).toHaveClass(/dark/, { timeout: 10_000 })

    // Switch back to Light and confirm that choice also persists.
    await page.getByRole("button", { name: /toggle theme/i }).click()
    await page.getByRole("menuitem", { name: /^light$/i }).click()
    await expect(html).not.toHaveClass(/dark/, { timeout: 10_000 })

    await page.reload()
    await expect(html).not.toHaveClass(/dark/, { timeout: 10_000 })
  })

  test("renders the localized toggle in the Hebrew RTL shell", async ({
    page,
  }) => {
    await page.goto("/he")
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl")
    // The toggle's accessible label is localized; opening it shows the Hebrew
    // mode options.
    await page.getByRole("button", { name: /החלפת ערכת נושא/ }).click()
    await expect(page.getByRole("menuitem", { name: "כהה" })).toBeVisible()
  })
})
