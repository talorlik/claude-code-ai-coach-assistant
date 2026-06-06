import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { NextIntlClientProvider } from "next-intl"
import { beforeEach, describe, expect, it, vi } from "vitest"

import enMessages from "../../messages/en-US.json"

/**
 * Behavior test for the batch-25 "Create with AI" path in the plan manager
 * (required test #1). The template server actions are mocked so no real AI call
 * or database write happens: the test injects a fake `createAiTemplateAction`,
 * drives the dialog through the real UI, and asserts the action is invoked with
 * the trainer's inputs and that the returned template is added to the list.
 *
 * The AI stays server-side in production; this component test only proves the UI
 * wiring (open dialog -> fill -> submit -> action called -> list updated), which
 * is the contract the prompt requires.
 */

const createAiTemplateAction = vi.fn()

vi.mock("@/lib/trainer/template-actions", () => ({
  createTemplateAction: vi.fn(),
  updateTemplateAction: vi.fn(),
  duplicateTemplateAction: vi.fn(),
  assignTemplateAction: vi.fn(),
  createAiTemplateAction: (...args: unknown[]) =>
    createAiTemplateAction(...args),
}))

import { PlansManager } from "@/app/[locale]/trainer/plans/plans-manager"

function renderManager() {
  return render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <PlansManager locale="en" initialTemplates={[]} clients={[]} />
    </NextIntlClientProvider>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe("Create with AI", () => {
  it("invokes createAiTemplateAction with the form inputs and adds the result", async () => {
    createAiTemplateAction.mockResolvedValue({
      ok: true,
      data: {
        id: "tpl-1",
        title: "AI strength block",
        description: null,
        locale: "en-US",
        payload: { title: "AI strength block", workouts: [] },
      },
    })

    const user = userEvent.setup()
    renderManager()

    await user.click(screen.getByTestId("create-with-ai-open"))

    // Fill the title (required) and the goal shaping field.
    await user.type(
      screen.getByLabelText(enMessages.TrainerPlans.ai.fields.title),
      "AI strength block"
    )
    await user.type(
      screen.getByLabelText(enMessages.TrainerPlans.ai.fields.goal),
      "strength"
    )

    await user.click(screen.getByTestId("create-with-ai-submit"))

    await waitFor(() => {
      expect(createAiTemplateAction).toHaveBeenCalledTimes(1)
    })
    // No fake generator argument is passed from the UI: production uses the SDK
    // generator server-side. The action receives only the shaping input.
    const [input] = createAiTemplateAction.mock.calls[0]
    expect(input).toMatchObject({
      title: "AI strength block",
      locale: "en",
      goal: "strength",
    })

    // The returned template is prepended to the visible library.
    await waitFor(() => {
      expect(screen.getByText("AI strength block")).toBeInTheDocument()
    })
  })

  it("blocks submission and shows an error when the title is empty", async () => {
    const user = userEvent.setup()
    renderManager()

    await user.click(screen.getByTestId("create-with-ai-open"))
    await user.click(screen.getByTestId("create-with-ai-submit"))

    expect(createAiTemplateAction).not.toHaveBeenCalled()
    expect(
      screen.getByText(enMessages.TrainerPlans.ai.errors.title)
    ).toBeInTheDocument()
  })
})
