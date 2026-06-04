import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import enMessages from "../../messages/en-US.json"
import heMessages from "../../messages/he-IL.json"

/**
 * The homepage is an async server component. To render it in jsdom we stub the
 * two next-intl/server APIs it calls: `setRequestLocale` (a no-op outside a real
 * request) and `getTranslations`, which we back with the real catalogs so the
 * test asserts the exact shipped copy. `@/i18n/navigation`'s locale-aware `Link`
 * is replaced with a plain anchor that prefixes the active locale, so CTA hrefs
 * can be asserted to preserve the locale without a router.
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

import Page from "@/app/[locale]/page"

/**
 * Awaits the async server component and mounts its element so RTL queries can
 * run against the produced markup.
 */
async function renderHome(locale: "en" | "he") {
  activeLocale = locale
  const ui = await Page({ params: Promise.resolve({ locale }) })
  return render(ui)
}

describe("Homepage", () => {
  it("renders the English hero copy and CTAs from the Home namespace", async () => {
    await renderHome("en")
    expect(
      screen.getByRole("heading", { level: 1, name: enMessages.Home.title })
    ).toBeInTheDocument()
    expect(screen.getByText(enMessages.Home.description)).toBeInTheDocument()
    expect(
      screen.getByRole("link", { name: enMessages.Home.primaryCta })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("link", { name: enMessages.Home.secondaryCta })
    ).toBeInTheDocument()
  })

  it("renders the Hebrew hero copy from the Home namespace", async () => {
    await renderHome("he")
    expect(
      screen.getByRole("heading", { level: 1, name: heMessages.Home.title })
    ).toBeInTheDocument()
    expect(screen.getByText(heMessages.Home.description)).toBeInTheDocument()
    expect(
      screen.getByRole("link", { name: heMessages.Home.primaryCta })
    ).toBeInTheDocument()
  })

  it("renders all three localized feature steps", async () => {
    await renderHome("en")
    for (const key of [
      "feature1Title",
      "feature2Title",
      "feature3Title",
    ] as const) {
      expect(screen.getByText(enMessages.Home[key])).toBeInTheDocument()
    }
  })

  it("points the new-client CTA at the locale-prefixed register route", async () => {
    await renderHome("he")
    const cta = screen.getByRole("link", { name: heMessages.Home.primaryCta })
    expect(cta).toHaveAttribute("href", "/he/register")
  })

  it("points the secondary CTA at the locale-prefixed login route", async () => {
    await renderHome("en")
    const login = screen.getByRole("link", {
      name: enMessages.Home.secondaryCta,
    })
    expect(login).toHaveAttribute("href", "/en/login")
  })
})
