import { redirect } from "next/navigation"

import { getCurrentUserRole } from "@/lib/auth/roles"

/**
 * Server-side admin guard for admin layouts, pages, and actions. Redirects
 * unauthenticated users to login and authenticated non-admins to home. Returns
 * the admin user's id when access is granted, so a normal return proves admin
 * access. This is the authoritative check.
 */
export async function requireAdmin(): Promise<string> {
  const { userId, isAdmin } = await getCurrentUserRole()

  if (!userId) {
    redirect("/login")
  }
  if (!isAdmin) {
    redirect("/")
  }

  return userId
}
