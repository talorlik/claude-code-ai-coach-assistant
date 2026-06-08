import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { NextIntlClientProvider, useTranslations } from "next-intl"
import { describe, expect, it, vi } from "vitest"

import enMessages from "../../messages/en-US.json"
import {
  StepAboutYou,
  type OnboardingDefaults,
  type StepProps,
} from "@/app/[locale]/join/onboarding-form"

/**
 * Name and phone are account-identity, edited once under "Contact details" on
 * the profile page (the profiles row). The single-page onboarding editor reuses
 * the wizard's StepAboutYou, which historically showed name/phone too - a
 * duplicate editable pair on the same page. These tests lock the dedup:
 * StepAboutYou hides those fields when `hideContact` is set (editors) but keeps
 * showing them by default (the /join wizard), and OnboardingDetailsForm still
 * carries the loaded name/phone into the save so the clients row stays valid.
 */

vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}))

import { OnboardingDetailsForm } from "@/components/onboarding/onboarding-details-form"

/** A complete, valid set of onboarding defaults (national phone, IL country). */
const VALID_DEFAULTS: OnboardingDefaults = {
  fullName: "Dana Levi",
  phone: "541234567",
  countryIso2: "IL",
  age: "32",
  ageRange: "",
  goals: ["build_muscle"],
  fitnessLevel: "intermediate",
  limitations: "",
  availableDays: ["monday", "wednesday", "friday"],
  availability: {
    monday: [{ start: "06:00", end: "08:00" }],
    wednesday: [{ start: "06:00", end: "08:00" }],
    friday: [{ start: "18:00", end: "20:00" }],
  },
  sessionDurationMinutes: "45",
  preferredLocation: "gym",
  equipment: ["dumbbells", "bench"],
  equipmentOtherSelected: false,
  equipmentOther: "",
  notes: "",
}

const labelRe = (text: string) => new RegExp(`^${text}`)

/**
 * StepAboutYou takes its translator as a prop (`t`), not from context, so this
 * harness pulls a real `Onboarding` translator from the provider and forwards
 * it - matching how the wizard/editor invoke the step.
 */
function StepAboutYouHarness({ hideContact }: { hideContact?: boolean }) {
  const t = useTranslations("Onboarding")
  return (
    <StepAboutYou
      t={t as StepProps["t"]}
      values={VALID_DEFAULTS}
      set={vi.fn()}
      fieldError={() => null}
      hideContact={hideContact}
    />
  )
}

function renderStep(hideContact?: boolean) {
  return render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <StepAboutYouHarness hideContact={hideContact} />
    </NextIntlClientProvider>
  )
}

describe("StepAboutYou contact fields", () => {
  it("shows name and phone by default (the /join wizard)", () => {
    renderStep()
    expect(
      screen.getByLabelText(labelRe(enMessages.Onboarding.fields.fullName))
    ).toBeInTheDocument()
    expect(
      screen.getByLabelText(labelRe(enMessages.Onboarding.fields.phone))
    ).toBeInTheDocument()
  })

  it("hides name and phone when hideContact is set (editors)", () => {
    renderStep(true)
    expect(
      screen.queryByLabelText(labelRe(enMessages.Onboarding.fields.fullName))
    ).toBeNull()
    expect(
      screen.queryByLabelText(labelRe(enMessages.Onboarding.fields.phone))
    ).toBeNull()
    // Age (the rest of step 1) still renders, proving only contact was removed.
    expect(
      screen.getByLabelText(labelRe(enMessages.Onboarding.fields.age))
    ).toBeInTheDocument()
  })
})

describe("OnboardingDetailsForm", () => {
  function renderForm(onSave: (input: unknown) => Promise<{ ok: boolean }>) {
    return render(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <OnboardingDetailsForm
          defaults={VALID_DEFAULTS}
          onSave={onSave as never}
        />
      </NextIntlClientProvider>
    )
  }

  it("does not render the duplicate name/phone fields", () => {
    renderForm(async () => ({ ok: true }))
    expect(
      screen.queryByLabelText(labelRe(enMessages.Onboarding.fields.fullName))
    ).toBeNull()
    expect(
      screen.queryByLabelText(labelRe(enMessages.Onboarding.fields.phone))
    ).toBeNull()
  })

  it("carries the loaded name and phone into the save", async () => {
    const onSave = vi.fn(
      async (_input: unknown) => ({ ok: true })
    )
    renderForm(onSave)
    fireEvent.click(
      screen.getByRole("button", {
        name: enMessages.AccountOnboarding.saveDetails,
      })
    )
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1))
    const input = onSave.mock.calls[0][0] as {
      fullName: string
      phone: string
      countryIso2: string
    }
    expect(input.fullName).toBe("Dana Levi")
    // national 541234567 + IL dial code +972 => E.164
    expect(input.phone).toBe("+972541234567")
    expect(input.countryIso2).toBe("IL")
  })
})
