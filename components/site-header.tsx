import Link from "next/link"
import { Sparkles } from "lucide-react"

import { createClient } from "@/lib/supabase/server"
import { isAdmin } from "@/lib/auth/roles"
import { ModeToggle } from "@/components/mode-toggle"
import { Button, buttonVariants } from "@/components/ui/button"

/**
 * Global top navigation, server-rendered so it reflects the current auth and
 * admin state on every page. Signed-out visitors see a Sign in link; signed-in
 * users see links to their chat and account plus a sign-out control; admins also
 * see an Admin link. The brand always links home.
 *
 * Sign-out posts to the /auth/signout route (POST so it cannot be triggered by a
 * cross-site navigation or prefetch).
 */
export async function SiteHeader() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const admin = user ? await isAdmin(user.id) : false

  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-3">
        <nav className="flex items-center gap-4 text-sm">
          <Link
            href="/"
            className="flex shrink-0 items-center gap-2 font-semibold"
          >
            <Sparkles className="h-5 w-5 text-primary" />
            AI Coach
          </Link>
          {user ? (
            <Link href="/chat" className="hover:underline">
              Chat
            </Link>
          ) : null}
          {user ? (
            <Link href="/profile" className="hover:underline">
              My Account
            </Link>
          ) : null}
          {admin ? (
            <Link href="/admin" className="hover:underline">
              Admin
            </Link>
          ) : null}
        </nav>

        <div className="flex items-center gap-2">
          <ModeToggle />
          {user ? (
            <form action="/auth/signout" method="post">
              <Button type="submit" variant="outline" size="sm">
                Sign out
              </Button>
            </form>
          ) : (
            <Link
              href="/login"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  )
}
