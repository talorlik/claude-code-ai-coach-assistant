import { existsSync } from "node:fs"
import { resolve } from "node:path"

import { describe, expect, it } from "vitest"

import { buildManifest } from "@/lib/pwa/manifest"

/**
 * Asset integration test: the manifest is only useful if the files it points at
 * actually ship. This walks every icon `src` in the manifest plus the Apple
 * touch icon and asserts the file exists under `public/`, so a renamed or
 * deleted icon fails the gate instead of producing a broken install/launch icon
 * in production.
 */
const publicDir = resolve(process.cwd(), "public")

describe("PWA assets", () => {
  it("ships every icon the manifest references", () => {
    const manifest = buildManifest()
    for (const icon of manifest.icons ?? []) {
      const path = resolve(publicDir, `.${icon.src}`)
      expect(existsSync(path), `${icon.src} should exist in public/`).toBe(true)
    }
  })

  it("ships the Apple touch icon and push icon", () => {
    expect(
      existsSync(resolve(publicDir, "icons/apple-touch-icon-180.png"))
    ).toBe(true)
    // sw.js (batch 15) shows this icon on push notifications.
    expect(existsSync(resolve(publicDir, "icon.png"))).toBe(true)
  })

  it("exposes a single, non-empty manifest source module", () => {
    const manifest = buildManifest()
    expect(manifest.name ?? "").not.toBe("")
    expect((manifest.icons ?? []).length).toBeGreaterThanOrEqual(3)
  })
})
