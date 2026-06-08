import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { createClient } from "@/lib/supabase/server"
import { ensureProfile } from "@/lib/profile/profile-actions"
import { resolveAccountMessage } from "@/lib/profile/resolve-account-message"
import { requireClient } from "@/lib/auth/require-user"
import { getClient } from "@/lib/db/clients"
import { listOnboardingSnapshots } from "@/lib/db/onboarding-snapshots"
import { saveOnboardingDetails } from "@/lib/onboarding/onboarding-actions"
import {
  OnboardingDetailsForm,
  clientToDefaults,
} from "@/components/onboarding/onboarding-details-form"
import { OnboardingHistory } from "@/components/onboarding/onboarding-history"
import { RegenerateMyPlan } from "@/app/[locale]/my-plan/regenerate-my-plan"
import { AccountForms } from "./account-forms"

export const metadata: Metadata = {
  title: "My Account",
  robots: { index: false, follow: false },
}

/**
 * Customer account page: editable account settings. `requireClient()` redirects
 * unauthenticated visitors to the localized login page, so reaching the body
 * proves a signed-in session.
 *
 * The account forms submit via FormData server actions that redirect back here
 * with a `?notice`/`?error` code; this component resolves that code to localized
 * copy and renders it as a server-side banner, so feedback is visible even with
 * JavaScript disabled.
 *
 * @param searchParams - The page query (a Promise in Next 16); carries the
 *   `notice`/`error` feedback codes set by the form actions.
 */
export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; error?: string }>
}) {
  // Authoritative auth guard; redirects (locale-preserving) when signed out.
  await requireClient()

  const supabase = await createClient()
  // getUser() is request-cached by @supabase/ssr, so this does not re-hit the
  // network after the guard. We need the row again here for the email and id.
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  // Guarantee a profile row exists for users created before this flow.
  await ensureProfile(user.id)

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, phone, country_iso2")
    .eq("user_id", user.id)
    .maybeSingle()

  // Onboarding details + history. A client who has not onboarded yet has no row;
  // the section is hidden in that case (they complete onboarding via /join).
  const client = await getClient(user.id)
  const snapshots = client ? await listOnboardingSnapshots(user.id) : []

  // Resolve the post-submit feedback code (set by the form actions' redirect)
  // to localized copy. Only allowlisted codes resolve, so a forged query param
  // renders nothing.
  const sp = await searchParams
  const t = await getTranslations("Account")
  const tOnboarding = await getTranslations("AccountOnboarding")
  const notice = resolveAccountMessage(t, sp.notice)
  const error = resolveAccountMessage(t, sp.error)

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8 px-4 py-12">
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl font-medium">My Account</h1>
        <p className="text-sm text-muted-foreground">{user.email}</p>
      </header>

      {notice ? (
        <p className="text-sm text-green-600" role="status">
          {notice}
        </p>
      ) : null}
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <AccountForms
        initialFullName={profile?.full_name ?? ""}
        initialPhone={profile?.phone ?? ""}
        initialCountryIso2={profile?.country_iso2 ?? ""}
        email={user.email ?? ""}
      />

      {client ? (
        <>
          <section className="flex flex-col gap-4">
            <header className="flex flex-col gap-1">
              <h2 className="text-xl font-medium">
                {tOnboarding("onboardingTitle")}
              </h2>
              <p className="text-sm text-muted-foreground">
                {tOnboarding("onboardingDescription")}
              </p>
            </header>
            <OnboardingDetailsForm
              defaults={clientToDefaults(client)}
              onSave={saveOnboardingDetails}
              regenerateSlot={<RegenerateMyPlan />}
            />
          </section>

          <section className="flex flex-col gap-4">
            <header className="flex flex-col gap-1">
              <h2 className="text-xl font-medium">
                {tOnboarding("historyTitle")}
              </h2>
              <p className="text-sm text-muted-foreground">
                {tOnboarding("historyDescription")}
              </p>
            </header>
            <OnboardingHistory snapshots={snapshots} />
          </section>
        </>
      ) : null}
    </div>
  )
}
