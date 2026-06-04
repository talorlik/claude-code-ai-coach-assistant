import type { Metadata } from "next"

import { redirect } from "@/i18n/navigation"
import { createClient } from "@/lib/supabase/server"
import { resolveAuthMessage } from "@/lib/auth/resolve-auth-message"
import { setNewPassword } from "./actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { Locale } from "@/i18n/routing"

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default async function ResetPasswordPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>
  searchParams: Promise<{ error?: string; notice?: string }>
}) {
  const { locale } = await params
  const sp = await searchParams
  const errorMessage = resolveAuthMessage(sp.error)

  // The recovery link routes through /auth/confirm, which establishes a session
  // before redirecting here. Without one the link was invalid, expired, or
  // already used, so bounce back to the request form.
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return redirect({ href: `/forgot-password?error=resetLinkInvalid`, locale })
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-background px-4 py-12 text-foreground">
      <div className="w-full max-w-sm rounded-lg border bg-card p-8">
        <div className="flex flex-col items-center gap-2 text-center">
          <h1 className="text-xl font-medium">New password</h1>
          <p className="text-sm text-muted-foreground">
            Choose a new password for your account.
          </p>
        </div>

        <form action={setNewPassword} className="mt-6 flex flex-col gap-4">
          <div className="grid gap-2">
            <Label htmlFor="password">New password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              placeholder="At least 8 characters"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="confirmPassword">Confirm new password</Label>
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              placeholder="At least 8 characters"
            />
          </div>

          {errorMessage ? (
            <p className="text-sm text-destructive" role="alert">
              {errorMessage}
            </p>
          ) : null}

          <Button type="submit" className="w-full">
            Set new password
          </Button>
        </form>
      </div>
    </div>
  )
}
