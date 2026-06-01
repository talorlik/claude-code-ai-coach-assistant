import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

import {
  REMEMBER_FLAG,
  SESSION_ONLY,
  isAuthCookie,
  stripPersistence,
} from "@/lib/supabase/cookie-persistence"

/**
 * Request-scoped Supabase client using the publishable key. RLS applies and the
 * client acts on behalf of the signed-in user. When the user opted out of
 * persistent login (the remember-me flag is session-only), auth cookies are
 * forced to session scope on every write so they vanish on browser close.
 */
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            const sessionOnly =
              cookieStore.get(REMEMBER_FLAG)?.value === SESSION_ONLY
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(
                name,
                value,
                sessionOnly && isAuthCookie(name)
                  ? stripPersistence(options)
                  : options
              )
            )
          } catch {
            // Called from a Server Component - middleware handles refresh.
          }
        },
      },
    }
  )
}

/**
 * Privileged server-side client using the secret key. Bypasses RLS. It must NOT
 * read request cookies: @supabase/ssr would parse the user's auth-token cookie
 * and attach it as the Authorization bearer, and PostgREST honors that JWT's
 * role over the secret apikey - silently RLS-scoping the "admin" client to the
 * user. Returning no cookies leaves the secret key as the sole credential, so
 * the role resolves to service_role and RLS is bypassed as intended.
 */
export async function createAdminClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    {
      cookies: {
        getAll() {
          return []
        },
        setAll() {
          // Admin client does not persist sessions.
        },
      },
    }
  )
}
