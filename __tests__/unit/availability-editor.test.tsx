import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"

import { AvailabilityEditor } from "@/components/onboarding/availability-editor"
import type { Availability } from "@/lib/validation/onboarding"

/**
 * Behaviour tests for the per-day availability editor. They cover the three
 * pieces of logic that are easy to get wrong: seeding/pruning windows as the
 * selected-day set changes, adding and removing windows within a day, and
 * surfacing the duration selection. A minimal identity translator stands in for
 * next-intl so the assertions read against stable keys.
 */

/** Identity translator: returns the key, interpolating {minutes} when present. */
function t(key: string, values?: Record<string, unknown>): string {
  if (values && "minutes" in values) return `${values.minutes} min`
  return key
}

/** Renders the editor as a controlled component, exposing the latest value. */
function setup(opts: { days: string[]; value?: Availability; duration?: string }) {
  const onChange = vi.fn()
  const onDurationChange = vi.fn()
  const utils = render(
    <AvailabilityEditor
      days={opts.days}
      value={opts.value ?? {}}
      onChange={onChange}
      duration={opts.duration ?? ""}
      onDurationChange={onDurationChange}
      t={t}
    />
  )
  return { onChange, onDurationChange, ...utils }
}

afterEach(() => {
  vi.clearAllMocks()
})

describe("AvailabilityEditor", () => {
  it("prompts to pick days when none are selected", () => {
    setup({ days: [] })
    expect(screen.getByText("hints.availability")).toBeInTheDocument()
  })

  it("seeds a default window for a newly selected day", () => {
    const { onChange } = setup({ days: ["monday"], value: {} })
    // The reconciliation effect fires once on mount with the seeded window.
    expect(onChange).toHaveBeenCalledWith({
      monday: [{ start: "06:00", end: "07:00" }],
    })
  })

  it("does not reseed when the day already has windows", () => {
    const { onChange } = setup({
      days: ["monday"],
      value: { monday: [{ start: "08:00", end: "09:00" }] },
    })
    expect(onChange).not.toHaveBeenCalled()
  })

  it("renders a window row per selected day with start and end selects", () => {
    setup({
      days: ["monday", "tuesday"],
      value: {
        monday: [{ start: "06:00", end: "08:00" }],
        tuesday: [{ start: "07:00", end: "09:00" }],
      },
    })
    expect(screen.getByTestId("availability-row-monday")).toBeInTheDocument()
    expect(screen.getByTestId("availability-row-tuesday")).toBeInTheDocument()
    expect(screen.getAllByLabelText("availability.start")).toHaveLength(2)
  })

  it("adds a window to a day on demand", async () => {
    const user = userEvent.setup()
    const { onChange } = setup({
      days: ["monday"],
      value: { monday: [{ start: "06:00", end: "08:00" }] },
    })
    await user.click(screen.getByRole("button", { name: "availability.addRange" }))
    expect(onChange).toHaveBeenCalledWith({
      monday: [
        { start: "06:00", end: "08:00" },
        { start: "06:00", end: "07:00" },
      ],
    })
  })

  it("removes a window when more than one exists", async () => {
    const user = userEvent.setup()
    const { onChange } = setup({
      days: ["monday"],
      value: {
        monday: [
          { start: "06:00", end: "08:00" },
          { start: "18:00", end: "20:00" },
        ],
      },
    })
    const removes = screen.getAllByRole("button", {
      name: "availability.removeRange",
    })
    await user.click(removes[0])
    expect(onChange).toHaveBeenCalledWith({
      monday: [{ start: "18:00", end: "20:00" }],
    })
  })

  it("offers no remove control for the only window of a day", () => {
    setup({
      days: ["monday"],
      value: { monday: [{ start: "06:00", end: "08:00" }] },
    })
    expect(
      screen.queryByRole("button", { name: "availability.removeRange" })
    ).not.toBeInTheDocument()
  })

  it("reports the chosen session duration", async () => {
    const user = userEvent.setup()
    const { onDurationChange } = setup({
      days: ["monday"],
      value: { monday: [{ start: "06:00", end: "08:00" }] },
    })
    await user.selectOptions(
      screen.getByLabelText(/fields.sessionDuration/),
      "45"
    )
    expect(onDurationChange).toHaveBeenCalledWith("45")
  })
})
