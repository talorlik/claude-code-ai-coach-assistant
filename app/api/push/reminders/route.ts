import { getCurrentUserRole } from "@/lib/auth/roles"
import {
  disablePushSubscription,
  listAllEnabledSubscriptions,
} from "@/lib/db/push-subscriptions"
import { isPushConfigured } from "@/lib/push/env"
import { sendReminder, type ReminderPayload } from "@/lib/push/web-push"

/**
 * Protected reminder-trigger route, suitable for both Vercel Cron and a manual
 * trainer-admin test. It fans the workout reminder out to every enabled push
 * subscription and disables endpoints the push service reports as gone (404/410)
 * so the table self-heals.
 *
 * Authorization accepts either:
 *
 * - a `Bearer ${CRON_SECRET}` header (Vercel Cron / scheduled invocation), or
 * - an authenticated trainer-admin session (manual test from the dashboard),
 *
 * and rejects everything else with 401. This is the authoritative guard; the
 * RLS policy is the data-layer backstop. The reminder body is intentionally
 * generic - it carries NO injury or medical detail, since a push payload can be
 * shown on a lock screen.
 */

/** Allow the fan-out to run a little longer than a single request default. */
export const maxDuration = 30

/**
 * Returns whether the request is authorized to trigger reminders, via the cron
 * secret header or a trainer-admin session.
 */
async function isAuthorized(req: Request): Promise<boolean> {
  const cronSecret = process.env.CRON_SECRET ?? ""
  const authHeader = req.headers.get("authorization") ?? ""
  if (cronSecret !== "" && authHeader === `Bearer ${cronSecret}`) {
    return true
  }
  // Fall back to a trainer-admin session for manual testing.
  const { isAdmin } = await getCurrentUserRole()
  return isAdmin
}

/**
 * Builds the locale-aware, non-sensitive reminder payload. Copy is resolved from
 * the request locale hint (`?locale=he`), defaulting to English. No client data
 * is included.
 */
function buildPayload(locale: string): ReminderPayload {
  const he = locale === "he"
  return {
    title: he ? "תזכורת אימון" : "Workout reminder",
    body: he
      ? "הגיע הזמן לאימון של היום. כל הכבוד שאתה ממשיך."
      : "Time for today's session. Keep up the great work.",
    url: he ? "/he/my-plan" : "/en/my-plan",
  }
}

/**
 * Shared reminder-trigger handler. See the module doc for the authorization and
 * payload contract. Returns 401/503 on guard failures, otherwise a summary of
 * how many notifications were sent and how many dead endpoints were pruned.
 */
async function handleReminderTrigger(req: Request): Promise<Response> {
  if (!(await isAuthorized(req))) {
    return Response.json({ error: "unauthorized" }, { status: 401 })
  }

  if (!isPushConfigured()) {
    return Response.json({ error: "pushNotConfigured" }, { status: 503 })
  }

  const locale = new URL(req.url).searchParams.get("locale") ?? "en"
  const payload = buildPayload(locale)
  const subscriptions = await listAllEnabledSubscriptions()

  let sent = 0
  let pruned = 0
  for (const row of subscriptions) {
    const result = await sendReminder(row, payload)
    if (result.ok) {
      sent += 1
    } else if (result.gone) {
      // The endpoint is permanently gone; disable it so we stop retrying.
      await disablePushSubscription(row.client_id, row.endpoint)
      pruned += 1
    }
  }

  return Response.json(
    { ok: true, total: subscriptions.length, sent, pruned },
    { status: 200 }
  )
}

/**
 * GET entry point. Vercel Cron invokes scheduled routes with GET and the
 * `Bearer ${CRON_SECRET}` header, so the daily reminder fan-out lands here.
 */
export async function GET(req: Request): Promise<Response> {
  return handleReminderTrigger(req)
}

/**
 * POST entry point for manual triggering (e.g. a trainer-admin "send now" test),
 * authorized via an admin session. Shares the GET logic.
 */
export async function POST(req: Request): Promise<Response> {
  return handleReminderTrigger(req)
}
