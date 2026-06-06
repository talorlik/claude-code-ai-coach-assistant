import type { Metadata } from "next"
import { getTranslations, setRequestLocale } from "next-intl/server"

import { requireClient } from "@/lib/auth/require-user"
import { getClient } from "@/lib/db/clients"
import type { Locale } from "@/i18n/routing"
import {
  EMPTY_DEFAULTS,
  OnboardingForm,
  type OnboardingDefaults,
} from "./onboarding-form"

/**
 * Onboarding is a private, per-user flow; keep it out of search indexes. The
 * visible page title is localized via the `Onboarding` namespace; this metadata
 * title is a stable, non-indexed fallback.
 */
export const metadata: Metadata = {
  title: "Join",
  robots: { index: false, follow: false },
}

/**
 * Localized client onboarding page at `/[locale]/join`. `requireClient()` is the
 * authoritative guard: signed-out visitors are redirected to the localized login
 * page before any content renders, so reaching the body proves a session. Any
 * existing `clients` row is loaded and used to prefill the form, which makes the
 * page double as an "edit my onboarding" surface.
 *
 * @param params - The dynamic route params carrying the active locale.
 */
export default async function JoinPage({
  params,
}: {
  params: Promise<{ locale: Locale }>
}) {
  const { locale } = await params
  // Opt into static rendering for this locale before any next-intl hook runs.
  setRequestLocale(locale)

  // Authoritative auth guard; redirects (locale-preserving) when signed out.
  const userId = await requireClient()

  const existing = await getClient(userId)
  const defaults: OnboardingDefaults = existing
    ? {
        fullName: existing.fullName ?? "",
        phone: existing.phone ?? "",
        age: existing.age != null ? String(existing.age) : "",
        ageRange: existing.ageRange ?? "",
        goals: existing.goals ?? [],
        fitnessLevel: existing.fitnessLevel ?? "",
        limitations: existing.limitations ?? "",
        availableDays: existing.availableDays,
        preferredLocation: existing.preferredLocation ?? "",
        equipment: existing.equipment,
        notes: existing.notes ?? "",
      }
    : EMPTY_DEFAULTS

  const t = await getTranslations("Onboarding")

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-12">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">
          {t("title")}
        </h1>
        <p className="text-muted-foreground">{t("subtitle")}</p>
      </header>

      <OnboardingForm defaults={defaults} />
    </main>
  )
}
