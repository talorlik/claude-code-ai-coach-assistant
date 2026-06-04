import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { NextIntlClientProvider } from "next-intl"
import { beforeEach, describe, expect, it, vi } from "vitest"

import enMessages from "../../messages/en-US.json"

/**
 * Captures `setTheme` so the test can assert which mode each menu item selects.
 * `useTheme` is the only part of next-themes the toggle touches; the rest of the
 * provider (storage, class application) is next-themes' responsibility and is
 * covered end to end by the Playwright persistence spec.
 */
const setTheme = vi.fn()
vi.mock("next-themes", () => ({
  useTheme: () => ({ setTheme }),
}))

import { ModeToggle } from "@/components/mode-toggle"

/**
 * Renders the toggle inside a real next-intl provider so the `ThemeToggle`
 * namespace resolves exactly as it would in the app, in the given locale.
 */
function renderToggle(locale: "en" | "he", messages: typeof enMessages) {
  return render(
    <NextIntlClientProvider locale={locale} messages={messages}>
      <ModeToggle />
    </NextIntlClientProvider>
  )
}

describe("ModeToggle", () => {
  beforeEach(() => {
    setTheme.mockClear()
  })

  it("labels the trigger from the ThemeToggle namespace", () => {
    renderToggle("en", enMessages)
    expect(
      screen.getByText(enMessages.ThemeToggle.label)
    ).toBeInTheDocument()
  })

  it("renders the three localized modes", async () => {
    const user = userEvent.setup()
    renderToggle("en", enMessages)

    await user.click(screen.getByRole("button"))

    // Base UI renders the open menu in a portal; the items resolve once it opens.
    expect(
      await screen.findByText(enMessages.ThemeToggle.light)
    ).toBeInTheDocument()
    expect(screen.getByText(enMessages.ThemeToggle.dark)).toBeInTheDocument()
    expect(screen.getByText(enMessages.ThemeToggle.system)).toBeInTheDocument()
  })

  it.each([
    ["light", enMessages.ThemeToggle.light],
    ["dark", enMessages.ThemeToggle.dark],
    ["system", enMessages.ThemeToggle.system],
  ] as const)("selects the %s theme", async (mode, label) => {
    // Disable the pointer-events guard: Base UI keeps a transient overlay with
    // `pointer-events: none` during the menu's open/close transition, which
    // jsdom never clears (no real animation frames). The guard is a real-DOM
    // affordance the toggle does not depend on.
    const user = userEvent.setup({ pointerEventsCheck: 0 })
    renderToggle("en", enMessages)

    await user.click(screen.getByRole("button"))
    await user.click(await screen.findByText(label))

    expect(setTheme).toHaveBeenCalledWith(mode)
  })

  it("uses the Hebrew catalog when the locale is he-IL", async () => {
    const heMessages = (await import("../../messages/he-IL.json")).default
    const user = userEvent.setup()
    renderToggle("he", heMessages as typeof enMessages)

    expect(
      screen.getByText(heMessages.ThemeToggle.label)
    ).toBeInTheDocument()

    await user.click(screen.getByRole("button"))
    await waitFor(() =>
      expect(screen.getByText(heMessages.ThemeToggle.light)).toBeInTheDocument()
    )
  })
})
