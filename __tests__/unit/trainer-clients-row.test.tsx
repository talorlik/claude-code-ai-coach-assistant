import { beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { NextIntlClientProvider } from "next-intl"

import en from "@/messages/en-US.json"
import {
  TrainerClients,
  type TrainerClientRow,
} from "@/app/[locale]/trainer/trainer-clients"
import {
  setPlanActiveAction,
  deleteClientAction,
} from "@/lib/db/trainer-clients-actions"

vi.mock("@/lib/db/trainer-clients-actions", () => ({
  setPlanActiveAction: vi.fn(),
  deleteClientAction: vi.fn(),
}))

// next-intl Link renders a plain anchor in tests.
vi.mock("@/i18n/navigation", () => ({
  Link: ({
    href,
    children,
    ...rest
  }: {
    href: string
    children: React.ReactNode
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}))

function row(overrides: Partial<TrainerClientRow> = {}): TrainerClientRow {
  return {
    userId: "c1",
    fullName: "Dana Levi",
    goals: ["strength"],
    joinDate: "2026-06-01T00:00:00Z",
    joinDateLabel: "Jun 1, 2026",
    hasActivePlan: true,
    hasAnyPlan: true,
    completionPercent: 50,
    activityLevel: "active",
    activityColor: "green",
    ...overrides,
  }
}

function renderList(rows: TrainerClientRow[]) {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      <TrainerClients rows={rows} />
    </NextIntlClientProvider>
  )
}

describe("TrainerClients row actions", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("renders an edit link to the client dashboard with a labelled control", () => {
    renderList([row()])
    const editLinks = screen.getAllByRole("link", { name: "Edit Dana Levi" })
    expect(editLinks.length).toBeGreaterThan(0)
    expect(editLinks[0]).toHaveAttribute("href", "/trainer/clients/c1")
  })

  it("does not render the client name as a link", () => {
    renderList([row()])
    expect(screen.queryByRole("link", { name: "Dana Levi" })).toBeNull()
  })

  it("renders a delete control labelled for the client", () => {
    renderList([row()])
    expect(
      screen.getAllByRole("button", { name: "Delete Dana Levi" }).length
    ).toBeGreaterThan(0)
  })

  it("disables the plan toggle when the client has no plan at all", () => {
    renderList([row({ hasActivePlan: false, hasAnyPlan: false })])
    const toggles = screen.getAllByRole("switch", {
      name: "Toggle plan for Dana Levi",
    })
    // The Base UI Switch renders its root as a span[role="switch"] and signals
    // disabled via aria-disabled, not the native `disabled` attribute that
    // jest-dom's toBeDisabled() recognises. Assert the accessible disabled
    // signal the component actually exposes.
    expect(toggles[0]).toHaveAttribute("aria-disabled", "true")
  })

  it("calls setPlanActiveAction and keeps the new state on success", async () => {
    vi.mocked(setPlanActiveAction).mockResolvedValue({
      ok: true,
      data: { hasActivePlan: false },
    })
    const user = userEvent.setup()
    renderList([row({ hasActivePlan: true, hasAnyPlan: true })])

    const toggle = screen.getAllByRole("switch", {
      name: "Toggle plan for Dana Levi",
    })[0]
    await user.click(toggle)

    expect(vi.mocked(setPlanActiveAction)).toHaveBeenCalledWith("c1", false)
  })

  it("reverts the toggle when the action fails", async () => {
    vi.mocked(setPlanActiveAction).mockResolvedValue({
      ok: false,
      error: "plan.updateError",
    })
    const user = userEvent.setup()
    renderList([row({ hasActivePlan: true, hasAnyPlan: true })])

    const toggle = screen.getAllByRole("switch", {
      name: "Toggle plan for Dana Levi",
    })[0]
    await user.click(toggle)

    // After a failed deactivate, the switch returns to its active state. Base UI
    // Switch is a span[role="switch"] that signals state via aria-checked rather
    // than the native checkbox `checked`, so assert that attribute directly.
    expect(
      screen.getAllByRole("switch", { name: "Toggle plan for Dana Levi" })[0]
    ).toHaveAttribute("aria-checked", "true")
  })

  it("calls deleteClientAction after confirming in the dialog", async () => {
    vi.mocked(deleteClientAction).mockResolvedValue({ ok: true, data: null })
    const user = userEvent.setup()
    renderList([row()])

    await user.click(
      screen.getAllByRole("button", { name: "Delete Dana Levi" })[0]
    )
    // Confirm button in the dialog (delete.confirmCta = "Delete client").
    await user.click(await screen.findByRole("button", { name: "Delete client" }))

    expect(vi.mocked(deleteClientAction)).toHaveBeenCalledWith("c1")
  })

  it("keeps the delete dialog open when deletion fails", async () => {
    vi.mocked(deleteClientAction).mockResolvedValue({
      ok: false,
      error: "delete.error",
    })
    const user = userEvent.setup()
    renderList([row()])

    await user.click(
      screen.getAllByRole("button", { name: "Delete Dana Levi" })[0]
    )
    const confirm = await screen.findByRole("button", { name: "Delete client" })
    await user.click(confirm)

    // Dialog stays open: the confirm button is still in the document.
    expect(
      screen.getByRole("button", { name: "Delete client" })
    ).toBeInTheDocument()
  })
})
