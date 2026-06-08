# 28 - ABOUT CONTACT PAGES AND EMAIL

## Claude Code Prompt

You are working inside an existing Next.js 16.1.7 App Router project generated
from the AI Game Changer template.

Non-negotiable constraints:

1. Use TypeScript 5.9.3.
2. Use the App Router.
3. Use root `proxy.ts` for locale-aware request handling.
4. Do not create root `middleware.ts` unless the installed template explicitly
   requires a compatibility shim.
5. Use `next-intl` `^4.13.0` with `/en` and `/he` route prefixes.
6. Map `/en` to `en-US` and `/he` to `he-IL`.
7. Support RTL for Hebrew.
8. Keep all user-facing copy translatable.
9. Use Supabase Auth, Supabase Postgres, and RLS.
10. Keep secrets out of browser code.
11. Use Vercel AI SDK v6 and Vercel AI Gateway for AI calls unless the existing
    template has a stricter convention.
12. Use server-side calls for all AI operations.
13. Add TSDoc to exported helpers, server actions, route helpers, AI utilities,
    and non-trivial components.
14. Add or update tests for every changed behavior.
15. Avoid rewriting working template code unless needed.
16. Preserve existing signup, login, logout, remember me, and forgot-password
    behavior where possible.
17. Keep Markdown documents in uppercase underscore naming with lowercase `.md`.

Current baseline already completed by the product owner:

- Batches 00-27 shipped and merged to local `main`. Batch 26 applied the design
  tokens/fonts/logo/favicons; Batch 27 restyled the home page, added curated
  imagery under `public/images/`, and added a shared `components/site-footer.tsx`
  rendered by `app/[locale]/layout.tsx`.
- `docs/content/ABOUT_EN.md` (English) and `docs/content/ABOUT_HE.md` (Hebrew)
  are the hand-authored source copy for the About page, one file per locale. Use
  each verbatim as the source for its locale's `About` namespace; do NOT
  machine-translate the English into Hebrew - the Hebrew copy is authored. The
  two files share the same section structure, so the `About` leaf keys map
  one-to-one across locales (the `messages-parity` test is a hard gate - every
  leaf needs both locales).
- SEO uses `lib/seo/metadata.ts` `buildLocaleMetadata(locale, key)` reading the
  `Metadata` namespace (currently only `Metadata.home`).
- Imagery for these pages was downloaded in Batch 27:
  `public/images/about-hero.jpg`, `about-philosophy.jpg`, `about-mission.jpg`,
  `contact-side.jpg`. If any are missing, fetch them from the Unsplash gym /
  personal-training search per the DESIGN.md Imagery rules and record them in
  `public/images/CREDITS.md`.
- Email: there is NO email-sending code today. The contact form sends real email
  via a NEW Supabase Edge Function named `contact`, invoked from the server
  action through `createAdminClient()` (`lib/supabase/server.ts`, uses
  `SUPABASE_SECRET_KEY`). The Edge Function sends to `talorlik@gmail.com`
  (overridable via a `CONTACT_TO` function secret) using Gmail SMTP credentials
  held as function secrets. The server action MUST degrade gracefully (validate
  and return success, log on invoke failure) so the build and test gate stay
  green without secrets configured in CI.

Before editing, inspect the current code structure and explain the files you
will touch. Read `docs/content/ABOUT_EN.md`, `docs/content/ABOUT_HE.md`,
`docs/design/DESIGN.md`,
`app/[locale]/page.tsx` (as the page pattern), `lib/seo/metadata.ts`,
`lib/supabase/server.ts`, `lib/auth/validation.ts`,
`lib/auth/resolve-auth-message.ts`, `components/site-header.tsx`,
`messages/en-US.json`, and `messages/he-IL.json` first.

## Goal

Add localized, theme-aware About and Contact pages, wire them into navigation and
the footer, and make the Contact form deliver real email through a Supabase Edge
Function.

## Scope

In scope: `app/[locale]/about/page.tsx`, `app/[locale]/contact/page.tsx`, the
contact form + server action, the `contact` Edge Function, nav links, and the new
message namespaces. Out of scope: changing existing pages beyond adding nav
links and metadata-key support.

## Tasks

1. Create `app/[locale]/about/page.tsx` as a server component following the home
   page pattern: `setRequestLocale(locale)`, a `generateMetadata` that calls
   `buildLocaleMetadata(locale, "about")`, a single `<h1>`, labelled
   `<section>`s, and `next/image` section images (`about-hero.jpg`,
   `about-philosophy.jpg`, `about-mission.jpg`) with localized `alt`. All copy
   from a new `About` namespace. TSDoc on the page. Mirror the long-form
   structure of `docs/content/ABOUT_EN.md` (and its Hebrew counterpart
   `docs/content/ABOUT_HE.md`): intro, story, what we do, training
   philosophy (the five principles: personalization, professional structure,
   accountability, human attention, safe progress), why AI, what makes us
   different, for clients, for the trainer, and the mission.
