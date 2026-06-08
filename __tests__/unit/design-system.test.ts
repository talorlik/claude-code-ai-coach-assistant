import { readFileSync } from "node:fs"
import { resolve } from "node:path"

import { describe, expect, it } from "vitest"

/**
 * Guards the batch-26 design-system foundation: the scheme-aware favicon wiring
 * in the locale layout metadata and the presence of the branded `.light` and
 * `.dark` token blocks in the global stylesheet. These assert the pieces a
 * browser audit would otherwise be the only thing to catch (a dropped favicon
 * variant, a reverted palette block).
 *
 * The layout module is asserted against its source text rather than imported,
 * because importing `app/[locale]/layout.tsx` pulls in the next-intl navigation
 * client, which does not resolve under the jsdom unit-test environment.
 */

const layoutSource = readFileSync(
  resolve(process.cwd(), "app/[locale]/layout.tsx"),
  "utf8"
)

const cssSource = readFileSync(resolve(process.cwd(), "app/globals.css"), "utf8")

describe("locale layout favicons", () => {
  it("wires the default (any) favicon", () => {
    expect(layoutSource).toContain(
      '{ url: "/favicon-default-dark.ico", sizes: "any" }'
    )
  })

  it("wires the light-scheme favicon", () => {
    expect(layoutSource).toContain(
      '{ url: "/favicon-light.ico", media: "(prefers-color-scheme: light)" }'
    )
  })

  it("wires the dark-scheme favicon", () => {
    expect(layoutSource).toContain(
      '{ url: "/favicon-dark.ico", media: "(prefers-color-scheme: dark)" }'
    )
  })
})

describe("globals.css token blocks", () => {
  it("defines a .light token block", () => {
    expect(cssSource).toContain(".light {")
  })

  it("defines a .dark token block", () => {
    expect(cssSource).toContain(".dark {")
  })

  it("uses the branded primary hex values rather than the stock OKLCH palette", () => {
    expect(cssSource).toContain("--primary: #e05d38")
    expect(cssSource).toContain("--primary: #b91c1c")
  })
})
