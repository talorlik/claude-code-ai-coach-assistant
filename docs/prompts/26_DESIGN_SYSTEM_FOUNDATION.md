# 26 - DESIGN SYSTEM FOUNDATION

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

- Batches 00-25 shipped and merged to local `main` (one squash commit each).
- The app is functionally complete but visually generic: `app/globals.css` still
  ships the STOCK shadcn neutral OKLCH palette, not the branded design system in
  `docs/design/DESIGN.md`. There is no display font, no brand logo (a Sparkles
  lucide icon stands in), and `app/favicon.ico` is a 26 KB placeholder.
- `docs/design/DESIGN.md` is the canonical styling guide. It defines common
  `:root` tokens (typography scale, spacing, radius, font families, shadow), a
  `.dark` palette (red `#b91c1c` primary, amber accents, warm stone canvas), a
  `.light` palette (orange `#e05d38` primary, blue accents, stone-gray `#e8ebed`
  canvas), and an `@theme inline` mapping. Treat its CSS block as authoritative.
- Brand assets live in `docs/design/` and are NOT yet in `public/`:
  `header_banner.png` (1672x941), `logo_dark.png` / `logo_light.png` (2172x724,
  ~3:1 wordmark), `favicon_dark.ico` / `favicon_light.ico` (16/32 multi-res).

Before editing, inspect the current code structure and explain the files you
will touch. Read `docs/design/DESIGN.md`, `app/globals.css`,
`app/[locale]/layout.tsx`, `components/theme-provider.tsx`,
`components/mode-toggle.tsx`, `components/site-header.tsx`, `lib/pwa/manifest.ts`,
and `i18n/routing.ts` first.

## Goal

Apply the `docs/design/DESIGN.md` token system, typography, brand logo, and
scheme-aware favicons across the app so every existing page automatically
inherits the branded dark and light themes. No page-layout work in this batch.

## Scope

In scope: design tokens, fonts, theme-class reconciliation, favicons, brand logo,
asset copies, PWA theme color. Out of scope: home/page layout restyling (Batch
27), new pages (Batch 28). Do not change page structure beyond the header logo.

## Tasks

1. Copy brand assets from `docs/design/` into `public/` with these exact names:
   - `header_banner.png` -> `public/header-banner.png`
   - `logo_dark.png` -> `public/logo-dark.png`
   - `logo_light.png` -> `public/logo-light.png`
   - `favicon_dark.ico` -> `public/favicon-default-dark.ico` AND
     `public/favicon-dark.ico`
   - `favicon_light.ico` -> `public/favicon-light.ico`
2. Delete `app/favicon.ico` (a Next.js file-convention file that would otherwise
   shadow the `metadata.icons` configuration).
3. Rewrite the token blocks in `app/globals.css`:
   - Replace the stock OKLCH `:root` and `.dark` with the DESIGN.md `:root`
     (common tokens ONLY: typography scale, spacing, radius, font families,
     shadow; include `color-scheme: light dark`), `.dark`, and a NEW `.light`
     block, using the verbatim hex values from DESIGN.md.
   - Merge the two `@theme inline` declarations into ONE. Keep the existing
     `--color-* -> var(--*)` mappings (they match DESIGN.md). For radius, keep
     DESIGN.md's semantic `--radius-tags/cards/pills/buttons/special` AND the
     existing shadcn calc entries (`--radius-sm/2xl/4xl`); on colliding keys
     (`--radius-md/xl/3xl`) DESIGN.md's fixed values win. Add the
     `--font-display/--font-sans/--font-serif/--font-mono` mappings.
   - Keep `@custom-variant dark (&:is(.dark *))` and the `@layer base` block.
4. Add fonts in `app/[locale]/layout.tsx` via `next/font/google`: `Oswald`
   (weights 400/500/700, `variable: "--font-family-display"`) for display and
   `Poppins` (weights 400/500/600, `variable: "--font-family-sans"`) for body;
   keep `Geist_Mono`. The CSS variable names MUST match the DESIGN.md token names
   so `@theme inline` resolves `--font-display` and `--font-sans`. Wire every
   `.variable` class onto `<html>` with `font-sans antialiased`. Do NOT request a
   Hebrew subset (Oswald/Poppins have no Hebrew glyphs; Hebrew falls through to
   system sans by design).
5. In `components/theme-provider.tsx`, add `value={{ light: "light", dark:
   "dark" }}` to the `NextThemesProvider` so light mode emits an explicit
   `.light` class. Keep `attribute="class"`, `defaultTheme="system"`,
   `enableSystem`, `disableTransitionOnChange`, and the `d` hotkey unchanged.
6. Wire scheme-aware favicons in the `metadata` export of
   `app/[locale]/layout.tsx`:

   ```ts
   icons: {
     icon: [
       { url: "/favicon-default-dark.ico", sizes: "any" },
       { url: "/favicon-light.ico", media: "(prefers-color-scheme: light)" },
       { url: "/favicon-dark.ico", media: "(prefers-color-scheme: dark)" },
     ],
     apple: "/icons/apple-touch-icon-180.png",
   }
   ```

7. Replace the Sparkles brand in `components/site-header.tsx` with the
   theme-aware wordmark, keeping the component an async server component (CSS
   toggle, no `useTheme`):

   ```tsx
   <Link href="/" className="flex shrink-0 items-center">
     <Image src="/logo-light.png" alt={common("appName")} width={144} height={48}
            priority className="h-8 w-auto dark:hidden" />
     <Image src="/logo-dark.png" alt="" aria-hidden width={144} height={48}
            priority className="hidden h-8 w-auto dark:block" />
   </Link>
   ```

   Use `next/image`. Only the visible (light) logo carries the real `alt`.
8. Update `THEME_COLOR` in `lib/pwa/manifest.ts` to `#e8ebed` (the new light
   canvas) and update `__tests__/unit/pwa-manifest.test.ts` if it asserts the old
   value.
9. Confirm no component now hardcodes a palette hex outside the token blocks.

## Required Tests

1. Assert the `metadata.icons.icon` array contains the three expected entries
   (default + light-scheme + dark-scheme).
2. Assert `app/globals.css` contains a `.light {` and a `.dark {` token block.
3. Update `__tests__/unit/pwa-manifest.test.ts` for the new `THEME_COLOR`.
4. Keep the existing `messages-parity` and other unit tests green (no new copy in
   this batch, so parity should be unchanged).

## Verification

1. `npm run lint`
2. `npm run typecheck`
3. `npm run build`
4. `npm run test`

Manual checks (document, do not block the gate): load `/en` and `/he`; toggle
theme via ModeToggle and the `d` hotkey and confirm the palette and logo swap
with no reload flash; confirm the display font renders on headings; confirm the
tab favicon changes under OS light vs dark; confirm the RTL header mirrors in
`/he`.

## Commit

When the batch is complete and verified, create a commit:

```bash
git add .
git commit -m "Apply design system tokens, fonts, favicons, and brand logo"
```

## Output Required From Claude Code

Return:

1. Files changed.
2. Key implementation decisions (especially the globals.css token/`@theme inline`
   merge and the colliding radius keys).
3. Tests added or updated.
4. Commands run and their results.
5. Any remaining risk or follow-up (notably light-theme secondary-text contrast).
