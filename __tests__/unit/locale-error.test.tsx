import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, describe, expect, it, vi } from "vitest"

import enMessages from "../../messages/en-US.json"
import LocaleError from "@/app/[locale]/error"

/**
 * Renders the locale error boundary inside a real next-intl provider so the
 * `Common.error` namespace resolves exactly as it would in the app. The boundary
 * logs the error on mount, so each test silences `console.error` and restores it
 * afterward to keep the suite output clean while still letting the component run
 * its effect.
 */
function renderError(
  locale: "en" | "he",
  messages: typeof enMessages,
  reset = vi.fn()
) {
  const error = Object.assign(new Error("boom"), { digest: "abc123" })
  render(
    <NextIntlClientProvider locale={locale} messages={messages}>
      <LocaleError error={error} reset={reset} />
    </NextIntlClientProvider>
  )
  return { reset }
}

describe("LocaleError", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("renders the localized error title, description, and retry", () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    renderError("en", enMessages)

    expect(screen.getByText(enMessages.Common.error.title)).toBeInTheDocument()
    expect(
      screen.getByText(enMessages.Common.error.description)
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: enMessages.Common.error.retry })
    ).toBeInTheDocument()
  })

  it("calls reset when the retry button is activated", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    const user = userEvent.setup()
    const { reset } = renderError("en", enMessages)

    await user.click(
      screen.getByRole("button", { name: enMessages.Common.error.retry })
    )

    expect(reset).toHaveBeenCalledTimes(1)
  })

  it("logs the thrown error for observability", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {})
    renderError("en", enMessages)

    expect(spy).toHaveBeenCalled()
  })

  it("uses the Hebrew catalog when the locale is he-IL", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    const heMessages = (await import("../../messages/he-IL.json")).default
    renderError("he", heMessages as typeof enMessages)

    expect(
      screen.getByText(heMessages.Common.error.title)
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: heMessages.Common.error.retry })
    ).toBeInTheDocument()
  })
})
