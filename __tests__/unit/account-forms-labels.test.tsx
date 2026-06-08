import { render, screen } from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import { describe, expect, it, vi } from "vitest"

import enMessages from "../../messages/en-US.json"
import heMessages from "../../messages/he-IL.json"

/**
 * Localization guard for the account settings forms. `AccountForms` is an async
 * server component that resolves every section title, field label, and button
 * label from the `Account` message namespace via `getTranslations`. This used to
 * be hardcoded English, so the page stayed English under the Hebrew locale; the
 * test renders the component under both catalogs and asserts the shipped copy in
 * each, locking the localization in.
 *
 * `next-intl/server` is stubbed with the real catalogs (mirroring
 * `homepage.test.tsx`) and the FormData server actions are mocked so the client
 * island renders without pulling the server-only module graph.
 */
const catalogs = { en: enMessages, he: heMessages } as const
let activeLocale: "en" | "he" = "en"

vi.mock("next-intl/server", () => ({
  getTranslations: async (namespace: string) => {
    const messages = catalogs[activeLocale] as unknown as Record<
      string,
      Record<string, string>
    >
    return (key: string) => messages[namespace][key]
  },
}))

vi.mock("@/lib/profile/profile-actions", () => ({
  updateProfileForm: async () => {},
  updateEmailForm: async () => {},
  updatePasswordForm: async () => {},
}))

import { AccountForms } from "@/app/[locale]/profile/account-forms"

/**
 * Awaits the async server component and mounts its produced element. The child
 * client island (`PhoneFieldUncontrolled` -> `PhoneField`) calls `useLocale`, so
 * the produced tree is wrapped in a client provider; the component's own copy
 * still comes from the stubbed `getTranslations` above.
 */
async function renderForms(locale: "en" | "he") {
  activeLocale = locale
  const ui = await AccountForms({
    initialFullName: "Tal Orlik",
    initialPhone: "538520014",
    initialCountryIso2: "IL",
    email: "talorlik@hotmail.com",
  })
  return render(
    <NextIntlClientProvider locale={locale} messages={catalogs[locale]}>
      {ui}
    </NextIntlClientProvider>
  )
}

describe("AccountForms localization", () => {
  it("renders the section titles from the Account namespace in English", async () => {
    await renderForms("en")
    expect(
      screen.getByRole("heading", { name: enMessages.Account.contactTitle })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("heading", { name: enMessages.Account.emailTitle })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("heading", { name: enMessages.Account.passwordTitle })
    ).toBeInTheDocument()
  })

  it("renders the section titles in Hebrew under the he locale", async () => {
    await renderForms("he")
    expect(
      screen.getByRole("heading", { name: heMessages.Account.contactTitle })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("heading", { name: heMessages.Account.emailTitle })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("heading", { name: heMessages.Account.passwordTitle })
    ).toBeInTheDocument()
  })

  it("associates each visible control with its localized label", async () => {
    await renderForms("he")
    expect(
      screen.getByLabelText(heMessages.Account.fullNameLabel)
    ).toBeInTheDocument()
    expect(
      screen.getByLabelText(heMessages.Account.emailLabel)
    ).toBeInTheDocument()
    expect(
      screen.getByLabelText(heMessages.Account.newPasswordLabel)
    ).toBeInTheDocument()
    expect(
      screen.getByLabelText(heMessages.Account.confirmPasswordLabel)
    ).toBeInTheDocument()
  })

  it("does not render any hardcoded English when the locale is Hebrew", async () => {
    const { container } = await renderForms("he")
    expect(container.textContent).not.toContain(enMessages.Account.contactTitle)
    expect(container.textContent).not.toContain(enMessages.Account.emailTitle)
    expect(container.textContent).not.toContain(
      enMessages.Account.passwordTitle
    )
  })
})
