"use client"

import { useEffect } from "react"
import { useTranslations } from "next-intl"

import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty"

/**
 * Localized error boundary for the whole `[locale]` subtree. The App Router
 * renders this client component when a server or client render below it throws,
 * replacing the default unstyled Next.js error page with the app's localized
 * {@link Empty} state. It sits inside the `NextIntlClientProvider` mounted by the
 * locale layout, so `useTranslations` resolves against the active locale and the
 * copy flips to Hebrew (RTL) automatically.
 *
 * `reset` re-attempts rendering the failed segment; the retry button is keyboard
 * reachable and focus-visible like every other button. The error is logged to
 * the console so it is observable in the browser and in server logs without
 * leaking details into the UI.
 *
 * @param error - The thrown error, augmented by Next.js with an optional `digest`.
 * @param reset - Re-renders the errored segment to attempt recovery.
 */
export default function LocaleError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const t = useTranslations("Common")

  useEffect(() => {
    // Surface the failure for debugging without exposing it to the user.
    console.error(error)
  }, [error])

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-12">
      <Empty>
        <EmptyHeader>
          <EmptyTitle>{t("error.title")}</EmptyTitle>
          <EmptyDescription>{t("error.description")}</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button onClick={reset}>{t("error.retry")}</Button>
        </EmptyContent>
      </Empty>
    </main>
  )
}
