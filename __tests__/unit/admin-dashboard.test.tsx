import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import enMessages from "../../messages/en-US.json"
import heMessages from "../../messages/he-IL.json"

/**
 * Behavior test for the admin landing dashboard (batch 22). The page is an async
 * server component, so its two next-intl/server seams are stubbed:
 * `setRequestLocale` (a no-op outside a real request) and `getTranslations`,
 * backed by the real catalogs so assertions run against the shipped copy. The
 * locale-aware `Link` from `@/i18n/navigation` is replaced with a plain anchor
 * that prefixes the active locale, so link hrefs can be asserted to carry the
 * active locale prefix without a router. The `/admin` layout's `requireAdmin()`
 * guard is out of scope here (covered by the role-gating regression test); this
 * suite asserts only the dashboard's localized content and locale-aware links.
 */
const catalogs = { en: enMessages, he: heMessages } as const
let activeLocale: "en" | "he" = "en"

vi.mock("next-intl/server", () => ({
  setRequestLocale: vi.fn(),
  getTranslations: async (namespace: string) => {
    const messages = catalogs[activeLocale] as unknown as Record<
      string,
      Record<string, string>
    >
    return (key: string) => messages[namespace][key]
  },
}))

vi.mock("@/i18n/navigation", () => ({
  Link: ({
    href,
    children,
    ...rest
  }: {
    href: string
    children: React.ReactNode
  } & React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={`/${activeLocale}${href}`} {...rest}>
      {children}
    </a>
  ),
}))

import AdminPage from "@/app/[locale]/admin/page"

/** Awaits the async server component and mounts its produced markup. */
async function renderAdmin(locale: "en" | "he") {
  activeLocale = locale
  const ui = await AdminPage({ params: Promise.resolve({ locale }) })
  return render(ui)
}

describe("Admin dashboard", () => {
  it("renders the localized English dashboard heading and intro", async () => {
    await renderAdmin("en")
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: enMessages.AdminDashboard.title,
      })
    ).toBeInTheDocument()
    expect(
      screen.getByText(enMessages.AdminDashboard.intro)
    ).toBeInTheDocument()
  })

  it("renders the localized Hebrew dashboard heading and intro", async () => {
    await renderAdmin("he")
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: heMessages.AdminDashboard.title,
      })
    ).toBeInTheDocument()
    expect(
      screen.getByText(heMessages.AdminDashboard.intro)
    ).toBeInTheDocument()
  })

  it("exposes a trainer-area link to /trainer in English", async () => {
    const { container } = await renderAdmin("en")
    // The card link's accessible name aggregates title + description + CTA, so
    // match on the href (the locale-aware contract under test) and assert the
    // card surfaces the localized trainer title.
    const link = container.querySelector('a[href="/en/trainer"]')
    expect(link).not.toBeNull()
    expect(link).toHaveTextContent(enMessages.AdminDashboard.trainerTitle)
  })

  it("preserves the active locale on the trainer-area link under /he", async () => {
    const { container } = await renderAdmin("he")
    const link = container.querySelector('a[href="/he/trainer"]')
    expect(link).not.toBeNull()
    expect(link).toHaveTextContent(heMessages.AdminDashboard.trainerTitle)
  })

  it("links to chat and account, all locale-prefixed", async () => {
    const { container } = await renderAdmin("en")
    expect(container.querySelector('a[href="/en/chat"]')).not.toBeNull()
    expect(container.querySelector('a[href="/en/profile"]')).not.toBeNull()
  })

  it("uses the locale-aware Link, never a raw external anchor", async () => {
    const { container } = await renderAdmin("en")
    // Every rendered link comes from the mocked locale-aware Link, so each href
    // carries the active-locale prefix. A raw `next/link` or `<a href>` without
    // the prefix would fail this invariant.
    const anchors = Array.from(container.querySelectorAll("a"))
    expect(anchors.length).toBeGreaterThan(0)
    for (const a of anchors) {
      expect(a.getAttribute("href")).toMatch(/^\/en\//)
    }
  })
})
