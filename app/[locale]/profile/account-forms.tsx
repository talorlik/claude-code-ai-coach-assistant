import * as React from "react"
import { getTranslations } from "next-intl/server"

import {
  updateProfileForm,
  updateEmailForm,
  updatePasswordForm,
} from "@/lib/profile/profile-actions"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PhoneFieldUncontrolled } from "@/components/phone-field"
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
 * {@link SubmitButton} adds a pending affordance. This is an async Server
 * Component; the only client island is the submit button.
 *
 * All user-facing copy is resolved server-side from the `Account` message
 * namespace via {@link getTranslations}, so the forms render in the active
 * locale (English/Hebrew, RTL-aware) rather than a hardcoded language.
 */
export async function AccountForms({
  initialFullName,
  initialPhone,
  initialCountryIso2,
  email,
}: {
  initialFullName: string
  initialPhone: string
  initialCountryIso2: string
  email: string
}) {
  const t = await getTranslations("Account")
  return (
    <div className="flex flex-col gap-8">
      <SettingsSection
        title={t("contactTitle")}
        description={t("contactDescription")}
      >
        <form action={updateProfileForm} className="flex flex-col gap-4">
          <div className="grid gap-2">
            <Label htmlFor="fullName">{t("fullNameLabel")}</Label>
            <Input
              id="fullName"
              name="fullName"
              defaultValue={initialFullName}
              required
              minLength={2}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="phone-national">{t("phoneLabel")}</Label>
            <PhoneFieldUncontrolled
              id="phone-national"
              initialPhone={initialPhone}
              initialCountryIso2={initialCountryIso2}
              searchPlaceholder={t("countrySearchPlaceholder")}
              emptyText={t("countrySearchEmpty")}
            />
          </div>
          <SubmitButton label={t("saveDetails")} pendingLabel={t("saving")} />
        </form>
      </SettingsSection>

      <SettingsSection
        title={t("emailTitle")}
        description={t("emailDescription")}
      >
        <form action={updateEmailForm} className="flex flex-col gap-4">
          <div className="grid gap-2">
            <Label htmlFor="email">{t("emailLabel")}</Label>
            <Input
              id="email"
              name="email"
              type="email"
              defaultValue={email}
              required
            />
          </div>
          <SubmitButton
            label={t("updateEmail")}
            pendingLabel={t("updatingEmail")}
          />
        </form>
      </SettingsSection>

      <SettingsSection
        title={t("passwordTitle")}
        description={t("passwordDescription")}
      >
        <form action={updatePasswordForm} className="flex flex-col gap-4">
          <div className="grid gap-2">
            <Label htmlFor="password">{t("newPasswordLabel")}</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              placeholder={t("passwordPlaceholder")}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="confirmPassword">
              {t("confirmPasswordLabel")}
            </Label>
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              placeholder={t("passwordPlaceholder")}
            />
          </div>
          <SubmitButton
            label={t("updatePassword")}
            pendingLabel={t("updatingPassword")}
          />
        </form>
      </SettingsSection>
    </div>
  )
}
