import { isAdmin } from "@/lib/auth/roles"
import { getClient } from "@/lib/db/clients"
import { getActivePlanDetail } from "@/lib/db/workouts"

/**
 * Resolves where a just-authenticated user should land, based purely on their
 * account state. Returns a locale-agnostic in-app path WITHOUT a locale prefix;
 * callers are responsible for applying the active locale (via the locale-aware
 * `redirect` helper for server actions, or by writing the path onto a
 * `NextResponse` redirect URL in a route handler).
 *
 * Decision order (first match wins):
 * 1. Admin -> `/admin` (the trainer console is their home).
 * 2. No onboarding row (`getClient` is `null`) -> `/join` (start onboarding).
 * 3. Onboarded with an active plan -> `/my-plan`.
 * 4. Onboarded but no active plan -> `/join` (re-run onboarding to generate one).
 *
 * The resolver runs under the request-scoped Supabase client, so every lookup is
 * RLS-constrained to the caller's own rows. It deliberately has a single
 * responsibility: it does NOT accept or honor any external `?redirect=` / `next`
 * target. Same-site redirect precedence is handled by the callers (the login
 * action and the email-confirm route) so this function stays small and
 * exhaustively testable.
 *
 * @param userId - The authenticated user's id.
 * @returns A non-localized in-app path: `/admin`, `/join`, or `/my-plan`.
 */
export async function resolvePostAuthDestination(
  userId: string
): Promise<string> {
  if (await isAdmin(userId)) return "/admin"

  const client = await getClient(userId)
  if (client === null) return "/join"

  const activePlan = await getActivePlanDetail(userId)
  if (activePlan !== null) return "/my-plan"

  return "/join"
}
