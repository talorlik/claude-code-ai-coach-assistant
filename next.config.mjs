import createNextIntlPlugin from "next-intl/plugin"

// Point the plugin at the request-config module so next-intl can resolve
// messages and the active locale on the server.
const withNextIntl = createNextIntlPlugin("./i18n/request.ts")

/** @type {import('next').NextConfig} */
const nextConfig = {
  // The PDF export route reads an embedded TrueType font from `lib/pdf/fonts`
  // at runtime via `fs`. Next's dependency tracer cannot see a path built from
  // `process.cwd()`, so include it explicitly in the route's serverless bundle.
  outputFileTracingIncludes: {
    "/api/pdf/workout-plan": ["./lib/pdf/fonts/**"],
  },
}

export default withNextIntl(nextConfig)
