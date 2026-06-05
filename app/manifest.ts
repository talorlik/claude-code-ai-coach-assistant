import type { MetadataRoute } from "next"

import { buildManifest } from "@/lib/pwa/manifest"

/**
 * Next.js App Router manifest route. Served at `/manifest.webmanifest` and
 * linked automatically from `<head>` by the `manifest` metadata field on the
 * locale layout. It lives at the app root (not under `[locale]`) so there is a
 * single, locale-independent manifest URL; the locale-specific entry point is
 * expressed through `start_url` instead.
 *
 * The route delegates to {@link buildManifest} so the manifest object can be
 * unit-tested without the metadata runtime.
 *
 * @returns The Web App Manifest for the installable PWA.
 */
export default function manifest(): MetadataRoute.Manifest {
  return buildManifest()
}
