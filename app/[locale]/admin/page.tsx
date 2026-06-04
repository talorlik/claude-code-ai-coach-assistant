import { Link } from "@/i18n/navigation"

/**
 * Admin landing page. The /admin layout already guarded access, so reaching
 * here proves the visitor is an admin.
 */
export default function AdminPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-3xl font-medium">Admin</h1>
      <p className="text-muted-foreground">
        You are signed in as an administrator.
      </p>
      <div className="flex gap-3">
        <Link href="/chat" className="text-sm text-primary hover:underline">
          Go to chat
        </Link>
        <Link href="/profile" className="text-sm text-primary hover:underline">
          My account
        </Link>
      </div>
    </div>
  )
}
