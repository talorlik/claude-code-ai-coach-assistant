import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { createClient } from "@/lib/supabase/server"
import { ensureProfile } from "@/lib/profile/profile-actions"
import { Button } from "@/components/ui/button"
import { AccountForms } from "./account-forms"

export const metadata: Metadata = {
  title: "My Account",
  robots: { index: false, follow: false },
}

/**
 * Customer account page: editable account settings. Redirects unauthenticated
 * visitors to login.
 */
export default async function ProfilePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  // Guarantee a profile row exists for users created before this flow.
  await ensureProfile(user.id)

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, phone")
    .eq("user_id", user.id)
    .maybeSingle()

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8 px-4 py-12">
      <header className="flex items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-medium">My Account</h1>
          <p className="text-sm text-muted-foreground">{user.email}</p>
        </div>
        <form action="/auth/signout" method="post">
          <Button type="submit" variant="outline" size="sm">
            Sign out
          </Button>
        </form>
      </header>

      <AccountForms
        initialFullName={profile?.full_name ?? ""}
        initialPhone={profile?.phone ?? ""}
        email={user.email ?? ""}
      />
    </div>
  )
}
