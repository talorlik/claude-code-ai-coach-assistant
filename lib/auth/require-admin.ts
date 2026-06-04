import { getLocale } from "next-intl/server"

import { redirect } from "@/i18n/navigation"
import { getCurrentUserRole } from "@/lib/auth/roles"

/**
 * Server-side admin guard for admin layouts, pages, and actions. Redirects
 * unauthenticated users to login and authenticated non-admins to home,
 * preserving the active locale. Returns the admin user's id when access is
 * granted, so a normal return proves admin access. This is the authoritative
 * check.
 */
export async function requireAdmin(): Promise<string> {
  const locale = await getLocale()
  const { userId, isAdmin } = await getCurrentUserRole()

  if (!userId) {
    return redirect({ href: "/login", locale })
  }
  if (!isAdmin) {
    return redirect({ href: "/", locale })
  }

  return userId
}
