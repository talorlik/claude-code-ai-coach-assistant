/*
 * Service worker for Web Push workout reminders.
 *
 * Served statically from /sw.js and registered by the client-side reminder
 * settings component. It handles two events:
 *
 *  - `push`: shows the notification using the JSON payload sent by the server
 *    (`{ title, body, url }`). The payload is intentionally non-sensitive - it
 *    carries no injury or medical detail.
 *  - `notificationclick`: focuses an existing app tab if one is open, otherwise
 *    opens the deep link the payload provided.
 *
 * This file is plain JavaScript on purpose: it runs in the ServiceWorker global
 * scope, not in the app bundle, so it is excluded from the TypeScript build.
 */

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
