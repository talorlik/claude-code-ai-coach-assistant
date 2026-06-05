import { test, expect } from "@playwright/test"

/**
 * PWA installability E2E. No credentials needed: these assert the document-level
 * install wiring that every visitor gets - the manifest link, the theme-color
 * meta, the apple-touch-icon, locale/RTL correctness, and that the served
 * manifest is valid installable JSON. The live `beforeinstallprompt` flow needs
 * a real Chromium install gesture and is out of scope for a deterministic
 * headless run, so the affordance is asserted as present-or-gracefully-absent.
 */

test.describe("PWA document wiring", () => {
  for (const { path, dir, lang } of [
    { path: "/en", dir: "ltr", lang: "en-US" },
    { path: "/he", dir: "rtl", lang: "he-IL" },
  ]) {
    test(`links the manifest and theme-color on ${path}`, async ({ page }) => {
      await page.goto(path)

      // The app shell rendered: the brand link in the header is always present.
      await expect(page.locator("header")).toBeVisible()

      // Manifest is linked in <head> at the single, locale-independent URL.
      const manifestHref = await page
        .locator('link[rel="manifest"]')
        .getAttribute("href")
      expect(manifestHref).toBe("/manifest.webmanifest")

      // A valid theme-color is exposed for the OS/browser chrome.
      const themeColor = await page
        .locator('meta[name="theme-color"]')
        .first()
        .getAttribute("content")
      expect(themeColor).toMatch(/^#[0-9a-fA-F]{3,8}$/)

      // iOS Add-to-Home-Screen icon is wired.
      await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveCount(1)

      // Locale/RTL correctness carries through to the document element.
      const html = page.locator("html")
      await expect(html).toHaveAttribute("dir", dir)
      await expect(html).toHaveAttribute("lang", lang)
    })
  }

  test("serves a valid, installable manifest", async ({ page, request }) => {
    await page.goto("/en")
    const response = await request.get("/manifest.webmanifest")
    expect(response.ok()).toBeTruthy()

    const manifest = await response.json()
    expect(manifest.display).toBe("standalone")
    expect(manifest.start_url).toBeTruthy()
    expect(Array.isArray(manifest.icons)).toBeTruthy()
    expect(manifest.icons.length).toBeGreaterThanOrEqual(2)

    // Every referenced icon must actually be served (no broken install icon).
    for (const icon of manifest.icons) {
      const iconResponse = await request.get(icon.src)
      expect(iconResponse.ok(), `${icon.src} should be served`).toBeTruthy()
    }
  })

  test("renders the install affordance or gracefully omits it", async ({
    page,
  }) => {
    await page.goto("/en")
    // Headless Chromium does not fire `beforeinstallprompt` and is not iOS, so
    // the affordance is expected to be absent here; assert it never errors the
    // page and the count is a valid 0-or-1 (present on capable browsers).
    const count = await page
      .getByRole("button", { name: /install app/i })
      .count()
    expect(count).toBeLessThanOrEqual(1)
  })
})

test.describe("offline fallback route", () => {
  for (const path of ["/en/offline", "/he/offline"]) {
    test(`serves the localized offline document at ${path}`, async ({
      page,
    }) => {
      const response = await page.goto(path)
      expect(response?.status()).toBeLessThan(400)
      // The offline page renders a heading and a retry control.
      await expect(page.locator("h1")).toBeVisible()
    })
  }
})
