/*
 * Service worker for Studio Itai.
 *
 * Served statically from /sw.js. It now serves TWO duties from a single worker
 * (the app must never register a second, competing service worker):
 *
 *  1. Web Push workout reminders (batch 15):
 *     - `push`: shows the notification using the JSON payload sent by the server
 *       (`{ title, body, url }`). The payload is intentionally non-sensitive - it
 *       carries no injury or medical detail.
 *     - `notificationclick`: focuses an existing app tab if one is open, otherwise
 *       opens the deep link the payload provided.
 *
 *  2. PWA installability / offline app-shell (batch 20):
 *     - `install`: precaches a minimal offline shell (the `/en` and `/he`
 *       offline documents plus the manifest and icons).
 *     - `activate`: deletes caches from older versions and takes control.
 *     - `fetch`: for failed *navigations* only, serves the cached offline page.
 *       All other requests pass through to the network untouched.
 *
 * CACHING POLICY (security): only same-origin GET navigations and the explicitly
 * listed static shell assets are ever cached. Authenticated and dynamic traffic
 * is NEVER cached - any request under `/api/*` (push, AI chat, PDF, server
 * actions), Supabase calls, and any non-GET request bypass the cache entirely.
 * This keeps tokens, AI output, and personal data out of the Cache Storage that
 * `display: standalone` would otherwise persist on the device.
 *
 * This file is plain JavaScript on purpose: it runs in the ServiceWorker global
 * scope, not in the app bundle, so it is excluded from the TypeScript build.
 */

// Bump this on every shell change so `activate` purges the previous cache.
const CACHE_VERSION = "itai-pwa-v1"

// Locale-prefixed offline documents (localePrefix: "always" means there is no
// bare "/offline"). Both are precached so an offline navigation in either
// language falls back to the matching offline page.
const OFFLINE_URLS = ["/en/offline", "/he/offline"]

// The minimal app-shell precache: the offline documents plus the install
// assets a freshly-installed PWA needs before it can reach the network.
const PRECACHE_URLS = [
  ...OFFLINE_URLS,
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
]

// The offline page served when a navigation fails and no exact match is cached.
const DEFAULT_OFFLINE_URL = "/en/offline"

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      // `addAll` is atomic per URL but tolerant overall: precache best-effort so
      // one missing asset does not abort the whole install.
      .then((cache) =>
        Promise.allSettled(PRECACHE_URLS.map((url) => cache.add(url)))
      )
      .then(() => self.skipWaiting())
  )
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_VERSION)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  )
})

self.addEventListener("fetch", (event) => {
  const request = event.request

  // Only ever touch same-origin GET navigations. Everything else - API/auth/AI
  // calls, Supabase, cross-origin, and all non-GET methods - passes straight
  // through so nothing sensitive or dynamic is cached or intercepted.
  if (request.method !== "GET" || request.mode !== "navigate") {
    return
  }

  const url = new URL(request.url)
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) {
    return
  }

  // Network-first for navigations: try the live network, and only on failure
  // (offline) fall back to the cached offline document for the request's locale.
  event.respondWith(
    fetch(request).catch(async () => {
      const cache = await caches.open(CACHE_VERSION)
      const locale = url.pathname.startsWith("/he") ? "/he" : "/en"
      return (
        (await cache.match(`${locale}/offline`)) ||
        (await cache.match(DEFAULT_OFFLINE_URL)) ||
        Response.error()
      )
    })
  )
})

self.addEventListener("push", (event) => {
  let payload = {}
  try {
    payload = event.data ? event.data.json() : {}
  } catch {
    payload = {}
  }

  const title = payload.title || "Workout reminder"
  const body = payload.body || "Time for your workout."
  const url = payload.url || "/"

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: "/icon.png",
      badge: "/icon.png",
      data: { url },
    })
  )
})

self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  const target = (event.notification.data && event.notification.data.url) || "/"

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if ("focus" in client) {
            client.navigate(target)
            return client.focus()
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(target)
        }
        return undefined
      })
  )
})
