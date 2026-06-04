"use client"

import { Link } from "@/i18n/navigation"

import { login, signup } from "./actions"
import { CaptchaField } from "@/components/captcha-field"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"

type Props = {
  error?: string
  notice?: string
  defaultTab?: "signin" | "signup"
  redirectTo?: string
}

export function LoginTabs({
  error,
  notice,
  defaultTab = "signin",
  redirectTo,
}: Props) {
  return (
    <Tabs defaultValue={defaultTab} className="w-full">
      <TabsList className="flex w-full gap-1 border-b">
        <TabsTrigger value="signin" className="px-3 py-2 text-sm">
          Sign in
        </TabsTrigger>
        <TabsTrigger value="signup" className="px-3 py-2 text-sm">
          Sign up
        </TabsTrigger>
      </TabsList>

      <TabsContent value="signin" className="pt-5">
        <CredentialsForm
          action={login}
          submitLabel="Sign in"
          formId="signin"
          autoCompletePassword="current-password"
          error={error}
          notice={notice}
          redirectTo={redirectTo}
          showSignInExtras
        />
      </TabsContent>

      <TabsContent value="signup" className="pt-5">
        <CredentialsForm
          action={signup}
          submitLabel="Create account"
          formId="signup"
          autoCompletePassword="new-password"
          error={error}
          notice={notice}
          redirectTo={redirectTo}
        />
      </TabsContent>
    </Tabs>
  )
}

function CredentialsForm({
  action,
  submitLabel,
  formId,
  autoCompletePassword,
  error,
  notice,
  redirectTo,
  showSignInExtras = false,
}: {
  action: (formData: FormData) => Promise<void>
  submitLabel: string
  formId: string
  autoCompletePassword: "current-password" | "new-password"
  error?: string
  notice?: string
  redirectTo?: string
  showSignInExtras?: boolean
}) {
  return (
    <form action={action} className="flex flex-col gap-4">
      {redirectTo ? (
        <input type="hidden" name="redirect" value={redirectTo} />
      ) : null}
      <div className="grid gap-2">
        <Label htmlFor={`email-${formId}`}>Email</Label>
        <Input
          id={`email-${formId}`}
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="you@example.com"
        />
      </div>

      <div className="grid gap-2">
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor={`password-${formId}`}>Password</Label>
          {showSignInExtras ? (
            <Link
              href="/forgot-password"
              className="text-sm text-muted-foreground hover:underline"
            >
              Forgot password?
            </Link>
          ) : null}
        </div>
        <Input
          id={`password-${formId}`}
          name="password"
          type="password"
          autoComplete={autoCompletePassword}
          required
          minLength={8}
          placeholder="At least 8 characters"
        />
      </div>

      {showSignInExtras ? (
        <Label className="flex items-center gap-2 text-sm font-normal">
          <input
            type="checkbox"
            name="remember"
            defaultChecked
            className="size-4 rounded border-input accent-primary"
          />
          Remember me
        </Label>
      ) : null}

      <CaptchaField />

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="text-sm text-muted-foreground">{notice}</p>
      ) : null}

      <Button type="submit" className="w-full">
        {submitLabel}
      </Button>
    </form>
  )
}
