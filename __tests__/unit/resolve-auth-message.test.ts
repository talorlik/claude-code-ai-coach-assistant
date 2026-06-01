import { describe, expect, it } from "vitest"
import { resolveAuthMessage } from "@/lib/auth/resolve-auth-message"

describe("resolveAuthMessage", () => {
  it("resolves a known code to its message", () => {
    expect(resolveAuthMessage("invalidCredentials")).toBe(
      "Invalid email or password."
    )
    expect(resolveAuthMessage("resetLinkSent")).toBeTruthy()
  })

  it("returns null for an unknown code (no reflection)", () => {
    expect(resolveAuthMessage("<script>alert(1)</script>")).toBeNull()
    expect(resolveAuthMessage("totally-made-up")).toBeNull()
  })

  it("returns null for an undefined code", () => {
    expect(resolveAuthMessage(undefined)).toBeNull()
  })
})
