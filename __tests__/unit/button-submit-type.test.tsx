import { describe, expect, it } from "vitest"
import { render } from "@testing-library/react"

import { Button } from "@/components/ui/button"

/**
 * Progressive-enhancement guard: the auth and profile forms rely on
 * `<Button type="submit">` to submit a native `<form>` with JavaScript disabled.
 * The Base UI Button primitive must therefore honor `type="submit"` and render a
 * real submit control - if it ever defaulted the prop away to `type="button"`,
 * every form's no-JS submit would silently break. This test fails loudly if that
 * regresses.
 */
describe("Button submit type (no-JS form submission)", () => {
  it("renders a native button element", () => {
    const { container } = render(<Button type="submit">Save</Button>)
    const el = container.querySelector("button")
    expect(el).not.toBeNull()
  })

  it("honors type=submit so it can submit a form without JS", () => {
    const { container } = render(<Button type="submit">Save</Button>)
    const el = container.querySelector("button")
    expect(el?.getAttribute("type")).toBe("submit")
    // A real submit button reports submit behavior to the form.
    expect((el as HTMLButtonElement).type).toBe("submit")
  })

  it("does not silently coerce to type=button", () => {
    const { container } = render(<Button type="submit">Save</Button>)
    const el = container.querySelector("button")
    expect(el?.getAttribute("type")).not.toBe("button")
  })
})
