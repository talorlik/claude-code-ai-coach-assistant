import { redirect } from "@/i18n/navigation"
import type { Locale } from "@/i18n/routing"

/**
 * `/register` is an alias for the sign-up tab of the combined auth page. The
 * template merges sign-in and sign-up under `/login`; this thin route keeps the
 * conventional `/[locale]/register` URL reachable by redirecting to the sign-up
 * tab while preserving the active locale.
 */
export default async function RegisterPage({
  params,
}: {
  params: Promise<{ locale: Locale }>
}) {
  const { locale } = await params
  redirect({ href: "/login?tab=signup", locale })
}
