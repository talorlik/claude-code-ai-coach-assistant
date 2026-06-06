import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import enMessages from "../../messages/en-US.json"

/**
 * Behavior test for the onboarding form's post-success routing (batch 21). When
 * `saveOnboarding` reports a generated plan, the form auto-navigates to
 * `/my-plan` via the locale-aware router and shows a redirecting status with no
 * manual button. When no plan was generated, it keeps the pending state and its
 * button instead. `saveOnboarding` and the router are mocked so only the form's
 * branching is exercised.
 */

const push = vi.fn()
let saveResult: {
  ok: boolean
  data?: { planGenerated: boolean }
  error?: string
  fieldErrors?: Record<string, string>
}

vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ push }),
}))
vi.mock("@/lib/onboarding/onboarding-actions", () => ({
  saveOnboarding: async () => saveResult,
}))

import { OnboardingForm, EMPTY_DEFAULTS } from "@/app/[locale]/join/onboarding-form"

/** Renders the form with a complete set of valid defaults so submit is reachable. */
function renderForm() {
  const defaults = {
    ...EMPTY_DEFAULTS,
    fullName: "Dana Cohen",
    age: "30",
    ageRange: "26-35",
    goals: ["build_muscle"],
    fitnessLevel: "beginner",
    preferredLocation: "gym",
    availableDays: ["mon", "wed", "fri"],
    equipment: ["dumbbells"],
  }
  return render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <OnboardingForm defaults={defaults} />
    </NextIntlClientProvider>
  )
}

/** Advances the 3-step wizard to the final step and submits. */
async function submit(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: /next/i }))
  await user.click(screen.getByRole("button", { name: /next/i }))
  await user.click(
    screen.getByRole("button", { name: /create my workout plan/i })
  )
}

beforeEach(() => {
  push.mockClear()
  saveResult = { ok: true, data: { planGenerated: true } }
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe("OnboardingForm post-success routing", () => {
  it("auto-redirects to /my-plan when a plan was generated", async () => {
    const user = userEvent.setup()
    renderForm()
    await submit(user)

    await waitFor(() => expect(push).toHaveBeenCalledWith("/my-plan"))
    expect(
      screen.getByText(enMessages.Onboarding.success.redirecting)
    ).toBeInTheDocument()
  })

  it("keeps the pending state and its button when no plan was generated", async () => {
    saveResult = { ok: true, data: { planGenerated: false } }
    const user = userEvent.setup()
    renderForm()
    await submit(user)

    await waitFor(() =>
      expect(
        screen.getByText(enMessages.Onboarding.success.planPending)
      ).toBeInTheDocument()
    )
    expect(push).not.toHaveBeenCalled()
    expect(
      screen.getByRole("button", { name: enMessages.Onboarding.success.cta })
    ).toBeInTheDocument()
  })
})
