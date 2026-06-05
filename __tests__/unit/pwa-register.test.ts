import { describe, expect, it, vi } from "vitest"

import {
  registerAppServiceWorker,
  SERVICE_WORKER_URL,
  type RegisterGlobals,
} from "@/lib/pwa/register"

/**
 * Unit tests for the service-worker registration helper. They drive it with a
 * fake `serviceWorker` container so no real browser is needed, covering the two
 * contracts: it registers `/sw.js` once when supported, and no-ops when the
 * Service Worker API is absent (older browsers / SSR).
 */
describe("registerAppServiceWorker", () => {
  it("registers /sw.js when the Service Worker API is present", () => {
    const register = vi.fn().mockResolvedValue({})
    const globals: RegisterGlobals = { serviceWorker: { register } }

    const attempted = registerAppServiceWorker(globals)

    expect(attempted).toBe(true)
    expect(register).toHaveBeenCalledTimes(1)
    expect(register).toHaveBeenCalledWith(SERVICE_WORKER_URL)
  })

  it("no-ops when serviceWorker is absent", () => {
    expect(registerAppServiceWorker({})).toBe(false)
    expect(registerAppServiceWorker()).toBe(false)
  })

  it("swallows a rejected registration without throwing", async () => {
    const register = vi.fn().mockRejectedValue(new Error("network"))
    const attempted = registerAppServiceWorker({ serviceWorker: { register } })

    expect(attempted).toBe(true)
    // The helper must not surface the rejection; awaiting a microtask flush
    // proves the unhandled rejection is caught internally.
    await Promise.resolve()
    expect(register).toHaveBeenCalledTimes(1)
  })
})
