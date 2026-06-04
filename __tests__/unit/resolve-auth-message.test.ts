import { describe, expect, it, vi } from "vitest"

import {
  AUTH_MESSAGE_CODES,
  isAuthMessageCode,
  resolveAuthMessage,
  type AuthMessageCode,
} from "@/lib/auth/resolve-auth-message"

/**
 * A stand-in next-intl translator: echoes the message key so tests assert on
 * routing/allowlist behavior without depending on a specific locale's copy.
 */
const echo = (key: AuthMessageCode): string => `t:${key}`

describe("isAuthMessageCode", () => {
  it("accepts every code in the allowlist", () => {
    for (const code of AUTH_MESSAGE_CODES) {
      expect(isAuthMessageCode(code)).toBe(true)
    }
  })

  it("rejects unknown and undefined codes", () => {
    expect(isAuthMessageCode("totally-made-up")).toBe(false)
    expect(isAuthMessageCode("<script>alert(1)</script>")).toBe(false)
    expect(isAuthMessageCode(undefined)).toBe(false)
  })
})

describe("resolveAuthMessage", () => {
  it("translates a known code via the provided translator", () => {
    expect(resolveAuthMessage(echo, "invalidCredentials")).toBe(
      "t:invalidCredentials"
    )
    expect(resolveAuthMessage(echo, "resetLinkSent")).toBe("t:resetLinkSent")
  })

  it("returns null for an unknown code without calling the translator", () => {
    const translate = vi.fn(echo)
    expect(resolveAuthMessage(translate, "<script>alert(1)</script>")).toBeNull()
    expect(resolveAuthMessage(translate, "totally-made-up")).toBeNull()
    expect(translate).not.toHaveBeenCalled()
  })

  it("returns null for an undefined code", () => {
    expect(resolveAuthMessage(echo, undefined)).toBeNull()
  })
})
