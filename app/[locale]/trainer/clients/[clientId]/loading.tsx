import { getTranslations } from "next-intl/server"

import { Skeleton } from "@/components/ui/skeleton"

/**
 * Route-level loading UI for `/[locale]/trainer/clients/[clientId]`, shown while
 * the server page awaits the client dashboard bundle (profile, plan, logs, chat,
 * notes). The skeleton mirrors the header and the two-column dashboard grid so
 * the layout stays stable when data arrives. A visually hidden, polite live
 * region announces the loading state to assistive technology; the text is
 * localized.
 */
export default async function TrainerClientLoading() {
  const t = await getTranslations("Common")

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-12">
      <span role="status" aria-live="polite" className="sr-only">
        {t("loading")}
      </span>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-5 w-40" />
      </div>
      <div
        className="grid grid-cols-1 gap-6 lg:grid-cols-2"
        aria-hidden="true"
      >
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-48 w-full" />
        ))}
      </div>
    </main>
  )
}
