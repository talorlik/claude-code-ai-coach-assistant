import { routing } from "@/i18n/routing"

/**
 * Root 404 page. It renders its own `<html>`/`<body>` because the root layout
 * is a bare pass-through (the document shell normally comes from the localized
 * layout, which is bypassed for an unmatched or unsupported-locale path). Links
 * back to the default-locale home.
 */
export default function NotFound() {
  return (
    <html lang="en">
      <body>
        <main className="flex min-h-svh flex-col items-center justify-center gap-4 px-6 text-center">
          <h1 className="text-3xl font-bold tracking-tight">Page not found</h1>
          <p className="text-muted-foreground">
            The page you are looking for does not exist.
          </p>
          <a
            href={`/${routing.defaultLocale}`}
            className="text-primary hover:underline"
          >
            Go home
          </a>
        </main>
      </body>
    </html>
  )
}
