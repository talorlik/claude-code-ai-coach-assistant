import { requireTrainerAdmin } from "@/lib/auth/require-user"

/**
 * Back-compatible alias for {@link requireTrainerAdmin}, the canonical
 * trainer-admin guard. Retained so the existing admin layout keeps working; new
 * code should call `requireTrainerAdmin` directly. Redirects unauthenticated
 * users to login and authenticated non-admins to home, preserving the active
 * locale, and returns the admin user's id on success.
 */
export async function requireAdmin(): Promise<string> {
  return requireTrainerAdmin()
}