2. Add the `About` namespace to BOTH `messages/en-US.json` (from `ABOUT_EN.md`)
   and `messages/he-IL.json` (from `ABOUT_HE.md`, used verbatim - the Hebrew is
   hand-authored, not machine-translated), plus `Metadata.about` (title,
   description, siteName) matching the `Metadata.home` shape.
3. Create `app/[locale]/contact/page.tsx`: a server component rendering the
   contact details (a MADE-UP Tel Aviv address, email, phone, hours), a
   `next/image` side image (`contact-side.jpg`), and the `<ContactForm />`.
   Provide a `generateMetadata` -> `buildLocaleMetadata(locale, "contact")`.
   Suggested placeholder details (localize all of them): address "Rothschild
   Blvd 22, Tel Aviv-Yafo 6688218", phone "+972 3-555-0192", email
   "hello@studioitai.example", hours "Sun-Thu 06:00-22:00, Fri 06:00-14:00". For
   the map use a plain link to Google Maps (no iframe, PWA-friendly) or a static
   image.
4. Create `components/contact-form.tsx` (client component, TSDoc) wrapping the
   server action with progressive enhancement: a real `<form action={...}>`,
   `type="submit"`, a `<Label htmlFor>` for each `Input`/`Textarea`, `required`
   and `autoComplete` attributes, a hidden honeypot field, `aria-invalid` on
   error, and a `role="alert"` status line. It must work with JavaScript
   disabled. Reuse `components/ui/*` (Field, Input, Textarea, Button, Label).
5. Create `app/[locale]/contact/actions.ts` with a `"use server"`
   `submitContactForm` action: validate name, email (reuse `isValidEmail` from
   `lib/auth/validation.ts`), and message; if the honeypot is filled, return
   silent success; on valid input call
   `createAdminClient().functions.invoke("contact", { body })`; redirect back
   with `?notice=contact_sent` on success or `?error=...` on failure, resolved by
   a small message resolver mirroring `lib/auth/resolve-auth-message.ts`. Invoke
   failure must NOT throw to the request or fail the build; log it and still show
   a localized error.
6. Create the Supabase Edge Function `supabase/functions/contact/index.ts`: it
   validates the payload server-side, then sends an email to `CONTACT_TO`
   (default `talorlik@gmail.com`) using Gmail SMTP credentials from function
   secrets (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD`,
   `SMTP_FROM`). Return `{ ok: true }` on success. Create or update
   `supabase/config.toml` with the project ref and a `[functions.contact]` entry.
7. Document the Edge Function deploy and secrets steps in `docs/DECISIONS.md`
   (append-only, dated): `supabase functions deploy contact` and `supabase
   secrets set SMTP_HOST=... SMTP_PORT=... SMTP_USERNAME=... SMTP_PASSWORD=...
   SMTP_FROM=... CONTACT_TO=talorlik@gmail.com`. Note that the Gmail SMTP
   password must be a Gmail App Password.
8. Add About and Contact links to `components/site-header.tsx`, visible to every
   visitor (signed-in or out). Add `Nav.about` and `Nav.contact` to BOTH message
   files. Confirm the footer (Batch 27) already links About and Contact.
9. Add the `Contact` namespace (heading, intro, address/email/phone/hours labels
   and values, form field labels, submit label, success and error messages,
   image alts, map label) and `Metadata.contact` to BOTH message files.
10. If `buildLocaleMetadata` constrains its `key` parameter to a union, extend it
    to accept `"about"` and `"contact"`.

## Required Tests

1. `messages-parity` for the new `About`, `Contact`, `Nav.about/contact`,
   `Metadata.about`, and `Metadata.contact` keys across en + he (hard gate -
   every Hebrew leaf present).
2. `submitContactForm` validation: rejects missing or invalid email, accepts
   valid input, honeypot yields silent success, and the correct notice/error is
   produced. Mock the Supabase client so no real network call runs.
3. Render test for `ContactForm`: every input has an associated label and the
   submit control is present (mirror `onboarding-form-labels.test.tsx`).
4. Render test that `SiteHeader` shows the About and Contact links for both
   signed-out and signed-in states.

## Verification

1. `npm run lint`
2. `npm run typecheck`
3. `npm run build`
4. `npm run test`

Manual checks (document, do not block the gate): `/en/about`, `/he/about`,
`/en/contact`, `/he/contact` render with correct alignment, images, and no raw
message keys in either direction; the contact form submits with JavaScript on
(localized success) and with JavaScript disabled (progressive enhancement); the
error path is localized; the nav shows About and Contact signed-in and out;
hreflang alternates include `/about` and `/contact`. End-to-end email delivery is
verified manually after `supabase functions deploy contact` and setting the
secrets (out of CI).

## Commit

When the batch is complete and verified, create a commit:

```bash
git add .
git commit -m "Add localized About and Contact pages with working contact form"
```

## Output Required From Claude Code

Return:

1. Files changed.
2. Key implementation decisions (Edge Function invocation, graceful degradation,
   progressive enhancement).
3. Tests added or updated.
4. Commands run and their results.
5. Any remaining risk or follow-up (notably the Edge Function deploy + secrets
   needed for live delivery).
