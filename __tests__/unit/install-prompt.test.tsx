import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, describe, expect, it, vi } from "vitest"

import enMessages from "../../messages/en-US.json"
import { InstallPrompt } from "@/components/install-prompt"

/**
 * Component tests for the install affordance. They mock `matchMedia` and the
 * user agent (the inputs `lib/pwa/install` reads) to exercise the two
 * deterministic, headless-friendly branches: the iOS Add-to-Home-Screen
 * instructions when `beforeinstallprompt` is unavailable, and the fully-hidden
 * state when the app already runs standalone. The live `beforeinstallprompt`
 * Chromium path needs a real browser event and is covered by manual/e2e checks.
 */

/**
 * Installs a fake `matchMedia` returning `matches` for the standalone query and
 * sets the user agent, so the component's mount-time detection sees the desired
 * environment.
 */
function setEnvironment({
  standalone,
  userAgent,
}: {
  standalone: boolean
  userAgent: string
}) {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      matches: standalone && query === "(display-mode: standalone)",
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }),
  })
  Object.defineProperty(navigator, "userAgent", {
    configurable: true,
    value: userAgent,
  })
}

function renderPrompt() {
  return render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <InstallPrompt />
    </NextIntlClientProvider>
  )
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe("InstallPrompt", () => {
  it("renders the iOS instructions branch when beforeinstallprompt is unavailable", async () => {
    setEnvironment({
      standalone: false,
      userAgent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
    })
    const user = userEvent.setup()
    renderPrompt()

    // The install button appears (iOS has no auto-prompt, so it is the manual path).
    const button = await screen.findByRole("button", {
      name: enMessages.Pwa.install.button,
    })
    await user.click(button)

    // Opening it reveals the localized Add-to-Home-Screen instructions.
    expect(
      await screen.findByText(enMessages.Pwa.install.iosTitle)
    ).toBeInTheDocument()
    expect(
      screen.getByText(enMessages.Pwa.install.iosStep2)
    ).toBeInTheDocument()
  })

  it("renders nothing when the app is already installed (standalone)", async () => {
    setEnvironment({
      standalone: true,
      userAgent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
    })
    const { container } = renderPrompt()

    // Detection runs in an effect; give it a tick, then assert nothing rendered.
    await waitFor(() => {
      expect(
        screen.queryByText(enMessages.Pwa.install.button)
      ).not.toBeInTheDocument()
    })
    expect(container).toBeEmptyDOMElement()
  })
})
