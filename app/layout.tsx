import "./globals.css"

/**
 * Root layout. The `<html>` and `<body>` elements live in the localized layout
 * (`app/[locale]/layout.tsx`) so the `lang` and `dir` attributes can reflect the
 * active locale. This root simply forwards children; Next.js still requires a
 * root layout to exist even when a nested layout provides the document shell.
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return children
}
