# Auth Port Design

Port the authentication processes (signup, login, logout, remember-me,
forgot-password, password reset, admin vs. non-admin) from the reference
project `claude-code-mamas-bakery` into `claude-code-ai-coach-assistant`.

Per the user's instructions: implement only what this project needs, bring
structure not styling, and alter existing files only where absolutely required.

## Table of Contents

- [Goals and Non-Goals](#goals-and-non-goals)
- [Key Differences From the Reference](#key-differences-from-the-reference)
- [Architecture](#architecture)
- [Database Schema and RLS](#database-schema-and-rls)
- [Admin Seeding](#admin-seeding)
- [Files to Create](#files-to-create)
- [Files to Modify](#files-to-modify)
- [Files Deliberately Not Ported](#files-deliberately-not-ported)
- [Captcha](#captcha)
- [Data Flows](#data-flows)
- [Dependencies and Configuration](#dependencies-and-configuration)
- [Verification Plan](#verification-plan)

## Goals and Non-Goals

### Goals

- Email/password signup with email confirmation.
- Login with a "remember me" opt-out (session-only cookies when unchecked).
- Logout that clears the session and the remember-me flag.
- Forgot-password and password-reset flows via email recovery links.
- Cloudflare Turnstile captcha on signup, login, and forgot-password.
- A full customer profile system (contact details, address, email change,
  password change).
- Admin vs. non-admin distinction: role stored in `user_roles`, a server-side
  `requireAdmin()` guard, and a minimal guarded `/admin` landing page.
- Role-based post-login redirect: admins to `/admin`, everyone else to `/chat`.

### Non-Goals

- Internationalization (this project has no locale routing; the reference's
  `next-intl` layer is dropped and all strings become plain English).
- The bakery back-office (products, orders, customers, analytics).
- Branded logo artwork (the reference `Logo` needs image assets this project
  does not have; auth pages use a plain text/icon header instead).

## Key Differences From the Reference

| Concern | Reference | This project |
| --- | --- | --- |
| Routing | `app/[locale]/...`, `next-intl` | Unprefixed `app/...`, plain English |
| Middleware file | `middleware.ts` (implied) | `proxy.ts` (Next.js 16 convention, already present) |
| Strings | `getTranslations`/`useTranslations` | Inlined English from reference `en.json` |
| Error/notice codes | `auth.*` translation keys resolved via `resolveAuthMessage` | Plain English mapped from a small code-to-message lookup |
| Validation source | `lib/orders/order-validation` | New `lib/auth/validation.ts` (extracted subset) |
| Admin client | `supabase-js` plain client | `@supabase/ssr` `createServerClient` with empty cookies (avoids RLS-bearer pitfall) |
| Post-login default | `/profile` (or `/admin` for admins) | `/chat` (or `/admin` for admins) |

The reference resolves error/notice codes through `resolveAuthMessage`, which
exists only to localize them. Without i18n, that indirection is unnecessary.
A small `resolveAuthMessage(code)` lookup is still kept so server actions can
redirect with stable codes (e.g. `invalidCredentials`) rather than reflecting
arbitrary query-param text into the page, preserving the reference's
anti-reflection property.

## Architecture

Four layers, mirroring the reference so behavior is identical:

1. **Session refresh and route protection** in `lib/supabase/middleware.ts`,
   invoked by the existing `proxy.ts`. Calls `getUser()` on every request
   (refreshes expiring sessions) and redirects unauthenticated users away from
   protected paths to `/login`.
2. **Remember-me** as a separate `remember-me` flag cookie. Supabase's auth
   cookies are sent without an expiry attribute when session-scoped, so the
   server cannot infer persistence from them. The flag is read at every
   cookie-write boundary (`server.ts`, `middleware.ts`); when it signals
   session-only, the auth cookies have their `maxAge`/`expires` stripped so they
   clear on browser close.
3. **Role checks** in `lib/auth/roles.ts` (reads the caller's own `user_roles`
   row through the RLS-scoped client) and `lib/auth/require-admin.ts` (redirects
   guests to `/login`, non-admins to `/`).
4. **Email flows** route through `app/auth/confirm/route.ts`, which exchanges
   the `token_hash` for a session, ensures a profile row, and redirects. Signup
   confirmation lands on `/profile`; recovery lands on `/reset-password`.

### Protected Routes

The middleware protects an allowlist (so new public pages are not accidentally
gated):

- `/admin` and `/admin/*`
- `/profile` and `/profile/*`
- `/chat`

Everything else (`/`, `/login`, `/forgot-password`, `/reset-password`,
`/auth/*`, `/api/*`) is public.

## Database Schema and RLS

One committed migration, `supabase/migrations/0001_auth_schema.sql`, folds the
reference's history (`0001` schema + `0003`/`0004` hardening + `0014`/`0015`
RLS-recursion fixes) into a single already-correct migration. This avoids
replaying the bug-then-fix sequence on a fresh database.

Contents:

- `app_role` enum (`'admin'`, and `'customer'` for symmetry with the reference).
- `user_roles` table: `(user_id uuid references auth.users on delete cascade,
  role app_role, created_at)`, PK `(user_id, role)`, index on `role`.
- `profiles` table: `user_id` PK referencing `auth.users`, `full_name`, `phone`,
  `address_line1`, `address_line2`, `city`, `postal_code`, `created_at`,
  `updated_at`.
- `set_updated_at()` trigger function and a `profiles_set_updated_at` trigger.
- `is_admin(uuid)`: `SECURITY DEFINER`, `STABLE`, `set search_path = public`.
  EXECUTE revoked from `public`, `anon`, `authenticated`; granted to
  `service_role`. Kept off the REST RPC surface.
- RLS enabled on both tables.

### RLS Policies (final, non-recursive)

- `user_roles`: `Users can read own roles` only -- `using (auth.uid() =
  user_id)`. No admin-read-all policy (it would recurse, and the app only needs
  own-row reads; admin tooling that lists other users uses the service-role
  client).
- `profiles`: own-row `select`, `insert`, `update`, each gated on
  `auth.uid() = user_id`.

Admin-scoped policies on application data tables (the reference's products /
orders / order_items) are not created because those tables do not exist here.
The `is_admin` helper and `user_roles` own-row read are sufficient for
`roles.ts` / `requireAdmin()`.

> [!IMPORTANT]
> Policy expressions evaluate as the *querying* role. Any future admin policy
> on an app-data table must inline `exists (select 1 from user_roles ur where
> ur.user_id = auth.uid() and ur.role = 'admin')` rather than call `is_admin()`
> (whose EXECUTE is revoked from `authenticated`). A `user_roles` policy must
> never subquery `user_roles` (infinite recursion).

## Admin Seeding

The schema migration is generic and committed. The admin promotion is delivered
separately (not in migration history, so it is not replayed on fresh DBs) and
applied now via the Supabase MCP. It is idempotent and email-based, so it is a
safe no-op until the target account signs up:

```sql
insert into public.user_roles (user_id, role)
select id, 'admin'::app_role
from auth.users
where email = 'talorlik@gmail.com'
on conflict (user_id, role) do nothing;
```

Target admin: `talorlik@gmail.com`.

## Files to Create

### Database

- `supabase/migrations/0001_auth_schema.sql` -- schema, `is_admin`, RLS (final).
- `supabase/templates/confirmation.html` -- verbatim from reference.
- `supabase/templates/recovery.html` -- verbatim from reference.

### lib

- `lib/supabase/cookie-persistence.ts` -- verbatim (`REMEMBER_FLAG`,
  `SESSION_ONLY`, `isAuthCookie`, `stripPersistence`).
- `lib/auth/roles.ts` -- verbatim (`isAdmin`, `getCurrentUserRole`).
- `lib/auth/require-admin.ts` -- reference logic using `next/navigation`
  `redirect` (no i18n); guests to `/login`, non-admins to `/`.
- `lib/auth/resolve-auth-message.ts` -- small code-to-English lookup (replaces
  the i18n-coupled reference version) for the stable auth codes.
- `lib/auth/validation.ts` -- `isValidEmail`, `normalizePhone`,
  `validateAddress` extracted from the reference orders module (the only
  validators auth/profile need).
- `lib/types/action-result.ts` -- verbatim (`ActionResult`, `ok`, `fail`).
- `lib/profile/profile-types.ts` -- `Profile`, `ProfileInput`, and
  `DeliveryAddressInput` (moved here; no orders module to import from). `Profile`
  is a hand-declared interface matching the `profiles` columns (no
  `database.types.ts` is generated; the table is small and declaring it inline
  avoids a codegen step and a generated-file dependency).
- `lib/profile/profile-validation.ts` -- `validateProfile`, repointed to
  `lib/auth/validation.ts`.
- `lib/profile/profile-actions.ts` -- `ensureProfile`, `updateProfile`,
  `updateAddress`, `updateEmail`, `updatePassword`, repointed imports.

### app

- `app/login/page.tsx`, `app/login/login-tabs.tsx`, `app/login/actions.ts`
  -- signin/signup tabs, remember-me checkbox, captcha, forgot-password link;
  role-based redirect; safe in-app `?redirect=` handling.
- `app/forgot-password/page.tsx`, `app/forgot-password/actions.ts`.
- `app/reset-password/page.tsx`, `app/reset-password/actions.ts`.
- `app/auth/confirm/route.ts` -- token exchange + `ensureProfile`.
- `app/auth/signout/route.ts` -- POST/GET signout (no `?locale=`), clears
  remember-me, redirects to `/login`.
- `app/profile/page.tsx`, `app/profile/account-forms.tsx` -- full account page
  (contact, address, email, password); no order-history link.
- `app/admin/layout.tsx` -- `requireAdmin()` guard.
- `app/admin/page.tsx` -- minimal "you are an admin" landing.

### components

- `components/captcha-field.tsx` -- ported `CaptchaField`; `useTranslations`/
  `useLocale` removed, English error string, `language` fixed to `"en"`.

## Files to Modify

- `lib/supabase/server.ts` -- merge in the `sessionOnly` cookie-stripping in
  `setAll`; replace `createAdminClient` with the `@supabase/ssr`
  empty-cookies variant (documented RLS-bearer pitfall avoidance).
- `lib/supabase/middleware.ts` -- replace template body with reference logic
  minus locale handling: `getUser()` refresh, protected allowlist, redirect
  guests to `/login` with a `notice`.
- `package.json` -- add `@marsidev/react-turnstile@^1.5.2`.
- `.env.local` -- set `NEXT_PUBLIC_TURNSTILE_SITE_KEY` to the provided site key.

`app/page.tsx` already links to `/login`; no change needed. `proxy.ts` already
calls `updateSession`; no change needed.

## Files Deliberately Not Ported

- `i18n/*`, `next-intl`, `messages/*`.
- `components/shared/logo.tsx` (no brand assets), `site-header.tsx` (bakery nav
  with cart), `language-switcher`, `theme-toggle` variants.
- `lib/orders/*`, `lib/delivery/*`, `lib/products/*`, `lib/users/*`, and the
  admin back-office pages.
- `lib/supabase/database.types.ts` (`profiles` is typed via a hand-declared
  interface instead).

## Captcha

The Turnstile **secret key** is already configured in the Supabase dashboard
(Auth -> CAPTCHA protection enabled), per the user. The app only needs the
**site key** in `NEXT_PUBLIC_TURNSTILE_SITE_KEY`. `CaptchaField` renders only
when the site key is set and mirrors the solved token into a hidden
`captchaToken` input; server actions forward it as `options.captchaToken`, which
Supabase verifies. Site key: `0x4AAAAAADc5fn-KT7rJaxo3`.

## Data Flows

### Login

`/login` form -> `login` action -> server-side credential validation -> write
remember-me flag (delete it for "remember", or set `SESSION_ONLY` to opt out)
-> `signInWithPassword({ captchaToken })` -> on success `ensureProfile` +
`isAdmin` -> `revalidatePath("/", "layout")` -> redirect to a safe `?redirect=`
target, else `/admin` (admin) or `/chat`.

### Signup

`/login?tab=signup` -> `signup` action -> validate -> `signUp({
emailRedirectTo: <origin>/auth/confirm, captchaToken })` -> redirect to
`/login?notice=checkEmailToConfirm` (or `accountMaybeExists` when Supabase
returns an obfuscated already-registered user).

### Confirm

Email link -> `GET /auth/confirm?token_hash&type` -> `verifyOtp` -> `ensureProfile`
-> redirect to `next` (`/profile` for signup, `/reset-password` for recovery).

### Forgot / Reset

`/forgot-password` -> `resetPasswordForEmail({ redirectTo:
<origin>/auth/confirm?next=/reset-password, captchaToken })` -> generic
`resetLinkSent` notice (no enumeration). Recovery link -> `/auth/confirm` ->
`/reset-password` (guarded by an existing session) -> `setNewPassword` ->
`updateUser({ password })` -> sign out -> `/login?notice=passwordUpdated`.

### Logout

`POST /auth/signout` -> `signOut()` -> `revalidatePath("/", "layout")` -> clear
remember-me cookie -> redirect to `/login`.

## Dependencies and Configuration

- Add `@marsidev/react-turnstile@^1.5.2`.
- Env: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`,
  `SUPABASE_SECRET_KEY` (already present), `NEXT_PUBLIC_TURNSTILE_SITE_KEY`
  (set to the provided site key). `NEXT_PUBLIC_SITE_URL` optional (falls back to
  request host, downgrading localhost to http for clickable dev links).
- Supabase email templates updated to point confirmation/recovery links at
  `/auth/confirm` (the committed template files document the exact markup;
  applying them to the hosted project is a dashboard step).

## Verification Plan

1. `npm run typecheck` and `npm run lint` clean.
2. Apply `0001_auth_schema.sql` to the linked Supabase project; confirm
   `user_roles` and `profiles` exist with RLS enabled and the expected policies
   (`list_tables` verbose + a policy query).
3. Run the admin promotion SQL; confirm it is a no-op pre-signup and inserts the
   row post-signup.
4. Confirm advisors report no `is_admin`-on-RPC or recursive-policy issues.
5. Manual run (`npm run dev`): signup -> confirm -> login (remember on, then
   off, verifying cookie persistence differs) -> forgot -> reset -> verify
   `/chat`, `/profile`, `/admin` gating for guest / customer / admin -> signout.
