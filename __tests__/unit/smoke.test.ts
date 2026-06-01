import { describe, expect, it } from "vitest"

// Smoke test confirming the Vitest runner, config, and alias resolution work.
describe("test harness", () => {
  it("runs", () => {
    expect(1 + 1).toBe(2)
  })
})
