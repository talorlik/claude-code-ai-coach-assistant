"use server"

import { getLocale } from "next-intl/server"

import { redirect } from "@/i18n/navigation"
import { createAdminClient } from "@/lib/supabase/server"
import { isValidEmail } from "@/lib/auth/validation"

/** Field name of the hidden anti-spam honeypot. A real user never fills it. */
const HONEYPOT_FIELD = "company"

/** Caps the stored/forwarded message so a bot cannot post an unbounded body. */
const MAX_MESSAGE_LENGTH = 5000

/**
 * Handles a contact-form submission. Progressive-enhancement friendly: it is a
 * plain `<form action>` target, so it runs identically with or without client
 * JavaScript.
 *
 * Flow:
 * 1. If the hidden honeypot field is filled, the submitter is almost certainly a
 *    bot - return a silent success (the redirect looks identical to a real send)
 *    so the bot gets no signal, and never invoke the email function.
 * 2. Validate name, email, and message; redirect back with a localized error
 *    code on the first failure.
 * 3. Invoke the `contact` Supabase Edge Function through the secret-key admin
 *    client (the SMTP credentials live as function secrets, never in app code).
 *    The invoke is wrapped so a transport error or a non-OK response is logged
 *    and turned into a localized `send_failed` notice - it must never throw to
 *    the request or fail the build, so the gate stays green without secrets
 *    configured in CI.
 * 4. On success, redirect back with `?notice=contact_sent`.
 *
 * All redirects use the locale-aware {@link redirect} so the active language is
 * preserved.
 *
 * @param formData - The submitted form fields (`name`, `email`, `message`, and
 *   the honeypot).
 */
export async function submitContactForm(formData: FormData): Promise<void> {
  const locale = await getLocale()
  const back = (param: string) =>
    redirect({ href: `/contact?${param}`, locale })

  // 1. Honeypot: a filled hidden field means a bot. Pretend success.
  if (String(formData.get(HONEYPOT_FIELD) ?? "").trim() !== "") {
    return back("notice=contact_sent")
  }

  const name = String(formData.get("name") ?? "").trim()
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase()
  const message = String(formData.get("message") ?? "")
    .trim()
    .slice(0, MAX_MESSAGE_LENGTH)

  // 2. Validation.
  if (!name || !email || !message) {
    return back("error=missing_fields")
  }
  if (!isValidEmail(email)) {
    return back("error=invalid_email")
  }

  // 3. Deliver via the Edge Function. Degrade gracefully on any failure.
  let delivered = false
  try {
    const admin = await createAdminClient()
    const { error } = await admin.functions.invoke("contact", {
      body: { name, email, message },
    })
    if (error) {
      console.error("contact: edge function invoke returned error", error)
    } else {
      delivered = true
    }
  } catch (cause) {
    // Missing secrets, network failure, or function not deployed: log, do not
    // throw. The request still completes with a localized error.
    console.error("contact: edge function invoke failed", cause)
  }

  // 4. Redirect with the localized outcome.
  return back(delivered ? "notice=contact_sent" : "error=send_failed")
}
