import Image from "next/image"
import { getTranslations } from "next-intl/server"
import { Menu } from "lucide-react"

import { Link } from "@/i18n/navigation"
import { createClient } from "@/lib/supabase/server"
import { isAdmin } from "@/lib/auth/roles"
import { ModeToggle } from "@/components/mode-toggle"
import { LanguageSwitcher } from "@/components/language-switcher"
import { InstallPrompt } from "@/components/install-prompt"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"

/**
 * Global top navigation, server-rendered so it reflects the current auth and
 * admin state on every page. The About and Contact links are public and show
 * for every visitor (signed-in or out). Signed-out visitors see a Sign in link;
 * signed-in
 * non-admin clients see a My Plan link (their single client entry point, since
 * the empty `/my-plan` state routes to onboarding) alongside chat and account
 * plus a sign-out control; admins also see Clients (the trainer console) and
 * Admin links instead of My Plan. The brand always links home. All nav links
 * use the
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
  const navLinks = [
    { href: "/about", label: t("about") },
    { href: "/contact", label: t("contact") },
    ...(user && !admin ? [{ href: "/my-plan", label: t("myPlan") }] : []),
    ...(user ? [{ href: "/chat", label: t("chat") }] : []),
    ...(user ? [{ href: "/profile", label: t("account") }] : []),
    ...(admin ? [{ href: "/trainer", label: t("clients") }] : []),
    ...(admin ? [{ href: "/admin", label: t("admin") }] : []),
  ]

  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-4 gap-y-3 px-6 py-3">
        <Link href="/" className="order-1 flex shrink-0 items-center">
          <Image
            src="/logo-light.png"
            alt={common("appName")}
            width={144}
            height={48}
            priority
            className="h-8 w-auto dark:hidden"
          />
          <Image
            src="/logo-dark.png"
            alt=""
            aria-hidden
            width={144}
            height={48}
            priority
            className="hidden h-8 w-auto dark:block"
          />
        </Link>

        <nav
          aria-label={t("mainNavigation")}
          className="order-3 hidden min-w-0 flex-1 items-center gap-4 text-sm md:order-2 md:flex"
        >
          {navLinks.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-md px-1 py-0.5 text-muted-foreground transition-colors hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <InstallPrompt className="order-3 flex basis-full items-center justify-start sm:basis-auto" />

        <div className="order-2 ms-auto flex items-center gap-2 md:order-4">
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
          <Sheet>
            <SheetTrigger
              render={
                <Button variant="outline" size="icon" className="md:hidden">
                  <Menu aria-hidden />
                  <span className="sr-only">{t("openMenu")}</span>
                </Button>
              }
            />
            <SheetContent side="right">
              <SheetHeader>
                <SheetTitle>{t("mainNavigation")}</SheetTitle>
              </SheetHeader>
              <nav
                aria-label={t("mainNavigation")}
                className="flex flex-col gap-1 px-4 pb-4 text-sm"
              >
                {navLinks.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="rounded-md px-2 py-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  )
}
