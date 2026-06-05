import { getTranslations } from "next-intl/server"

import { Skeleton } from "@/components/ui/skeleton"

/**
 * Route-level loading UI for `/[locale]/my-plan`, shown by the App Router while
 * the server page awaits the active plan and its logs. The skeleton mirrors the
 * page's header (title + actions) and a few workout cards so the layout does not
 * jump when data arrives. A visually hidden, polite live region announces the
 * loading state to assistive technology, which otherwise sees only silent
 * placeholders. The announcement text is localized.
 */
export default async function MyPlanLoading() {
  const t = await getTranslations("Common")

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-12">
      <span role="status" aria-live="polite" className="sr-only">
        {t("loading")}
      </span>
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-9 w-56" />
          <Skeleton className="h-5 w-72" />
        </div>
        <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
          <Skeleton className="h-9 w-32" />
          <Skeleton className="h-9 w-32" />
        </div>
      </header>
      <div className="flex flex-col gap-4" aria-hidden="true">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-28 w-full" />
        ))}
      </div>
    </main>
  )
}
