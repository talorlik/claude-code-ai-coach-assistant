import { createClient } from "@/lib/supabase/server"
import { disablePushSubscription } from "@/lib/db/push-subscriptions"

/**
 * Protected route that disables a browser push subscription for the signed-in
 * client. Authenticates the caller, then soft-disables the row identified by its
 * endpoint (scoped to the caller by RLS), so reminders stop without losing the
 * record. Returns 401 when unauthenticated, 400 when the endpoint is missing,
 * and 200 otherwise.
 */
export async function POST(req: Request): Promise<Response> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return Response.json({ error: "unauthorized" }, { status: 401 })
  }

  const body = (await req.json().catch(() => null)) as {
    endpoint?: unknown
  } | null
  const endpoint =
    body && typeof body.endpoint === "string" ? body.endpoint.trim() : ""
  if (endpoint === "") {
    return Response.json(
      { error: "missingEndpoint", fieldErrors: { endpoint: "required" } },
      { status: 400 }
    )
  }

  await disablePushSubscription(user.id, endpoint)
  return Response.json({ ok: true }, { status: 200 })
}
