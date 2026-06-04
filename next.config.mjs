import createNextIntlPlugin from "next-intl/plugin"

// Point the plugin at the request-config module so next-intl can resolve
// messages and the active locale on the server.
const withNextIntl = createNextIntlPlugin("./i18n/request.ts")

/** @type {import('next').NextConfig} */
const nextConfig = {}

export default withNextIntl(nextConfig)
