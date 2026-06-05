import { getTranslations } from "next-intl/server"

import { Skeleton } from "@/components/ui/skeleton"

/**
 * Route-level loading UI for `/[locale]/chat`, shown by the App Router while the
 * server page awaits the persisted chat history. The skeleton stands in for a
 * title and a short run of alternating chat bubbles so the transcript area does
 * not jump when the history arrives. A visually hidden, polite live region
 * announces the loading state to assistive technology; the text is localized.
 */
export default async function ChatLoading() {
  const t = await getTranslations("Common")

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-12">
      <span role="status" aria-live="polite" className="sr-only">
        {t("loading")}
      </span>
      <Skeleton className="h-8 w-40" />
      <div className="flex flex-col gap-4" aria-hidden="true">
        <Skeleton className="h-16 w-3/4 self-start rounded-lg" />
        <Skeleton className="h-12 w-2/3 self-end rounded-lg" />
        <Skeleton className="h-20 w-3/4 self-start rounded-lg" />
      </div>
    </main>
  )
}
