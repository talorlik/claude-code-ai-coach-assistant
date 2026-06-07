import * as React from "react"

import {
  updateProfileForm,
  updateEmailForm,
  updatePasswordForm,
} from "@/lib/profile/profile-actions"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { SubmitButton } from "./submit-button"

/**
 * One settings group: a hairline-divided block with a title, muted description,
 * and the form body.
 */
function SettingsSection({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <section className="border-t pt-6">
      <h2 className="text-lg font-medium">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      <div className="mt-4">{children}</div>
    </section>
  )
}

/**
 * Editable account forms: contact details, email change, and password change.
 * Each form binds a FormData-accepting server action directly to its
 * `<form action={...}>`, so it submits and reports a result even with
 * JavaScript disabled - the action redirects back to `/profile` with a
 * `?notice`/`?error` code that the page renders as a localized banner. With
 * JavaScript present React re-runs the same action over fetch, and the
 * {@link SubmitButton} adds a pending affordance. This is a Server Component;
 * the only client island is the submit button.
 */
export function AccountForms({
  initialFullName,
  initialPhone,
  email,
}: {
  initialFullName: string
  initialPhone: string
  email: string
}) {
  return (
    <div className="flex flex-col gap-8">
      <SettingsSection
        title="Contact details"
        description="Your name and phone number."
      >
        <form action={updateProfileForm} className="flex flex-col gap-4">
          <div className="grid gap-2">
            <Label htmlFor="fullName">Full name</Label>
            <Input
              id="fullName"
              name="fullName"
              defaultValue={initialFullName}
              required
              minLength={2}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              name="phone"
              type="tel"
              defaultValue={initialPhone}
              inputMode="tel"
            />
          </div>
          <SubmitButton label="Save details" pendingLabel="Saving…" />
        </form>
      </SettingsSection>

      <SettingsSection
        title="Email"
        description="Changing your email requires confirmation via a link."
      >
        <form action={updateEmailForm} className="flex flex-col gap-4">
          <div className="grid gap-2">
            <Label htmlFor="email">Email address</Label>
            <Input
              id="email"
              name="email"
              type="email"
              defaultValue={email}
              required
            />
          </div>
          <SubmitButton label="Update email" pendingLabel="Updating…" />
        </form>
      </SettingsSection>

      <SettingsSection
        title="Password"
        description="Choose a new password for your account."
      >
        <form action={updatePasswordForm} className="flex flex-col gap-4">
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
          <SubmitButton label="Update password" pendingLabel="Updating…" />
        </form>
      </SettingsSection>
    </div>
  )
}
