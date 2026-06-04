import { Sparkles } from "lucide-react"
import { getTranslations } from "next-intl/server"

import { Link } from "@/i18n/navigation"
import { createClient } from "@/lib/supabase/server"
import { isAdmin } from "@/lib/auth/roles"
import { ModeToggle } from "@/components/mode-toggle"
import { LanguageSwitcher } from "@/components/language-switcher"
import { Button, buttonVariants } from "@/components/ui/button"

/**
 * Global top navigation, server-rendered so it reflects the current auth and
 * admin state on every page. Signed-out visitors see a Sign in link; signed-in
 * users see links to their chat and account plus a sign-out control; admins also
 * see Clients (the trainer console) and Admin links. The brand always links
 * home. All nav links use the
 * locale-aware {@link Link} so they preserve the active language, and labels
 * come from the `Nav` message namespace.
 *
 * Sign-out posts to the non-localized /auth/signout route (POST so it cannot be
 * triggered by a cross-site navigation or prefetch).
 */
export async function SiteHeader() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const admin = user ? await isAdmin(user.id) : false
  const t = await getTranslations("Nav")
  const common = await getTranslations("Common")

  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-3">
        <nav className="flex items-center gap-4 text-sm">
          <Link
            href="/"
            className="flex shrink-0 items-center gap-2 font-semibold"
          >
            <Sparkles className="h-5 w-5 text-primary" />
            {common("appName")}
          </Link>
          {user ? (
            <Link href="/chat" className="hover:underline">
              {t("chat")}
            </Link>
          ) : null}
          {user ? (
            <Link href="/profile" className="hover:underline">
              {t("account")}
            </Link>
          ) : null}
          {admin ? (
            <Link href="/trainer" className="hover:underline">
              {t("clients")}
            </Link>
          ) : null}
          {admin ? (
            <Link href="/admin" className="hover:underline">
              {t("admin")}
            </Link>
          ) : null}
        </nav>

        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          <ModeToggle />
          {user ? (
            <form action="/auth/signout" method="post">
              <Button type="submit" variant="outline" size="sm">
                {t("signOut")}
              </Button>
            </form>
          ) : (
            <Link
              href="/login"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              {t("signIn")}
            </Link>
          )}
        </div>
      </div>
    </header>
  )
}
