import { describe, expect, it } from "vitest"

import { buildManifest, THEME_COLOR } from "@/lib/pwa/manifest"
import manifestRoute from "@/app/manifest"

/**
 * Unit tests for the Web App Manifest. They assert the installability-critical
 * fields directly on the object the `/manifest.webmanifest` route returns, so a
 * regression that would make the app non-installable (wrong `display`, missing
 * icons, missing `start_url`) fails here rather than only in a browser audit.
 */
describe("buildManifest", () => {
  const manifest = buildManifest()

  it("names the app for the install UI", () => {
    expect(manifest.name).toBe("Studio Itai - AI Fitness Coach")
    expect(manifest.short_name).toBe("Studio Itai")
  })

  it("declares a standalone, installable display mode", () => {
    expect(manifest.display).toBe("standalone")
  })

  it("starts at a locale-prefixed entry point within scope", () => {
    expect(manifest.start_url).toBe("/en")
    expect(manifest.scope).toBe("/")
  })

  it("uses the theme color shared with the document chrome", () => {
    expect(manifest.theme_color).toBe(THEME_COLOR)
    expect(manifest.background_color).toBeDefined()
  })

  it("provides 192 and 512 any icons plus a 512 maskable icon", () => {
    const icons = manifest.icons ?? []
    const sizes = icons.map((icon) => `${icon.sizes}:${icon.purpose}`)
    expect(sizes).toContain("192x192:any")
    expect(sizes).toContain("512x512:any")
    expect(sizes).toContain("512x512:maskable")
    for (const icon of icons) {
      expect(icon.type).toBe("image/png")
      expect(icon.src.startsWith("/icons/")).toBe(true)
    }
  })

  it("is the same object the manifest route serves", () => {
    expect(manifestRoute()).toEqual(manifest)
  })
})
