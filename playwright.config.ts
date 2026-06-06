import { defineConfig, devices } from "@playwright/test"
import { config as loadEnv } from "dotenv"

/**
 * Load local env into the Playwright runner process. Next.js loads `.env.local`
 * for the app, but the test runner is a separate Node process; without this it
 * cannot see `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_SECRET_KEY`, which the
 * session-injection helper needs to mint an admin session past the auth
 * captcha. Shell-exported vars (e.g. `E2E_ADMIN_*`) are not overridden, so they
 * still take precedence over file values.
 */
loadEnv({ path: ".env.local" })
loadEnv({ path: ".env" })

/**
 * Playwright config for the auth E2E suite. Starts the app via `webServer`
 * (reusing a running dev server if one is up) and drives it through Chromium.
 * Base URL and credentials can be overridden via environment variables.
 */
const PORT = Number(process.env.E2E_PORT ?? 3000)
const BASE_URL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? "dot" : "list",
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    locale: "en-US",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npm run dev -- --port ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
