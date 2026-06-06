import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import enMessages from "../../messages/en-US.json"
import heMessages from "../../messages/he-IL.json"

/**
 * Behavior test for the trainer dashboard (batch 23). The page is an async server
 * component, so its next-intl/server seams are stubbed: `setRequestLocale` (a
 * no-op outside a real request), `getTranslations` (backed by the real catalogs
 * so assertions run against the shipped copy), and `getFormatter` (awaited before
 * the data load). The locale-aware `Link` from `@/i18n/navigation` is replaced
 * with a plain anchor that prefixes the active locale, so link hrefs can be
 * asserted to carry the active locale prefix without a router.
 *
 * The auth guard `requireTrainerAdmin` is stubbed to resolve (role-gating is
 * covered by the e2e spec and the require-admin unit test); the client-list data
 * source returns an empty list so the test focuses on the dashboard chrome - the
 * header, the navigation cards, and the back-to-admin link - which renders
 * identically regardless of whether clients exist.
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
  getFormatter: async () => ({
    dateTime: () => "",
  }),
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

vi.mock("@/lib/auth/require-user", () => ({
  requireTrainerAdmin: vi.fn(async () => "admin-user-id"),
}))

const listClientsWithActivity = vi.fn(async () => [])
vi.mock("@/lib/db/trainer-clients", () => ({
  listClientsWithActivity: () => listClientsWithActivity(),
}))

import TrainerPage from "@/app/[locale]/trainer/page"

/** Awaits the async server component and mounts its produced markup. */
async function renderTrainer(locale: "en" | "he") {
  activeLocale = locale
  const ui = await TrainerPage({ params: Promise.resolve({ locale }) })
  return render(ui)
}

describe("Trainer dashboard", () => {
  beforeEach(() => {
    listClientsWithActivity.mockResolvedValue([])
  })

  it("renders the localized English dashboard heading and subtitle", async () => {
    await renderTrainer("en")
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: enMessages.TrainerHub.title,
      })
    ).toBeInTheDocument()
    expect(
      screen.getByText(enMessages.TrainerHub.subtitle)
    ).toBeInTheDocument()
  })

  it("renders the localized Hebrew dashboard heading and subtitle", async () => {
    await renderTrainer("he")
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: heMessages.TrainerHub.title,
      })
    ).toBeInTheDocument()
    expect(
      screen.getByText(heMessages.TrainerHub.subtitle)
    ).toBeInTheDocument()
  })

  it("exposes the client-list, plan-templates, and back-to-admin links under /en", async () => {
    const { container } = await renderTrainer("en")
    // Client list overview: the nav card anchors to this page's list section.
    expect(
      container.querySelector('a[href="/en/trainer#trainer-clients"]')
    ).not.toBeNull()
    // Plan-template manager.
    expect(
      container.querySelector('a[href="/en/trainer/plans"]')
    ).not.toBeNull()
    // Back to the admin dashboard.
    expect(container.querySelector('a[href="/en/admin"]')).not.toBeNull()
  })

  it("preserves the active locale on every dashboard link under /he", async () => {
    const { container } = await renderTrainer("he")
    expect(
      container.querySelector('a[href="/he/trainer#trainer-clients"]')
    ).not.toBeNull()
    expect(
      container.querySelector('a[href="/he/trainer/plans"]')
    ).not.toBeNull()
    expect(container.querySelector('a[href="/he/admin"]')).not.toBeNull()
  })

  it("uses the locale-aware Link, never a raw anchor without the locale prefix", async () => {
    const { container } = await renderTrainer("en")
    // Every rendered link comes from the mocked locale-aware Link, so each href
    // carries the active-locale prefix. A raw `next/link` or `<a href>` without
    // the prefix would fail this invariant.
    const anchors = Array.from(container.querySelectorAll("a"))
    expect(anchors.length).toBeGreaterThan(0)
    for (const a of anchors) {
      expect(a.getAttribute("href")).toMatch(/^\/en(\/|$)/)
    }
  })
})
