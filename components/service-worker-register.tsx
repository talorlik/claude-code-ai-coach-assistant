"use client"

import { useEffect } from "react"

import { registerAppServiceWorker } from "@/lib/pwa/register"

/**
 * Mounts once in the locale layout and registers `/sw.js` on the client after
 * first paint, for every visitor - not only those who opt into push. This is
 * what makes the offline app-shell and installability available app-wide. It
 * renders nothing and never blocks render: registration is fire-and-forget and
 * no-ops on browsers without the Service Worker API.
 *
 * @returns `null` - this component has no visual output.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    registerAppServiceWorker(
      typeof navigator === "undefined" ? {} : navigator
    )
  }, [])

  return null
}
