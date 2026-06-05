import type { MetadataRoute } from "next"

/**
 * PWA installability constants shared by the manifest route and the service
 * worker / metadata wiring.
 *
 * `THEME_COLOR` mirrors the light-theme background token (`oklch(1 0 0)` =
 * white) so the OS chrome around the installed app matches the default surface.
 * `BACKGROUND_COLOR` is the splash background shown before first paint; it uses
 * the brand placeholder teal so the launch screen reads as the app, not a blank
 * white flash. Manifest colors must be CSS hex/rgb, not `oklch`, so these are
 * resolved to hex here rather than referenced from the CSS custom properties.
 */
export const THEME_COLOR = "#ffffff"

/** Splash/background color shown while the installed app boots. */
export const BACKGROUND_COLOR = "#0f766e"

/**
 * The locale the install entry point lands on. The manifest `start_url` and
 * `scope` are locale-prefixed because every route carries an explicit locale
 * (`localePrefix: "always"`); a bare `/` would 307-redirect on launch. English
 * is the default locale, so the installed app opens at `/en` and the language
 * switcher lets the user move to `/he` from there.
 */
export const PWA_START_URL = "/en"

/**
 * Builds the Web App Manifest object. Extracted from the `app/manifest.ts`
 * route so it can be imported and asserted in unit tests without invoking the
 * Next.js metadata runtime.
 *
 * The icons list pairs a `192` and `512` "any" icon (used for the home-screen
 * and task-switcher) with a dedicated `512` "maskable" icon (so adaptive-icon
 * platforms crop the safe-zoned art instead of letterboxing a square). The
 * Apple touch icon is wired separately via `appleWebApp` metadata, not here,
 * because iOS ignores the manifest icons.
 *
 * @returns A fully-populated {@link MetadataRoute.Manifest}.
 */
export function buildManifest(): MetadataRoute.Manifest {
  return {
    name: "Studio Itai - AI Fitness Coach",
    short_name: "Studio Itai",
    description:
      "Personalized AI workout plans, progress tracking, and a virtual trainer. Train smarter with Studio Itai.",
    start_url: PWA_START_URL,
    scope: "/",
    display: "standalone",
    background_color: BACKGROUND_COLOR,
    theme_color: THEME_COLOR,
    orientation: "portrait",
    lang: "en-US",
    dir: "ltr",
    categories: ["health", "fitness", "lifestyle"],
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  }
}
