/**
 * Supabase Edge Function `contact`.
 *
 * Receives a validated contact-form payload from the `submitContactForm` server
 * action (invoked through the secret-key admin client) and forwards it as an
 * email to the studio inbox over Gmail SMTP. All credentials are read from
 * function secrets - never from the browser or the app bundle - set with
 * `supabase secrets set` (see docs/DECISIONS.md). The Gmail `SMTP_PASSWORD` must
 * be a Gmail App Password, not the account password.
 *
 * Contract:
 * - Request body: `{ name: string, email: string, message: string }`.
 * - 200 `{ ok: true }` on send; 400 `{ ok: false, error }` on a bad payload;
 *   500 `{ ok: false, error }` on a send/transport failure.
 *
 * Runtime: Deno (Supabase Edge Functions). The npm/std imports below resolve at
 * deploy time, so this file is not part of the Next.js TypeScript program (it is
 * excluded from `tsconfig`); the app build never type-checks Deno globals.
 */

// @ts-expect-error - Deno std remote import, resolved by the edge runtime only.
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts"

/** Shape of the validated contact payload. */
interface ContactPayload {
  name: string
  email: string
  message: string
}

/** Minimal server-side email-shape check, independent of the app validator. */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** CORS headers - the function is invoked server-to-server, but allow preflight. */
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

/** JSON response helper carrying the CORS headers. */
function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  })
}

/** Validates and narrows an unknown request body to a {@link ContactPayload}. */
function parsePayload(input: unknown): ContactPayload | null {
  if (typeof input !== "object" || input === null) return null
  const { name, email, message } = input as Record<string, unknown>
  if (typeof name !== "string" || name.trim() === "") return null
  if (typeof email !== "string" || !EMAIL_RE.test(email.trim())) return null
  if (typeof message !== "string" || message.trim() === "") return null
  return {
    name: name.trim(),
    email: email.trim().toLowerCase(),
    message: message.trim().slice(0, 5000),
  }
}

// @ts-expect-error - `Deno` is provided by the edge runtime, not by Node types.
const env = Deno.env

// @ts-expect-error - `Deno.serve` is the edge entrypoint.
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS })
  }
  if (req.method !== "POST") {
    return json({ ok: false, error: "method_not_allowed" }, 405)
  }

  let payload: ContactPayload | null
  try {
    payload = parsePayload(await req.json())
  } catch {
    payload = null
  }
  if (!payload) {
    return json({ ok: false, error: "invalid_payload" }, 400)
  }

  const host = env.get("SMTP_HOST")
  const port = Number(env.get("SMTP_PORT") ?? "465")
  const username = env.get("SMTP_USERNAME")
  const password = env.get("SMTP_PASSWORD")
  const from = env.get("SMTP_FROM") ?? username
  const to = env.get("CONTACT_TO") ?? "talorlik@gmail.com"

  if (!host || !username || !password || !from) {
    return json({ ok: false, error: "smtp_not_configured" }, 500)
  }

  const client = new SMTPClient({
    connection: {
      hostname: host,
      port,
      // Port 465 uses implicit TLS; 587 upgrades via STARTTLS.
      tls: port === 465,
      auth: { username, password },
    },
  })

  try {
    await client.send({
      from,
      to,
      replyTo: payload.email,
      subject: `Studio Itai contact form - ${payload.name}`,
      content: `Name: ${payload.name}\nEmail: ${payload.email}\n\n${payload.message}`,
      html: `<p><strong>Name:</strong> ${payload.name}</p>
<p><strong>Email:</strong> ${payload.email}</p>
<p style="white-space:pre-wrap">${payload.message}</p>`,
    })
    await client.close()
  } catch (cause) {
    console.error("contact: SMTP send failed", cause)
    try {
      await client.close()
    } catch {
      // already closed
    }
    return json({ ok: false, error: "send_failed" }, 500)
  }

  return json({ ok: true }, 200)
})
