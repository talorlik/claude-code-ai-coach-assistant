import { beforeEach, describe, expect, it, vi } from "vitest"

/**
 * Behavior test for the `submitContactForm` server action. The locale-aware
 * `redirect` is mocked to throw a capturable target so each branch's
 * notice/error code is asserted, `getLocale` is pinned, and the secret-key admin
 * client's `functions.invoke` is mocked so no real network/email call runs. The
 * test pins the contract: missing fields and invalid email redirect with the
 * right error; valid input invokes the `contact` function and redirects with the
 * success notice; a filled honeypot returns silent success WITHOUT invoking; and
 * an invoke failure degrades to a localized error rather than throwing.
 */

class RedirectError extends Error {
  constructor(public target: string) {
    super(`redirect:${target}`)
  }
}

type InvokeResult = {
  data: { ok: boolean } | null
  error: { message: string } | null
}
const invoke = vi.fn(
  async (): Promise<InvokeResult> => ({ data: { ok: true }, error: null })
)

vi.mock("@/i18n/navigation", () => ({
  redirect: ({ href }: { href: string; locale: string }) => {
    throw new RedirectError(href)
  },
}))
vi.mock("next-intl/server", () => ({ getLocale: async () => "en" }))
vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: async () => ({ functions: { invoke } }),
}))

import { submitContactForm } from "@/app/[locale]/contact/actions"

function form(fields: Record<string, string>): FormData {
  const fd = new FormData()
  for (const [k, v] of Object.entries(fields)) fd.set(k, v)
  return fd
}

async function captureRedirect(run: () => Promise<void>): Promise<string> {
  try {
    await run()
  } catch (e) {
    if (e instanceof RedirectError) return e.target
    throw e
  }
  throw new Error("expected a redirect")
}

const VALID = {
  name: "Jane Doe",
  email: "jane@example.com",
  message: "I'd like to start training.",
}

beforeEach(() => {
  invoke.mockClear()
  invoke.mockResolvedValue({ data: { ok: true }, error: null })
})

describe("submitContactForm", () => {
  it("redirects with missing_fields when a required field is blank", async () => {
    const target = await captureRedirect(() =>
      submitContactForm(form({ name: "", email: "", message: "" }))
    )
    expect(target).toBe("/contact?error=missing_fields")
    expect(invoke).not.toHaveBeenCalled()
  })

  it("redirects with invalid_email for a malformed address", async () => {
    const target = await captureRedirect(() =>
      submitContactForm(form({ ...VALID, email: "not-an-email" }))
    )
    expect(target).toBe("/contact?error=invalid_email")
    expect(invoke).not.toHaveBeenCalled()
  })

  it("invokes the contact function and redirects with contact_sent on valid input", async () => {
    const target = await captureRedirect(() => submitContactForm(form(VALID)))
    expect(target).toBe("/contact?notice=contact_sent")
    expect(invoke).toHaveBeenCalledTimes(1)
    expect(invoke).toHaveBeenCalledWith("contact", {
      body: {
        name: VALID.name,
        email: VALID.email,
        message: VALID.message,
      },
    })
  })

  it("returns silent success for a filled honeypot without invoking", async () => {
    const target = await captureRedirect(() =>
      submitContactForm(form({ ...VALID, company: "spam-bot" }))
    )
    expect(target).toBe("/contact?notice=contact_sent")
    expect(invoke).not.toHaveBeenCalled()
  })

  it("degrades to send_failed when the function returns an error", async () => {
    invoke.mockResolvedValueOnce({ data: null, error: { message: "boom" } })
    const target = await captureRedirect(() => submitContactForm(form(VALID)))
    expect(target).toBe("/contact?error=send_failed")
  })

  it("degrades to send_failed when invoke throws", async () => {
    invoke.mockRejectedValueOnce(new Error("network down"))
    const target = await captureRedirect(() => submitContactForm(form(VALID)))
    expect(target).toBe("/contact?error=send_failed")
  })
})
