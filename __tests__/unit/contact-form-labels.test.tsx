import { render, screen } from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import { describe, expect, it, vi } from "vitest"

import enMessages from "../../messages/en-US.json"

/**
 * Accessibility guard for the contact form: every visible control must be a
 * native element associated with its `<Label htmlFor>` so it is reachable by
 * name, the form must be a real `<form>` (progressive enhancement), and the
 * advancing control must be a real submit button. Mirrors
 * `onboarding-form-labels.test.tsx`. The server action import is mocked so the
 * client component renders without pulling the server-only module graph.
 */

vi.mock("@/app/[locale]/contact/actions", () => ({
  submitContactForm: async () => {},
}))

import { ContactForm } from "@/components/contact-form"

function renderForm() {
  return render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <ContactForm />
    </NextIntlClientProvider>
  )
}

describe("ContactForm field label association", () => {
  it("renders inside a real <form> element", () => {
    const { container } = renderForm()
    expect(container.querySelector("form")).not.toBeNull()
  })

  it("associates each visible control with its label", () => {
    renderForm()
    expect(
      screen.getByLabelText(enMessages.Contact.nameLabel)
    ).toBeInTheDocument()
    expect(
      screen.getByLabelText(enMessages.Contact.emailFieldLabel)
    ).toBeInTheDocument()
    expect(
      screen.getByLabelText(enMessages.Contact.messageLabel)
    ).toBeInTheDocument()
  })

  it("exposes the submit control as a real submit button", () => {
    renderForm()
    const submit = screen.getByRole("button", {
      name: enMessages.Contact.submitLabel,
    })
    expect((submit as HTMLButtonElement).type).toBe("submit")
  })

  it("marks the message field required for no-JS validation", () => {
    renderForm()
    const message = screen.getByLabelText(enMessages.Contact.messageLabel)
    expect(message).toBeRequired()
  })
})
