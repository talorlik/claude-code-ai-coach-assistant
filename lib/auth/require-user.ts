import { getLocale } from "next-intl/server"

import { redirect } from "@/i18n/navigation"
import { getCurrentUserRole } from "@/lib/auth/roles"

/**
 * Server-side guard requiring any authenticated user. Redirects signed-out
 * visitors to the localized login page, carrying a `signInToContinue` notice,
 * and preserving the active locale. Returns the user's id on success, so a
 * normal return proves an authenticated session.
 *
 * Use this at the top of any layout, page, or server action that must be
 * reachable only by a signed-in user. Authorization (role) is a separate
 * concern: see {@link requireClient} and {@link requireTrainerAdmin}.
 *
 * @returns The authenticated user's id.
 */
export async function requireUser(): Promise<string> {
  const locale = await getLocale()
  const { userId } = await getCurrentUserRole()

  if (!userId) {
    return redirect({ href: "/login?notice=signInToContinue", locale })
  }

  return userId
}

/**
 * Server-side guard for client-facing pages (onboarding, my-plan, logging,
 * chat). Every authenticated user is a client: the role enum has only `admin`
 * and the default `customer`, and the trainer admin is also permitted to view
 * client surfaces. So this currently requires only an authenticated session and
 * is a named alias of {@link requireUser} that documents intent at call sites.
 *
 * It is kept distinct from `requireUser` so that if a future role (e.g. a
 * read-only auditor) is added, client-only gating can tighten here without
 * touching every page.
 *
 * @returns The authenticated user's id.
 */
export async function requireClient(): Promise<string> {
  return requireUser()
}

/**
 * Server-side guard for trainer-admin surfaces (the `/admin` subtree). Redirects
 * signed-out visitors to the localized login page and authenticated non-admins
 * to the localized home page, preserving the active locale. Returns the admin
 * user's id on success.
 *
 * "Trainer admin" maps to the `admin` role in `user_roles` (the role enum is
 * `admin | customer`); the policy-callable `is_trainer_admin()` SQL function
 * uses the same mapping. This is the authoritative server-side authorization
 * check for trainer routes.
 *
 * @returns The authenticated admin user's id.
 */
export async function requireTrainerAdmin(): Promise<string> {
  const locale = await getLocale()
  const { userId, isAdmin } = await getCurrentUserRole()

  if (!userId) {
    return redirect({ href: "/login?notice=signInToContinue", locale })
  }
  if (!isAdmin) {
    return redirect({ href: "/", locale })
  }

  return userId
}
