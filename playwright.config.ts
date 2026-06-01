import { defineConfig, devices } from "@playwright/test"

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
