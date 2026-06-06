import { type BrowserContext, type Page, expect } from "@playwright/test"
import { createServerClient, type CookieOptions } from "@supabase/ssr"

/**
 * Admin credentials, read from the environment so no secret is committed. The
 * admin test skips when unset. Use an account whose email is confirmed and that
 * has been promoted to admin (see the plan's admin-seed step).
 */
export const adminCredentials = {
  email: process.env.E2E_ADMIN_EMAIL,
  password: process.env.E2E_ADMIN_PASSWORD,
}

/**
 * A non-admin customer account, read from the environment. The customer test
 * skips when unset. Use an account whose email is already confirmed.
 */
export const customerCredentials = {
  email: process.env.E2E_CUSTOMER_EMAIL,
  password: process.env.E2E_CUSTOMER_PASSWORD,
}

/**
 * Establishes an authenticated Supabase session in the browser context WITHOUT
 * driving the login form.
 *
 * Why: this project's Supabase auth has Turnstile captcha enforced, so a
 * headless browser cannot complete the UI sign-in - every form login is
 * rejected with `invalidCredentials`. The secret key bypasses captcha on the
 * password grant (a server-side privilege), so the harness mints the session
 * tokens directly. The tokens are then round-tripped through `@supabase/ssr`'s
 * own `createServerClient`, which emits the `sb-<ref>-auth-token` cookies in
 * exactly the format - including chunking - that the app's middleware and
 * server client read back. The cookies are injected into the test's browser
 * context, leaving the session indistinguishable from a real sign-in.
 *
 * Captcha stays fully enforced for real users; only this test harness, which
 * holds the secret key, sidesteps it.
 *
 * @throws if the required Supabase env vars are missing or the grant fails.
 */
export async function injectSession(
  context: BrowserContext,
  email: string,
  password: string
): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  const secretKey = process.env.SUPABASE_SECRET_KEY

  if (!url || !publishableKey || !secretKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY / SUPABASE_SECRET_KEY must be set to inject a session"
    )
  }

  // Step 1: mint tokens via the captcha-bypassing secret-key password grant.
  const grant = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      apikey: secretKey,
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  })
  const session = (await grant.json()) as {
    access_token?: string
    refresh_token?: string
    msg?: string
    error_description?: string
  }
  if (!grant.ok || !session.access_token || !session.refresh_token) {
    throw new Error(
      `secret-key password grant failed (${grant.status}): ${
        session.msg ?? session.error_description ?? "no tokens returned"
      }`
    )
  }

  // Step 2: round-trip through @supabase/ssr so it writes the auth cookies in
  // exactly the format the app reads. Capture them from setAll.
  const captured: { name: string; value: string; options: CookieOptions }[] = []
  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return []
      },
      setAll(cookiesToSet) {
        for (const { name, value, options } of cookiesToSet) {
          captured.push({ name, value, options: options ?? {} })
        }
      },
    },
  })
  const { error } = await supabase.auth.setSession({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  })
  if (error) {
    throw new Error(`setSession failed: ${error.message}`)
  }
  if (captured.length === 0) {
    throw new Error("no Supabase auth cookies were produced")
  }

  // Step 3: inject the cookies onto the app's origin. Over plain-http localhost
  // a `secure` cookie would be silently dropped by the browser, so the secure
  // flag is matched to the base URL's scheme rather than to what ssr requested.
  const base = process.env.E2E_BASE_URL ?? "http://localhost:3000"
  const { hostname, protocol } = new URL(base)
  const secure = protocol === "https:"
  await context.addCookies(
    captured.map((c) => ({
      name: c.name,
      value: c.value,
      domain: hostname,
      path: typeof c.options.path === "string" ? c.options.path : "/",
      httpOnly: c.options.httpOnly ?? false,
      secure,
      sameSite: "Lax" as const,
      expires: Math.floor(Date.now() / 1000) + 60 * 60,
    }))
  )
}

/**
 * Signs the admin in by injecting a session, then loads the localized `/admin`
 * dashboard and confirms it rendered. Replaces the captcha-blocked form login.
 */
export async function loginAsAdmin(page: Page): Promise<void> {
  const { email, password } = adminCredentials
  if (!email || !password) {
    throw new Error("E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD are required")
  }
  await injectSession(page.context(), email, password)
  await page.goto("/admin")
  await expect(page).toHaveURL(/\/admin/, { timeout: 15_000 })
}

/**
 * Signs the customer in by injecting a session, then loads the post-auth
 * landing. The destination depends on onboarding/plan state, so the helper only
 * asserts the customer is not bounced to login.
 */
export async function loginAsCustomer(page: Page): Promise<void> {
  const { email, password } = customerCredentials
  if (!email || !password) {
    throw new Error("E2E_CUSTOMER_EMAIL / E2E_CUSTOMER_PASSWORD are required")
  }
  await injectSession(page.context(), email, password)
  await page.goto("/profile")
  await expect(page).not.toHaveURL(/\/login/, { timeout: 15_000 })
}
