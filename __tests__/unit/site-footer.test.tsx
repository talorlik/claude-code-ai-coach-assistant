import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import enMessages from "../../messages/en-US.json"
import heMessages from "../../messages/he-IL.json"

/**
 * Behavior test for the SiteFooter (batch 27). The footer is an async server
 * component; its only seam is `getTranslations`, backed here by the real
 * catalogs so the test asserts the shipped copy, and the locale-aware `Link`,
 * replaced with a plain anchor that prefixes the active locale. The test
 * verifies the Home, About, and Contact links render with locale-preserving
 * hrefs in both `en` and `he`, and that the tagline renders.
 */
const catalogs = { en: enMessages, he: heMessages } as const
let activeLocale: "en" | "he" = "en"

vi.mock("next-intl/server", () => ({
  getTranslations: async (namespace: string) => {
    const messages = catalogs[activeLocale] as unknown as Record<
      string,
      Record<string, string>
    >
    return (key: string, values?: Record<string, unknown>) => {
      const raw = messages[namespace][key]
      if (!values) return raw
      return raw.replace(/\{(\w+)\}/g, (_, name) => String(values[name] ?? ""))
    }
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

import { SiteFooter } from "@/components/site-footer"

/** Awaits the async server component and mounts its produced markup. */
async function renderFooter(locale: "en" | "he") {
  activeLocale = locale
  const ui = await SiteFooter()
  return render(ui)
}

describe("SiteFooter", () => {
  it("renders Home, About, and Contact links with locale-preserving hrefs (en)", async () => {
    await renderFooter("en")
    // The mock anchor concatenates `/en` + the `/` root href, so the home link
    // resolves to the locale root. The locale prefix is what matters here.
    expect(
      screen.getByRole("link", { name: enMessages.Footer.home })
    ).toHaveAttribute("href", "/en/")
    expect(
      screen.getByRole("link", { name: enMessages.Footer.about })
    ).toHaveAttribute("href", "/en/about")
    expect(
      screen.getByRole("link", { name: enMessages.Footer.contact })
    ).toHaveAttribute("href", "/en/contact")
  })

  it("preserves the Hebrew locale in footer hrefs (he)", async () => {
    await renderFooter("he")
    expect(
      screen.getByRole("link", { name: heMessages.Footer.about })
    ).toHaveAttribute("href", "/he/about")
    expect(
      screen.getByRole("link", { name: heMessages.Footer.contact })
    ).toHaveAttribute("href", "/he/contact")
  })

  it("renders the localized tagline", async () => {
    await renderFooter("en")
    expect(screen.getByText(enMessages.Footer.tagline)).toBeInTheDocument()
  })
})
