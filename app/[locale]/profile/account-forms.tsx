"use client"

import * as React from "react"

import {
  updateProfile,
  updateEmail,
  updatePassword,
} from "@/lib/profile/profile-actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type Feedback = { ok: boolean; message: string } | null

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

function FormFeedback({ feedback }: { feedback: Feedback }) {
  if (!feedback) return null
  return (
    <p
      className={
        feedback.ok ? "text-sm text-green-600" : "text-sm text-destructive"
      }
      role={feedback.ok ? "status" : "alert"}
    >
      {feedback.message}
    </p>
  )
}

/**
 * Editable account forms: contact details, email change, and password change.
 * Each form submits to its server action and shows inline feedback.
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
      <ContactDetailsForm
        initialFullName={initialFullName}
        initialPhone={initialPhone}
      />
      <EmailForm currentEmail={email} />
      <PasswordForm />
    </div>
  )
}

function ContactDetailsForm({
  initialFullName,
  initialPhone,
}: {
  initialFullName: string
  initialPhone: string
}) {
  const [feedback, setFeedback] = React.useState<Feedback>(null)
  const [pending, setPending] = React.useState(false)

  async function onSubmit(formData: FormData) {
    setPending(true)
    const result = await updateProfile({
      fullName: String(formData.get("fullName") ?? ""),
      phone: String(formData.get("phone") ?? ""),
    })
    setPending(false)
    setFeedback(
      result.ok
        ? { ok: true, message: "Details saved." }
        : { ok: false, message: result.error }
    )
  }

  return (
    <SettingsSection
      title="Contact details"
      description="Your name and phone number."
    >
      <form action={onSubmit} className="flex flex-col gap-4">
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
        <FormFeedback feedback={feedback} />
        <Button type="submit" disabled={pending} className="w-fit">
          {pending ? "Saving…" : "Save details"}
        </Button>
      </form>
    </SettingsSection>
  )
}

function EmailForm({ currentEmail }: { currentEmail: string }) {
  const [feedback, setFeedback] = React.useState<Feedback>(null)
  const [pending, setPending] = React.useState(false)

  async function onSubmit(formData: FormData) {
    setPending(true)
    const result = await updateEmail(String(formData.get("email") ?? ""))
    setPending(false)
    setFeedback(
      result.ok
        ? {
            ok: true,
            message: "Check your inbox to confirm the new email address.",
          }
        : { ok: false, message: result.error }
    )
  }

  return (
    <SettingsSection
      title="Email"
      description="Changing your email requires confirmation via a link."
    >
      <form action={onSubmit} className="flex flex-col gap-4">
        <div className="grid gap-2">
          <Label htmlFor="email">Email address</Label>
          <Input
            id="email"
            name="email"
            type="email"
            defaultValue={currentEmail}
            required
          />
        </div>
        <FormFeedback feedback={feedback} />
        <Button type="submit" disabled={pending} className="w-fit">
          {pending ? "Updating…" : "Update email"}
        </Button>
      </form>
    </SettingsSection>
  )
}

function PasswordForm() {
  const [feedback, setFeedback] = React.useState<Feedback>(null)
  const [pending, setPending] = React.useState(false)

  async function onSubmit(formData: FormData) {
    const password = String(formData.get("password") ?? "")
    const confirmPassword = String(formData.get("confirmPassword") ?? "")

    if (password !== confirmPassword) {
      setFeedback({ ok: false, message: "Passwords do not match." })
      return
    }

    setPending(true)
    const result = await updatePassword(password)
    setPending(false)
    setFeedback(
      result.ok
        ? { ok: true, message: "Password updated." }
        : { ok: false, message: result.error }
    )
  }

  return (
    <SettingsSection
      title="Password"
      description="Choose a new password for your account."
    >
      <form action={onSubmit} className="flex flex-col gap-4">
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
        <FormFeedback feedback={feedback} />
        <Button type="submit" disabled={pending} className="w-fit">
          {pending ? "Updating…" : "Update password"}
        </Button>
      </form>
    </SettingsSection>
  )
}
