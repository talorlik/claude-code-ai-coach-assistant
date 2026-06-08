import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import enMessages from "../../messages/en-US.json"

let activeLocale = "en"

vi.mock("next-intl", () => ({
  useLocale: () => activeLocale,
  useTranslations: (namespace: string) => {
    const messages = enMessages as unknown as Record<
      string,
      Record<string, string>
    >
    return (key: string) => messages[namespace][key]
  },
}))

vi.mock("@/i18n/navigation", () => ({
  Link: ({
    href,
    locale,
    children,
    ...rest
  }: {
    href: string
    locale?: string
    children: React.ReactNode
  } & React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={`/${locale ?? "en"}${href}`} {...rest}>
      {children}
    </a>
  ),
  usePathname: () => "/about",
}))

import { LanguageSwitcher } from "@/components/language-switcher"

describe("LanguageSwitcher", () => {
  beforeEach(() => {
    activeLocale = "en"
  })

  it("renders a single icon trigger instead of inline locale links", () => {
    render(<LanguageSwitcher />)

    expect(
      screen.getByRole("button", { name: enMessages.LanguageSwitcher.label })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("link", { name: enMessages.LanguageSwitcher.en })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("link", { name: enMessages.LanguageSwitcher.he })
    ).not.toBeInTheDocument()
  })

  it("opens localized route choices from the icon menu", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 })
    render(<LanguageSwitcher />)

    await user.click(
      screen.getByRole("button", { name: enMessages.LanguageSwitcher.label })
    )

    expect(
      await screen.findByRole("menuitem", {
        name: enMessages.LanguageSwitcher.en,
      })
    ).toHaveAttribute("href", "/en/about")
    expect(
      screen.getByRole("menuitem", { name: enMessages.LanguageSwitcher.he })
    ).toHaveAttribute("href", "/he/about")
    expect(
      screen.getByRole("menuitem", { name: enMessages.LanguageSwitcher.en })
    ).toHaveAttribute("aria-current", "true")
  })
})
