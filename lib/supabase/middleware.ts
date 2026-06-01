import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Refreshes the Supabase auth session on every request and keeps the auth
 * cookies in sync between the browser and the server. Call this from the
 * root `proxy.ts` (Next.js 16+ proxy convention).
 *
 * This intentionally does NOT redirect unauthenticated users. Add route
 * protection here once you have a real auth flow (e.g. a `/login` page).
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  // With Fluid compute, don't put this client in a global environment
  // variable. Always create a new one on each request.
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
          Object.entries(headers).forEach(([key, value]) =>
            supabaseResponse.headers.set(key, value),
          );
        },
      },
    },
  );

  // Do not run code between createServerClient and supabase.auth.getClaims().
  // A simple mistake could make it very hard to debug issues with users being
  // randomly logged out.
  //
  // IMPORTANT: If you remove getClaims() and you use server-side rendering with
  // the Supabase client, your users may be randomly logged out.
  await supabase.auth.getClaims();

  // IMPORTANT: You *must* return the supabaseResponse object as it is. If you
  // create a new response object with NextResponse.next() make sure to copy
  // over the cookies, or the browser and server sessions may go out of sync.
  return supabaseResponse;
}
