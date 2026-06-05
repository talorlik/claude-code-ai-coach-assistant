import { createClient } from "@/lib/supabase/server"
import { savePushSubscription } from "@/lib/db/push-subscriptions"
import { isPushConfigured } from "@/lib/push/env"
import { validatePushSubscription } from "@/lib/push/validation"

/**
 * Protected route that stores a browser push subscription for the signed-in
 * client. This is the trust boundary for opt-in: it authenticates the caller
 * (the page guard is not sufficient - a route is independently callable),
 * validates the posted payload, and persists it under the caller's own id so RLS
 * scopes the row to them. Returns:
 *
 * - 401 when unauthenticated,
 * - 503 when VAPID is not configured for the deployment,
 * - 400 when the payload is malformed (nothing is persisted),
 * - 200 with the saved subscription otherwise.
 */
export async function POST(req: Request): Promise<Response> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return Response.json({ error: "unauthorized" }, { status: 401 })
  }

  if (!isPushConfigured()) {
    return Response.json({ error: "pushNotConfigured" }, { status: 503 })
  }

  const raw = await req.json().catch(() => null)
  const validated = validatePushSubscription(raw)
  if (!validated.ok) {
    return Response.json(
      { error: validated.error, fieldErrors: validated.fieldErrors },
      { status: 400 }
    )
  }

  const saved = await savePushSubscription(user.id, validated.data)
  return Response.json({ ok: true, id: saved.id }, { status: 200 })
}
