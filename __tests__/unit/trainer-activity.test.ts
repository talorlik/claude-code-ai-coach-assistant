import { describe, expect, it } from "vitest"

import {
  ACTIVITY_THRESHOLDS,
  activityColor,
  activityIndicator,
  activityLevel,
} from "@/lib/trainer/activity"

describe("activityLevel (completion thresholds)", () => {
  it("is active at and above the active threshold", () => {
    expect(activityLevel(ACTIVITY_THRESHOLDS.active)).toBe("active")
    expect(activityLevel(75)).toBe("active")
    expect(activityLevel(100)).toBe("active")
  })

  it("is at-risk between the at-risk and active thresholds (inclusive lower)", () => {
    expect(activityLevel(ACTIVITY_THRESHOLDS.atRisk)).toBe("atRisk")
    expect(activityLevel(35)).toBe("atRisk")
    expect(activityLevel(ACTIVITY_THRESHOLDS.active - 1)).toBe("atRisk")
  })

  it("is inactive below the at-risk threshold", () => {
    expect(activityLevel(ACTIVITY_THRESHOLDS.atRisk - 1)).toBe("inactive")
    expect(activityLevel(0)).toBe("inactive")
  })

  it("clamps by comparison for out-of-range inputs", () => {
    expect(activityLevel(-10)).toBe("inactive")
    expect(activityLevel(150)).toBe("active")
  })
})

describe("activityColor (level to traffic light)", () => {
  it("maps each level to its colour token", () => {
    expect(activityColor("active")).toBe("green")
    expect(activityColor("atRisk")).toBe("yellow")
    expect(activityColor("inactive")).toBe("red")
  })
})

describe("activityIndicator (combined)", () => {
  it("derives level and colour together", () => {
    expect(activityIndicator(80)).toEqual({ level: "active", color: "green" })
    expect(activityIndicator(30)).toEqual({ level: "atRisk", color: "yellow" })
    expect(activityIndicator(0)).toEqual({ level: "inactive", color: "red" })
  })
})
