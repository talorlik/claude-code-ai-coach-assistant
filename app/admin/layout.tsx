import type { Metadata } from "next"

import { requireAdmin } from "@/lib/auth/require-admin"

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

/**
 * Server-side guard for the entire /admin subtree. `requireAdmin()` redirects
 * unauthenticated users to login and non-admins to home, so any content
 * rendered below is admin-only.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireAdmin()

  return (
    <div className="mx-auto flex min-h-svh max-w-3xl flex-col gap-6 px-4 py-12">
      {children}
    </div>
  )
}
