import { fileURLToPath } from "node:url"
import { defineConfig } from "vitest/config"
import react from "@vitejs/plugin-react"

/**
 * Vitest config for unit and integration tests. Uses jsdom for component
 * tests and mirrors the `@/*` tsconfig path alias so imports resolve like the
 * app build. E2E specs under `e2e/` are owned by Playwright and excluded here.
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    include: ["__tests__/**/*.{test,spec}.{ts,tsx}"],
    exclude: ["e2e/**", "node_modules/**"],
  },
})
