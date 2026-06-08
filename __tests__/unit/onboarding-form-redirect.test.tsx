import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import enMessages from "../../messages/en-US.json"

/**
 * Behavior test for the onboarding form's final-step save-then-generate flow.
 * The "Generate" button is disabled until the profile is saved; once saved and
 * generation reports a plan, the form auto-navigates to `/my-plan` and shows a
 * redirecting status. When generation reports no plan, it keeps the pending
 * state and its "Go to my account" button instead. The step save, full-profile
 * save, plan generation, and the router are mocked so only the form's branching
 * is exercised.
 */

const push = vi.fn()
let generateResult: {
  ok: boolean
  data?: { planGenerated: boolean }
  error?: string
}

vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ push }),
}))

vi.mock("@/lib/onboarding/onboarding-actions", () => ({
  // Step and full-profile saves always succeed in these tests; the step save
  // echoes back a client so the form can advance.
  saveOnboardingStep: async () => ({ ok: true, data: { client: {} } }),
  saveOnboardingDetails: async () => ({ ok: true, data: { client: {} } }),
  generateOnboardingPlan: async () => generateResult,
}))

import {
  OnboardingForm,
  EMPTY_DEFAULTS,
} from "@/app/[locale]/join/onboarding-form"

/** Renders the form with a complete set of valid defaults so submit is reachable. */
function renderForm() {
  const defaults = {
    ...EMPTY_DEFAULTS,
    fullName: "Dana Cohen",
    phone: "+972541234567",
    age: "30",
    ageRange: "",
    goals: ["build_muscle"],
    fitnessLevel: "beginner",
    preferredLocation: "gym",
    availableDays: ["monday", "wednesday", "friday"],
    availability: {
      monday: [{ start: "06:00", end: "08:00" }],
      wednesday: [{ start: "06:00", end: "08:00" }],
      friday: [{ start: "18:00", end: "20:00" }],
    },
    sessionDurationMinutes: "45",
    equipment: ["dumbbells"],
  }
  return render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <OnboardingForm defaults={defaults} />
    </NextIntlClientProvider>
  )
}

/** Advances the 3-step wizard, saves the profile, then generates the plan. */
async function saveAndGenerate(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: /next/i }))
  await user.click(screen.getByRole("button", { name: /next/i }))
  await user.click(
    screen.getByRole("button", { name: enMessages.Onboarding.nav.saveDetails })
  )
  // The generate button unlocks only after the save resolves.
  const generate = await screen.findByRole("button", {
    name: enMessages.Onboarding.submit,
  })
  await waitFor(() => expect(generate).not.toBeDisabled())
  await user.click(generate)
}

beforeEach(() => {
  push.mockClear()
  generateResult = { ok: true, data: { planGenerated: true } }
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe("OnboardingForm save-then-generate flow", () => {
  it("keeps Generate disabled until the profile is saved", async () => {
    const user = userEvent.setup()
    renderForm()
    await user.click(screen.getByRole("button", { name: /next/i }))
    await user.click(screen.getByRole("button", { name: /next/i }))

    expect(
      screen.getByRole("button", { name: enMessages.Onboarding.submit })
    ).toBeDisabled()
  })

  it("auto-redirects to /my-plan when a plan was generated", async () => {
    const user = userEvent.setup()
    renderForm()
    await saveAndGenerate(user)

    await waitFor(() => expect(push).toHaveBeenCalledWith("/my-plan"))
    expect(
      screen.getByText(enMessages.Onboarding.success.redirecting)
    ).toBeInTheDocument()
  })

  it("keeps the pending state and its button when no plan was generated", async () => {
    generateResult = { ok: true, data: { planGenerated: false } }
    const user = userEvent.setup()
    renderForm()
    await saveAndGenerate(user)

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
