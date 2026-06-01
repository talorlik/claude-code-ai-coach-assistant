import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

import {
  REMEMBER_FLAG,
  SESSION_ONLY,
  isAuthCookie,
  stripPersistence,
} from "@/lib/supabase/cookie-persistence"

/**
 * Refreshes the Supabase session on every request and enforces route
 * protection. Called from the root `proxy.ts`.
 *
 * Protected routes are an allowlist so new public pages are not accidentally
 * gated. `/admin`, `/profile`, and `/chat` require a signed-in user; everything
 * else (home, login, the auth handlers, the API) is public. When the user opted
 * out of persistent login, auth cookies are stripped of expiry on the response
 * write so a per-request refresh does not silently re-persist the session.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          const sessionOnly =
            request.cookies.get(REMEMBER_FLAG)?.value === SESSION_ONLY
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(
              name,
              value,
              sessionOnly && isAuthCookie(name)
                ? stripPersistence(options)
                : options
            )
          )
        },
      },
    }
  )

  // IMPORTANT: do not run code between createServerClient and getUser.
  // getUser refreshes the session if expired; skipping it risks random logouts.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname
  const isProtected =
    pathname === "/admin" ||
    pathname.startsWith("/admin/") ||
    pathname === "/profile" ||
    pathname.startsWith("/profile/") ||
    pathname === "/chat" ||
    pathname.startsWith("/chat/")

  if (!user && isProtected) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = "/login"
    loginUrl.search = ""
    loginUrl.searchParams.set("notice", "signInToContinue")
    return NextResponse.redirect(loginUrl)
  }

  return supabaseResponse
}
