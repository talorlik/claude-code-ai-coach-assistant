import { describe, expect, it, vi } from "vitest"

import {
  ACCOUNT_MESSAGE_CODES,
  isAccountMessageCode,
  resolveAccountMessage,
  type AccountMessageCode,
} from "@/lib/profile/resolve-account-message"

/**
 * A stand-in next-intl translator: echoes the message key so tests assert on
 * routing/allowlist behavior without depending on a specific locale's copy.
 */
const echo = (key: AccountMessageCode): string => `t:${key}`

describe("isAccountMessageCode", () => {
  it("accepts every code in the allowlist", () => {
    for (const code of ACCOUNT_MESSAGE_CODES) {
      expect(isAccountMessageCode(code)).toBe(true)
    }
  })

  it("rejects unknown and undefined codes", () => {
    expect(isAccountMessageCode("totally-made-up")).toBe(false)
    expect(isAccountMessageCode("<script>alert(1)</script>")).toBe(false)
    expect(isAccountMessageCode(undefined)).toBe(false)
  })
})

describe("resolveAccountMessage", () => {
  it("translates a known code via the provided translator", () => {
    expect(resolveAccountMessage(echo, "detailsSaved")).toBe("t:detailsSaved")
    expect(resolveAccountMessage(echo, "passwordsDoNotMatch")).toBe(
      "t:passwordsDoNotMatch"
    )
  })

  it("returns null for an unknown code without calling the translator", () => {
    const translate = vi.fn(echo)
    expect(
      resolveAccountMessage(translate, "<script>alert(1)</script>")
    ).toBeNull()
    expect(resolveAccountMessage(translate, "totally-made-up")).toBeNull()
    expect(translate).not.toHaveBeenCalled()
  })

  it("returns null for an undefined code", () => {
    expect(resolveAccountMessage(echo, undefined)).toBeNull()
  })
})
