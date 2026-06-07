import { render, screen } from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import { describe, expect, it, vi } from "vitest"

import enMessages from "../../messages/en-US.json"

/**
 * Accessibility guard for the onboarding wizard: the `Field` component must
 * associate its visible `<Label>` with the control via `htmlFor`/`id`, so each
 * native input/select is reachable by its label name (not just visually
 * adjacent). This is the project's form-accessibility standard - labels
 * associated with their fields - applied to the onboarding native controls.
 */

vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

vi.mock("@/lib/onboarding/onboarding-actions", () => ({
  saveOnboardingStep: async () => ({ ok: true, data: { client: {} } }),
  saveOnboardingDetails: async () => ({ ok: true, data: { client: {} } }),
  generateOnboardingPlan: async () => ({
    ok: true,
    data: { planGenerated: true },
  }),
}))

import {
  OnboardingForm,
  EMPTY_DEFAULTS,
} from "@/app/[locale]/join/onboarding-form"

function renderForm() {
  return render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <OnboardingForm defaults={EMPTY_DEFAULTS} />
    </NextIntlClientProvider>
  )
}

describe("OnboardingForm field label association", () => {
  it("renders the wizard inside a real <form> element", () => {
    const { container } = renderForm()
    expect(container.querySelector("form")).not.toBeNull()
  })

  it("associates step-1 native controls with their labels", () => {
    renderForm()
    // getByLabelText resolves only when label htmlFor matches the control id.
    // Required-field labels carry a trailing "*", so match the label text as a
    // prefix rather than exactly.
    const byLabel = (text: string) =>
      screen.getByLabelText(new RegExp(`^${text}`))
    expect(byLabel(enMessages.Onboarding.fields.fullName)).toBeInTheDocument()
    expect(byLabel(enMessages.Onboarding.fields.phone)).toBeInTheDocument()
    expect(byLabel(enMessages.Onboarding.fields.age)).toBeInTheDocument()
    expect(byLabel(enMessages.Onboarding.fields.ageRange)).toBeInTheDocument()
  })

  it("exposes the advancing control as a real submit button", () => {
    renderForm()
    const next = screen.getByRole("button", {
      name: enMessages.Onboarding.nav.next,
    })
    expect((next as HTMLButtonElement).type).toBe("submit")
  })
})
