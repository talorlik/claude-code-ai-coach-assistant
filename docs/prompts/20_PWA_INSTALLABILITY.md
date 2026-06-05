# 20 - PWA INSTALLABILITY

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

- Template installed.
- `/start-from-template` executed.
- `/setup-vercel-ai` executed.
- `/setup-github` executed.
- `/setup-vercel` executed.
- Accounts connected.
- Environment variables implemented but requiring verification.
- Auth mechanisms implemented but requiring verification.
- Batch 15 (push notifications) shipped: there is already a service worker at
  `public/sw.js` registered by the reminder-settings client, plus push routes
  under `app/api/push/`. This batch must COMPOSE with that service worker, not
  replace it or register a second competing one.

Before editing, inspect the current code structure and explain the files you
will touch.

## Goal

Make the app an installable Progressive Web App (PWA) on desktop and mobile,
locale- and RTL-aware, without breaking the existing push-notification service
worker.

## Scope

Web app manifest, installability, offline app-shell fallback, install affordance,
and iOS Add-to-Home-Screen support. No new business features.

## Tasks

1. Add a Web App Manifest. Prefer a Next.js App Router `app/manifest.ts`
   (typed `MetadataRoute.Manifest`) served at `/manifest.webmanifest`, OR a
   static `public/manifest.webmanifest` if the dynamic route conflicts with the
   `[locale]` segment. Include `name`, `short_name`, `description`,
   `start_url` (`/en` or a locale-detecting entry), `scope`, `display`
   (`standalone`), `background_color`, `theme_color`, `orientation`, `lang`,
   `dir`, and `categories`.
2. Add maskable and any-purpose app icons in `public/` at 192x192 and 512x512
   (PNG), plus an Apple touch icon (180x180). Reference them from the manifest
   and from `<head>` (`apple-touch-icon`). Generate placeholder-quality icons if
   no brand asset exists; document that the trainer should replace them.
3. Wire the manifest and theme-color into the document head. In Next.js App
   Router this is via the `metadata`/`viewport` exports (`themeColor`,
   `appleWebApp`, `manifest`) on the root or `[locale]` layout. Keep
   `theme_color` consistent with the existing light/dark theme tokens.
4. Service worker strategy - do NOT introduce a second service worker.
   Extend the existing `public/sw.js` (from batch 15) to add:
   - an `install`/`activate` lifecycle that precaches a minimal offline
     app-shell (at least an `/offline` fallback document and core static assets),
   - a `fetch` handler that serves the cached app-shell/offline page ONLY for
     navigation requests that fail network, and otherwise passes through
     (network-first or pass-through). Never cache authenticated API responses,
     Supabase calls, AI routes, or anything under `app/api/*`.
   - keep the existing `push` and `notificationclick` handlers intact.
   Bump a cache-version constant so old caches are cleaned on `activate`.
5. Ensure the service worker is registered on normal app load for every visitor
   (today it is only registered during push opt-in). Add a small client
   component (e.g. mounted in the `[locale]` layout) that registers `/sw.js`
   once on mount when `serviceWorker` is supported, idempotently, without
   blocking render. Reuse the detection helpers in `lib/push/support.ts`.
6. Add a localized `/[locale]/offline` route (or an offline app-shell fragment)
   shown when navigation fails offline. Keep copy in the message catalogs.
7. Add an install affordance: a small, dismissible "Install app" control that
   listens for the `beforeinstallprompt` event (Chromium), calls `prompt()` on
   click, and hides itself when the app is already installed
   (`display-mode: standalone`) or the event is unavailable. For iOS Safari
   (no `beforeinstallprompt`), show localized Add-to-Home-Screen instructions
   instead. All copy translatable; RTL-aware.
8. iOS specifics: set `appleWebApp` metadata (`capable`, `statusBarStyle`,
   `title`) and the `apple-touch-icon`. Document that iOS web push requires the
   app be installed to the Home Screen first (ties into batch 15 push).
9. Keep secrets and authenticated data out of any cache. Do not cache
   `/api/*`, auth, Supabase, or AI responses. Document the caching policy in a
   short comment in `public/sw.js`.
10. Add TSDoc to the registration helper and the install-prompt component.

## Required Tests

1. Unit test for the manifest output (name, `display: standalone`, icons,
   `start_url`, `theme_color`) - if `app/manifest.ts` is used, import and assert
   its returned object; if static, parse and assert the JSON.
2. Unit test for the service-worker registration helper (registers once when
   supported; no-ops when `serviceWorker` is absent), using injected fakes like
   the existing `lib/push/support.ts` tests.
3. Unit/integration test that the install-prompt component renders the iOS
   instructions branch when `beforeinstallprompt` is unavailable and hides when
   `display-mode: standalone` matches (mock `matchMedia`).
4. Integration/asset test asserting the manifest is served and the icon files
   referenced by the manifest exist in `public/`.
5. Playwright smoke test: the manifest is linked in `<head>` on `/en` and `/he`,
   the document exposes a valid `theme-color`, and the app shell loads. Assert
   `/he` carries `dir="rtl"`. The full install prompt (real
   `beforeinstallprompt`) is out of scope for a deterministic headless run;
   assert the affordance is present or gracefully absent.
6. Guard test (or extend the existing no-middleware guard mindset): assert that
   only ONE service worker file exists (`public/sw.js`) and that it still
   contains the `push` and `notificationclick` handlers from batch 15, so PWA
   work does not regress push.

## Verification

1. `npm run lint`
2. `npm run typecheck`
3. `npm run build`
4. `npm run test`
5. `npx playwright test`

Manual check (document, do not block the gate): in Chrome DevTools ->
Application -> Manifest, the app is installable with no errors; the service
worker activates; toggling offline still serves the app shell / offline page;
push reminders from batch 15 still fire.

## Commit

When the batch is complete and verified, create a commit:

```bash
git add .
git commit -m "Add installable PWA support"
```

## Output Required From Claude Code

Return:

1. Files changed.
2. Key implementation decisions (especially how the single service worker now
   serves BOTH push and PWA offline duties).
3. Tests added or updated.
4. Commands run and their results.
5. Any remaining risk or follow-up (icon quality, iOS install caveats, and
   whether batch 19 deployment verification should be re-run after this batch).
