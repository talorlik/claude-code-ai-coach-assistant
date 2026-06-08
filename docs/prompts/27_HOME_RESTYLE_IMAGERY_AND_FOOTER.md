# 27 - HOME RESTYLE IMAGERY AND FOOTER

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

- Batches 00-26 shipped and merged to local `main`. Batch 26 applied the
  `docs/design/DESIGN.md` token system, Oswald display + Poppins body fonts,
  explicit `.light` / `.dark` theme classes, scheme-aware favicons, and the
  theme-aware brand logo in the header. All semantic tokens
  (`--radius-cards/pills/buttons/special`, font families, colors) are live.
- `public/header-banner.png` (1672x941) is the provided home hero image.
- `docs/design/DESIGN.md` Imagery section governs photo selection: real
  movement, coaching, weights, gyms; aggressive crops; warm/high-contrast in
  dark, cleaner daylight in light; no stock smiles or laptop scenes; overlay text
  only with guaranteed contrast in both themes.
- `components/ui/button.tsx` uses `rounded-lg` (not pills). DESIGN.md pill CTAs
  must be achieved with a scoped `rounded-full` on the home CTA links, NOT by
  changing the shared button component.
- `app/[locale]/page.tsx` currently centers its hero; DESIGN.md requires
  left-aligned (start-aligned) display headlines in the poster style.

Before editing, inspect the current code structure and explain the files you
will touch. Read `docs/design/DESIGN.md`, `app/[locale]/page.tsx`,
`app/[locale]/layout.tsx`, `components/site-header.tsx`,
`messages/en-US.json`, and `messages/he-IL.json` first.

## Goal

Restyle the home page into the DESIGN.md editorial poster look, source athletic
imagery from Unsplash into `public/images/`, and add a shared localized site
footer that all pages inherit.

## Scope

In scope: home page (`app/[locale]/page.tsx`) layout, a curated downloaded image
set, and a new `SiteFooter`. Out of scope: About/Contact pages (Batch 28) and the
authenticated app dashboards (they inherit tokens automatically and need no
bespoke work here).

## Tasks

1. Curate and DOWNLOAD a small set of gym / personal-training photos from the
   Unsplash sport search (`https://unsplash.com/s/photos/gym`,
   `.../personal-trainer`) into `public/images/`. Prefer real training movement,
   weights, and coaching moments per the DESIGN.md Imagery rules. Save a
   `public/images/CREDITS.md` (UPPERCASE) listing each file, its Unsplash source
   URL, and photographer attribution. Files to fetch this batch:
   - `public/images/home-accent.jpg` (optional secondary home image)
   - reserve for Batch 28 (fetch now so they exist): `about-hero.jpg`,
     `about-philosophy.jpg`, `about-mission.jpg`, `contact-side.jpg`
   Do NOT hotlink Unsplash and do NOT add `images.remotePatterns` to
   `next.config.mjs`; the images must be local, committed, and offline/PWA-safe.
2. Restyle `app/[locale]/page.tsx`:
   - Switch the hero from centered to LEFT/START aligned (`text-start`,
     `items-start`). Render the display headline with `font-display uppercase`
     at the DESIGN.md display scale.
   - Use `next/image` to render `public/header-banner.png` as the hero image
     (`priority`, explicit dimensions). If text overlays the image, apply a
     token scrim (`bg-background/60` or similar) so contrast holds in BOTH
     themes. Never use an rgba literal.
   - Make the two hero CTAs pill-shaped with a scoped `rounded-full` class
     (keep the shared `Button`/`buttonVariants` untouched).
   - Restyle the feature cards using `--radius-cards` and semantic tokens only.
     Keep the `rtl:rotate-180` arrow and all accessibility landmarks (`<main>`,
     labelled `<section>`s, single `<h1>`).
   - Keep all copy in the `Home` namespace; add new keys only if the new layout
     needs them, in BOTH `messages/en-US.json` and `messages/he-IL.json`.
3. Create `components/site-footer.tsx` (TSDoc): a server component with
   locale-aware links to Home, About, and Contact, the app name, and a copyright
   line, using semantic tokens. Use the locale-aware `Link` from
   `@/i18n/navigation`. Add a `Footer` message namespace (or reuse `Nav`/`Home`
   keys where sensible) in BOTH message files.
4. Render `<SiteFooter />` in `app/[locale]/layout.tsx` after `{children}` so
   every page (including the Batch 28 About/Contact pages) inherits it. Remove
   the now-redundant inline footer from `app/[locale]/page.tsx` if it duplicates
   the shared footer.

## Required Tests

1. `messages-parity` stays green for any new Home/Footer keys (en + he).
2. Render/RTL test for `SiteFooter`: the About, Contact, and Home links render
   with locale-preserving hrefs.
3. Existing homepage tests (e.g. `homepage-metadata.test.ts`) stay green.

## Verification

1. `npm run lint`
2. `npm run typecheck`
3. `npm run build`
4. `npm run test`

Manual checks (document, do not block the gate): home headline is left-aligned in
`/en` and start-aligned in `/he` (RTL); the banner renders; the CTAs are
pill-shaped; overlay text contrast holds in dark AND light; no layout shift
(CLS); footer links preserve the active locale.

## Commit

When the batch is complete and verified, create a commit:

```bash
git add .
git commit -m "Restyle home page with editorial layout, imagery, and footer"
```

## Output Required From Claude Code

Return:

1. Files changed.
2. Key implementation decisions (pill-CTA scoping, overlay scrim, image
   placements).
3. Tests added or updated.
4. Commands run and their results.
5. Any remaining risk or follow-up (notably overlay contrast across both themes).
