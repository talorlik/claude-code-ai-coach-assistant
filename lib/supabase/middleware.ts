import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

import {
  REMEMBER_FLAG,
  SESSION_ONLY,
  isAuthCookie,
  stripPersistence,
} from "@/lib/supabase/cookie-persistence"
import { routing } from "@/i18n/routing"

/** Locale-prefixed app sections that require a signed-in user. */
const PROTECTED_SEGMENTS = ["admin", "profile", "chat"] as const

/**
 * Strips a leading supported-locale prefix from a pathname for route matching.
 *
 * With `localePrefix: "always"` every app path is locale-prefixed (`/en/admin`,
 * `/he/profile`), so protection checks must compare against the path *after* the
 * prefix. Returns the locale-free path (always leading-slashed) and the locale
 * that was stripped, or `null` when no supported prefix was present.
 *
 * @param pathname - The request pathname, e.g. `/he/profile`.
 */
function splitLocale(pathname: string): {
  locale: string | null
  rest: string
} {
  const segments = pathname.split("/")
  const maybeLocale = segments[1]
  if (
    maybeLocale &&
    (routing.locales as readonly string[]).includes(maybeLocale)
  ) {
    const rest = "/" + segments.slice(2).join("/")
    return { locale: maybeLocale, rest }
  }
  return { locale: null, rest: pathname }
}

/**
 * Refreshes the Supabase session on every request and enforces route
 * protection, writing auth cookies onto the response produced by the next-intl
 * locale middleware so locale routing and session refresh share one response.
 *
 * Protected routes are an allowlist so new public pages are not accidentally
 * gated. The `/admin`, `/profile`, and `/chat` sections (under any locale
 * prefix) require a signed-in user; everything else (home, login, the auth
 * handlers, the API) is public. When the user opted out of persistent login,
 * auth cookies are stripped of expiry on the response write so a per-request
 * refresh does not silently re-persist the session.
 *
 * @param request - The incoming request.
 * @param response - The response from the next-intl middleware to attach auth
 *   cookies to. When omitted, a fresh `NextResponse.next()` is used, preserving
 *   the original standalone behavior.
 */
export async function updateSession(
  request: NextRequest,
  response?: NextResponse
) {
  const supabaseResponse = response ?? NextResponse.next({ request })

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
          // Write the refreshed auth cookies onto the existing response (the
          // next-intl one when composed) rather than discarding it, so the
          // locale rewrite/redirect headers it carries are preserved.
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

  const { locale, rest } = splitLocale(request.nextUrl.pathname)
  const isProtected = PROTECTED_SEGMENTS.some(
    (segment) => rest === `/${segment}` || rest.startsWith(`/${segment}/`)
  )

  if (!user && isProtected) {
    // Preserve the active locale on the bounce to login so a Hebrew visitor
    // lands on `/he/login`, not the default-locale page.
    const prefix = locale ?? routing.defaultLocale
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = `/${prefix}/login`
    loginUrl.search = ""
    loginUrl.searchParams.set("notice", "signInToContinue")
    return NextResponse.redirect(loginUrl)
  }

  return supabaseResponse
}
