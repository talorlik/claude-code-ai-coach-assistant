import type { Metadata } from "next"

import { requireClient } from "@/lib/auth/require-user"

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

/**
 * Server-side guard for the /chat subtree. The chat UI is a client component and
 * cannot gate access itself, and the underlying `/api/chat` route is the real
 * trust boundary; this layout adds a server-side redirect so signed-out visitors
 * are sent to login (locale preserved) instead of loading an unusable page.
 */
export default async function ChatLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireClient()

  return <>{children}</>
}
