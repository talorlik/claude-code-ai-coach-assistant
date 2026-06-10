import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { CollapsibleSection } from "@/app/[locale]/trainer/clients/[clientId]/collapsible-section"

const KEY = "trainer-section:test"

beforeEach(() => {
  window.localStorage.clear()
})
afterEach(() => {
  window.localStorage.clear()
})

describe("CollapsibleSection", () => {
  it("renders collapsed by default: title visible, body not", () => {
    render(
      <CollapsibleSection title="Plan detail" storageKey={KEY}>
        <p>inner body content</p>
      </CollapsibleSection>
    )
    expect(
      screen.getByRole("heading", { level: 2, name: "Plan detail" })
    ).toBeInTheDocument()
    const trigger = screen.getByRole("button", { name: /plan detail/i })
    expect(trigger).toHaveAttribute("aria-expanded", "false")
    expect(screen.queryByText("inner body content")).not.toBeInTheDocument()
  })

  it("expands when the trigger is clicked", async () => {
    const user = userEvent.setup()
    render(
      <CollapsibleSection title="Plan detail" storageKey={KEY}>
        <p>inner body content</p>
      </CollapsibleSection>
    )
    await user.click(screen.getByRole("button", { name: /plan detail/i }))
    expect(
      screen.getByRole("button", { name: /plan detail/i })
    ).toHaveAttribute("aria-expanded", "true")
    expect(screen.getByText("inner body content")).toBeInTheDocument()
  })

  it("opens on mount when localStorage has the section flagged open", async () => {
    window.localStorage.setItem(KEY, "1")
    render(
      <CollapsibleSection title="Plan detail" storageKey={KEY}>
        <p>inner body content</p>
      </CollapsibleSection>
    )
    expect(await screen.findByText("inner body content")).toBeInTheDocument()
  })

  it("persists the open state to localStorage when toggled", async () => {
    const user = userEvent.setup()
    render(
      <CollapsibleSection title="Plan detail" storageKey={KEY}>
        <p>inner body content</p>
      </CollapsibleSection>
    )
    await user.click(screen.getByRole("button", { name: /plan detail/i }))
    expect(window.localStorage.getItem(KEY)).toBe("1")
    await user.click(screen.getByRole("button", { name: /plan detail/i }))
    expect(window.localStorage.getItem(KEY)).toBe("0")
  })

  it("renders an optional subtitle and header action inside the panel", async () => {
    const user = userEvent.setup()
    render(
      <CollapsibleSection
        title="Notes"
        storageKey={KEY}
        subtitle="Only you can see these"
        headerAction={<button type="button">Add</button>}
      >
        <p>body</p>
      </CollapsibleSection>
    )
    await user.click(screen.getByRole("button", { name: /^notes$/i }))
    const region = screen.getByText("body").closest("section") as HTMLElement
    expect(
      within(region).getByText("Only you can see these")
    ).toBeInTheDocument()
    expect(
      within(region).getByRole("button", { name: "Add" })
    ).toBeInTheDocument()
  })
})
