import createMiddleware from "next-intl/middleware"
import { NextResponse, type NextRequest } from "next/server"

import { updateSession } from "@/lib/supabase/middleware"
import { routing } from "@/i18n/routing"

// Next.js 16+ proxy convention (replaces the deprecated `middleware` file).
// The file must be named `proxy.ts` and export a function named `proxy`.
//
// This proxy COMPOSES two concerns into one response:
//   1. next-intl locale routing (`/` -> `/en`, unsupported locale -> default,
//      locale prefix enforcement and detection).
//   2. Supabase session refresh + route protection (`updateSession`).
//
// The locale middleware runs first. On a redirect (e.g. `/` -> `/en`) its
// response is returned as-is; no session refresh is needed for a bounce. On a
// normal pass-through (including next-intl's internal rewrite to `/[locale]/…`)
// its response becomes the base that `updateSession` writes auth cookies onto,
// so locale headers and refreshed session cookies travel together.
const handleI18nRouting = createMiddleware(routing)

/** Path prefixes that must bypass locale routing: API and Supabase auth handlers. */
function bypassesLocale(pathname: string): boolean {
  return pathname.startsWith("/api") || pathname.startsWith("/auth")
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // API routes and the Supabase auth callback/sign-out handlers are not
  // localized. Skip locale routing for them but still refresh the session so
  // the chat API and auth handlers see a current user.
  if (bypassesLocale(pathname)) {
    return await updateSession(request)
  }

  const i18nResponse = handleI18nRouting(request)

  // A redirect (3xx) means next-intl is steering the browser to a locale URL;
  // honor it without a session refresh on this throwaway request.
  if (i18nResponse.status >= 300 && i18nResponse.status < 400) {
    return i18nResponse
  }

  // Pass-through (status 200, typically carrying an internal rewrite to the
  // `[locale]` segment): refresh the session onto this same response so the
  // locale rewrite and auth cookies are preserved together.
  return await updateSession(request, i18nResponse as NextResponse)
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - image files
     * Feel free to modify this pattern to include more paths.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
