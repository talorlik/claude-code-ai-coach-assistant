"use client"

import { useTranslations } from "next-intl"

import { submitContactForm } from "@/app/[locale]/contact/actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

/**
 * Localized contact form. Progressive enhancement is the design constraint: it
 * is a real `<form action={submitContactForm}>` with native `type="submit"`,
 * required fields, and `autoComplete` hints, so it submits and validates
 * server-side even with JavaScript disabled - no client handler is required for
 * the form to work. The server action redirects back with a localized
 * notice/error code that the page renders.
 *
 * Accessibility: every control has an associated `<Label htmlFor>` (so it is
 * reachable by name), inputs carry `autoComplete`, and when the page reports a
 * field-level error the relevant inputs receive `aria-invalid`. A hidden
 * honeypot field (`company`, off-screen and `aria-hidden`, never tab-focusable)
 * catches naive bots; the server treats a filled honeypot as silent success.
 *
 * @param hasError - Whether the page is currently showing an error notice. Used
 *   only to set `aria-invalid` on the name/email/message inputs; the visible
 *   status line is rendered by the page, not here.
 */
export function ContactForm({ hasError = false }: { hasError?: boolean }) {
  const t = useTranslations("Contact")

  return (
    <form action={submitContactForm} className="flex flex-col gap-5">
      {/* Honeypot: visually hidden, not announced, not tab-focusable. A real
          user never fills it; a bot that does gets a silent success. */}
      <div aria-hidden="true" className="hidden">
        <Label htmlFor="contact-company">Company</Label>
        <Input
          id="contact-company"
          name="company"
          type="text"
          tabIndex={-1}
          autoComplete="off"
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="contact-name">{t("nameLabel")}</Label>
        <Input
          id="contact-name"
          name="name"
          type="text"
          required
          autoComplete="name"
          placeholder={t("namePlaceholder")}
          aria-invalid={hasError || undefined}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="contact-email">{t("emailFieldLabel")}</Label>
        <Input
          id="contact-email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder={t("emailPlaceholder")}
          aria-invalid={hasError || undefined}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="contact-message">{t("messageLabel")}</Label>
        <Textarea
          id="contact-message"
          name="message"
          required
          rows={5}
          maxLength={5000}
          placeholder={t("messagePlaceholder")}
          aria-invalid={hasError || undefined}
        />
      </div>

      <Button type="submit" className="self-start rounded-full">
        {t("submitLabel")}
      </Button>
    </form>
  )
}
