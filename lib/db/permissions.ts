/**
 * Pure permission helpers that mirror the RLS ownership model in
 * `supabase/migrations/0002_app_schema.sql`. RLS in Postgres is the
 * authoritative guard; these functions let server code make the same
 * allow/deny decision in application logic (for early rejection, clearer error
 * messages, and unit testing) without a round trip. They never replace RLS.
 */

/** The viewer making a request: their auth user id and trainer-admin status. */
export interface Viewer {
  userId: string | null
  isTrainerAdmin: boolean
}

/**
 * Whether the viewer is the owning client identified by `ownerId`, or a trainer
 * admin. This is the application-side mirror of the common
 * `auth.uid() = client_id or is_trainer_admin()` RLS predicate.
 */
export function canAccessClientResource(
  viewer: Viewer,
  ownerId: string
): boolean {
  if (viewer.isTrainerAdmin) return true
  return viewer.userId !== null && viewer.userId === ownerId
}

/**
 * Whether the viewer may read or write trainer-only data (plan templates and
 * trainer notes). Only the trainer admin qualifies; clients never do.
 */
export function canAccessTrainerOnlyResource(viewer: Viewer): boolean {
  return viewer.isTrainerAdmin
}

/**
 * Whether the viewer may read a client's private trainer notes. Clients must
 * never read these, so this is trainer-admin only regardless of ownership.
 */
export function canReadTrainerNotes(viewer: Viewer): boolean {
  return viewer.isTrainerAdmin
}
