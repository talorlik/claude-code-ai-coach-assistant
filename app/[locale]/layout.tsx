import type { Metadata, Viewport } from "next"
import { Geist_Mono, Oswald, Poppins } from "next/font/google"
import { hasLocale, NextIntlClientProvider } from "next-intl"
import { setRequestLocale } from "next-intl/server"
import { notFound } from "next/navigation"

import { ThemeProvider } from "@/components/theme-provider"
import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { ServiceWorkerRegister } from "@/components/service-worker-register"
import { Toaster } from "@/components/ui/sonner"
import { cn } from "@/lib/utils"
import { THEME_COLOR } from "@/lib/pwa/manifest"
import {
  localeDirection,
  localeTag,
  routing,
  type Locale,
} from "@/i18n/routing"

/**
 * PWA document metadata: links the Web App Manifest (so the browser offers
 * install) and declares the iOS standalone web-app behavior. `appleWebApp`
 * supplies the Add-to-Home-Screen title and status-bar style and is paired with
 * the `apple-touch-icon` Apple reads instead of the manifest icons.
 */
export const metadata: Metadata = {
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Studio Itai",
  },
  icons: {
    icon: [
      { url: "/favicon-default-dark.ico", sizes: "any" },
      { url: "/favicon-light.ico", media: "(prefers-color-scheme: light)" },
      { url: "/favicon-dark.ico", media: "(prefers-color-scheme: dark)" },
    ],
    apple: "/icons/apple-touch-icon-180.png",
  },
}

/**
 * Viewport-level metadata: `themeColor` tints the browser/OS chrome around the
 * app and is kept in sync with the manifest `theme_color`.
 */
export const viewport: Viewport = {
  themeColor: THEME_COLOR,
}

/**
 * Display face for headings and poster moments. `next/font` emits the
 * `--font-family-display` custom property that `@theme inline` maps onto the
 * `--font-display`/`--font-heading` Tailwind utilities. Oswald carries no
 * Hebrew glyphs by design, so Hebrew headings fall through to the system sans
 * declared in the `--font-family-display` fallback stack.
 */
const fontDisplay = Oswald({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-family-display",
})

/**
 * Body face for forms, navigation, and app chrome. Emits
 * `--font-family-sans`, which `@theme inline` maps onto `--font-sans`. Hebrew
 * falls through to the system sans fallback (Poppins has no Hebrew glyphs).
 */
const fontSans = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-family-sans",
})

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
})

/**
 * Pre-render a static page tree for every supported locale so locale routes are
 * generated at build time rather than on demand.
 */
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }))
}

/**
 * Localized document shell. Owns `<html>`/`<body>` so `lang` carries the full
 * BCP 47 tag (`en-US`, `he-IL`) and `dir` flips to `rtl` for Hebrew. Wraps the
 * tree in `NextIntlClientProvider` so client components can read translations,
 * and validates the `[locale]` segment, 404-ing on unsupported values.
 */
export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) {
    notFound()
  }

  // Opt into static rendering for this locale before any next-intl hook runs.
  setRequestLocale(locale as Locale)

  return (
    <html
      lang={localeTag(locale as Locale)}
      dir={localeDirection(locale as Locale)}
      suppressHydrationWarning
      className={cn(
        "antialiased",
        "font-sans",
        fontDisplay.variable,
        fontSans.variable,
        fontMono.variable
      )}
    >
      <body className="flex min-h-svh flex-col">
        <NextIntlClientProvider>
          <ThemeProvider>
            <ServiceWorkerRegister />
            <SiteHeader />
            {children}
            <SiteFooter />
            <Toaster />
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
