import type { Metadata } from "next"

import { createClient } from "@/lib/supabase/server"
import { ensureProfile } from "@/lib/profile/profile-actions"
import { requireClient } from "@/lib/auth/require-user"
import { AccountForms } from "./account-forms"

export const metadata: Metadata = {
  title: "My Account",
  robots: { index: false, follow: false },
}

/**
 * Customer account page: editable account settings. `requireClient()` redirects
 * unauthenticated visitors to the localized login page, so reaching the body
 * proves a signed-in session.
 */
export default async function ProfilePage() {
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
    .select("full_name, phone")
    .eq("user_id", user.id)
    .maybeSingle()

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8 px-4 py-12">
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl font-medium">My Account</h1>
        <p className="text-sm text-muted-foreground">{user.email}</p>
      </header>

      <AccountForms
        initialFullName={profile?.full_name ?? ""}
        initialPhone={profile?.phone ?? ""}
        email={user.email ?? ""}
      />
    </div>
  )
}
