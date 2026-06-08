import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, resolve } from "node:path"

import { describe, expect, it } from "vitest"

import {
  DIFFICULTY_LEVELS,
  ENERGY_LEVELS,
} from "@/lib/workouts/logging-constants"

/**
 * Regression guard for the "View workout" crash: the plan view is a client
 * component and renders its completion-form selects from DIFFICULTY_LEVELS /
 * ENERGY_LEVELS. Those consts must live in a plain module, never in the
 * `"use server"` action file - a client component importing a value from a
 * `"use server"` module throws at runtime when the dialog mounts.
 *
 * The tests assert the value tuples are importable here (a plain module would
 * not be, were they still behind the action boundary), that the constants
 * module carries no `"use server"` directive, and that the plan view sources
 * the consts from the constants module rather than the action.
 */

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..")

describe("logging constants boundary", () => {
  it("exposes the difficulty and energy tuples", () => {
    expect(DIFFICULTY_LEVELS).toEqual(["easy", "ok", "hard"])
    expect(ENERGY_LEVELS).toEqual(["low", "medium", "high"])
  })

  it("keeps the constants module free of a use-server directive", () => {
    const source = readFileSync(
      resolve(root, "lib/workouts/logging-constants.ts"),
      "utf8"
    )
    expect(source).not.toMatch(/^\s*["']use server["']/m)
  })

  it("imports the value tuples in plan-view from the constants module", () => {
    const source = readFileSync(
      resolve(root, "app/[locale]/my-plan/plan-view.tsx"),
      "utf8"
    )
    // The consts come from logging-constants... ([\s\S] stands in for the `s`
    // dotall flag, which this tsconfig target predates).
    expect(source).toMatch(
      /import\s*\{[\s\S]*?DIFFICULTY_LEVELS[\s\S]*?\}\s*from\s*["']@\/lib\/workouts\/logging-constants["']/
    )
    // ...and not from the server-action module.
    const actionImport = source.match(
      /import\s*\{([\s\S]*?)\}\s*from\s*["']@\/lib\/workouts\/logging-actions["']/
    )
    if (actionImport) {
      expect(actionImport[1]).not.toMatch(/DIFFICULTY_LEVELS|ENERGY_LEVELS/)
    }
  })
})
