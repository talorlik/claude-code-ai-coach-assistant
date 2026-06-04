import { test, expect, type Page } from "@playwright/test"

import { customerCredentials } from "./helpers/auth"

/**
 * AI virtual-trainer chat E2E.
 *
 * The guest tests need no credentials: they assert `/chat` is guarded and
 * redirects a signed-out visitor to the localized login page, in both locales
 * (and that Hebrew renders RTL).
 *
 * The full-flow test requires a confirmed customer account, supplied via
 * `E2E_CUSTOMER_EMAIL` / `E2E_CUSTOMER_PASSWORD`; it skips when those are unset
 * so the suite stays green without seeded test users. It never calls the real AI
 * Gateway: the `/api/chat` response is intercepted and a canned UI-message
 * stream is returned, so the test asserts the client asking a question and seeing
 * the mocked answer rendered.
 */

test.describe("chat access control", () => {
  test("redirects a signed-out visitor from /en/chat to login", async ({
    page,
  }) => {
    await page.goto("/en/chat")
    await expect(page).toHaveURL(/\/en\/login/, { timeout: 15_000 })
  })

  test("redirects a signed-out visitor from /he/chat to login (rtl)", async ({
    page,
  }) => {
    await page.goto("/he/chat")
    await expect(page).toHaveURL(/\/he\/login/, { timeout: 15_000 })
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl")
  })
})

/** Signs the customer in via the login form, then waits for the app root. */
async function signInCustomer(page: Page): Promise<void> {
  const { email, password } = customerCredentials
  await page.goto("/en/login")
  await page.getByRole("tab", { name: /sign in/i }).click()
  await page.getByLabel(/email/i).fill(email!)
  await page.getByLabel(/password/i).fill(password!)
  await page.getByRole("button", { name: /^sign in$/i }).click()
  await page.waitForURL(/\/(en|he)\//, { timeout: 15_000 })
}

/**
 * Builds a minimal AI-SDK UI-message stream body that renders as a single
 * assistant text answer, so the e2e never depends on the live model. The format
 * is the SSE data stream the `useChat` transport consumes: a text-start, a
 * text-delta carrying the answer, a text-end, then the terminal `[DONE]`.
 */
function mockedStreamBody(answer: string): string {
  const id = "mock-msg"
  const events = [
    { type: "start" },
    { type: "text-start", id },
    { type: "text-delta", id, delta: answer },
    { type: "text-end", id },
    { type: "finish" },
  ]
  return (
    events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join("") +
    "data: [DONE]\n\n"
  )
}

test.describe("chat flow", () => {
  test.skip(
    !customerCredentials.email || !customerCredentials.password,
    "E2E_CUSTOMER_EMAIL / E2E_CUSTOMER_PASSWORD not set"
  )

  test.beforeEach(async ({ page }) => {
    await signInCustomer(page)
  })

  test("a client asks a question and sees the mocked answer", async ({
    page,
  }) => {
    const answer = "Do 3 sets of squats today. Stop if you feel any pain."

    // Intercept the chat route so no real AI call is made.
    await page.route("**/api/chat", async (route) => {
      await route.fulfill({
        status: 200,
        headers: { "content-type": "text/event-stream; charset=utf-8" },
        body: mockedStreamBody(answer),
      })
    })

    await page.goto("/en/chat")
    await expect(page).toHaveURL(/\/en\/chat/)

    await page.getByRole("textbox").fill("How many sets today?")
    await page.getByRole("button").last().click()

    await expect(page.getByText(answer)).toBeVisible({ timeout: 15_000 })
  })
})
