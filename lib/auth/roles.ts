import { createClient } from "@/lib/supabase/server"

/**
 * Whether the given user has the admin role. Reads `user_roles` through the
 * request-scoped client; RLS lets a signed-in user read their own role rows.
 * Returns false when `userId` is absent or no admin row exists.
 */
export async function isAdmin(
  userId: string | null | undefined
): Promise<boolean> {
  if (!userId) return false

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle()

  if (error) return false
  return data !== null
}

/**
 * Resolves the current user's id and admin status in one call. Uses `getUser()`
 * (revalidates the session) rather than trusting the unverified cookie.
 */
export async function getCurrentUserRole(): Promise<{
  userId: string | null
  isAdmin: boolean
}> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { userId: null, isAdmin: false }

  return { userId: user.id, isAdmin: await isAdmin(user.id) }
}
