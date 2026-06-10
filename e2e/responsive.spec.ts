import { test, expect, type Page } from "@playwright/test"

import { customerCredentials, injectSession } from "./helpers/auth"

/**
 * Responsive, theme, and RTL polish E2E. These assert the guest-reachable
 * shell (homepage + login) holds up at the three reference viewports the polish
 * batch targets, that content does not overflow horizontally, that the theme
 * toggle round-trips in both directions, and that the Hebrew shell renders RTL
 * at every viewport. No credentials are needed, so the suite runs in CI without
 * seeded accounts.
 *
 * The authenticated block additionally guards the signed-in header: when signed
 * in the nav carries extra links (My Plan/Chat/Account, plus Clients/Admin for
 * a trainer) and a wider controls cluster. It must collapse into the hamburger
 * Sheet below the `md` breakpoint rather than overflow the 390px phone viewport.
 * It is skipped when customer credentials are not seeded, matching the rest of
 * the auth-dependent suite.
 */

/** The three reference widths the polish batch verifies: mobile, tablet, desktop. */
const VIEWPORTS = [
  { name: "mobile", width: 390, height: 844 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1280, height: 800 },
] as const

/** Guest-reachable pages that exercise the full localized shell. */
const GUEST_PAGES = [
  { name: "home", path: "/en" },
  { name: "login", path: "/en/login" },
] as const

/**
 * Asserts the document does not scroll horizontally: a reliable, viewport-aware
 * proxy for "nothing overflows its container". A 1px slack absorbs sub-pixel
 * rounding from zoom/DPI without masking real overflow.
 */
async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => {
    const el = document.documentElement
    return el.scrollWidth - el.clientWidth
  })
  expect(overflow).toBeLessThanOrEqual(1)
}

test.describe("responsive layouts", () => {
  for (const vp of VIEWPORTS) {
    for (const target of GUEST_PAGES) {
      test(`${target.name} has no horizontal overflow at ${vp.name} (${vp.width}px)`, async ({
        page,
      }) => {
        await page.setViewportSize({ width: vp.width, height: vp.height })
        await page.goto(target.path)
        // The header landmark is present on every shell page.
        await expect(page.getByRole("banner")).toBeVisible()
        await expectNoHorizontalOverflow(page)
      })
    }
  }

  test("the homepage hero and feature grid render at mobile width", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto("/en")
    // Exactly one top-level heading; the hero CTA is reachable.
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible()
    await expect(page.getByRole("main")).toBeVisible()
    await expectNoHorizontalOverflow(page)
  })
})

test.describe("authenticated header at mobile width", () => {
  test("an authenticated page has no horizontal overflow at 390px", async ({
    page,
    context,
  }) => {
    const { email, password } = customerCredentials
    test.skip(
      !email || !password,
      "E2E_CUSTOMER_EMAIL / E2E_CUSTOMER_PASSWORD not set"
    )
    await injectSession(context, email!, password!)
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto("/en/join")
    // The signed-in header (banner) is present, and the page does not scroll
    // sideways: the extra authenticated nav links collapse into the hamburger.
    await expect(page.getByRole("banner")).toBeVisible()
    await expectNoHorizontalOverflow(page)
  })
})

test.describe("theme contrast round-trip", () => {
  test("toggles dark and light on the homepage and persists", async ({
    page,
  }) => {
    await page.goto("/en")
    const html = page.locator("html")

    await page.getByRole("button", { name: /toggle theme/i }).click()
    await page.getByRole("menuitem", { name: /^dark$/i }).click()
    await expect(html).toHaveClass(/dark/, { timeout: 10_000 })

    await page.reload()
    await expect(html).toHaveClass(/dark/, { timeout: 10_000 })

    await page.getByRole("button", { name: /toggle theme/i }).click()
    await page.getByRole("menuitem", { name: /^light$/i }).click()
    await expect(html).not.toHaveClass(/dark/, { timeout: 10_000 })
  })
})

test.describe("Hebrew RTL across viewports", () => {
  for (const vp of VIEWPORTS) {
    test(`the Hebrew home is rtl at ${vp.name} (${vp.width}px)`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height })
      await page.goto("/he")
      const html = page.locator("html")
      await expect(html).toHaveAttribute("dir", "rtl")
      await expect(html).toHaveAttribute("lang", "he-IL")
      await expectNoHorizontalOverflow(page)
    })
  }

  test("the Hebrew login is rtl and free of overflow at mobile width", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto("/he/login")
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl")
    await expectNoHorizontalOverflow(page)
  })
})
