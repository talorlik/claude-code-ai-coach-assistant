import { getTranslations } from "next-intl/server"

import { Skeleton } from "@/components/ui/skeleton"

/**
 * Route-level loading UI for `/[locale]/trainer/plans`, shown while the server
 * page awaits the template library and client list. The skeleton mirrors the
 * page header and a short list of template cards so the layout does not jump
 * when data arrives. A visually hidden, polite live region announces the loading
 * state to assistive technology; the text is localized.
 */
export default async function TrainerPlansLoading() {
  const t = await getTranslations("Common")

  return (
    <main className="container mx-auto flex flex-col gap-6 px-4 py-8">
      <span role="status" aria-live="polite" className="sr-only">
        {t("loading")}
      </span>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-9 w-52" />
        <Skeleton className="h-5 w-72" />
      </div>
      <div className="flex flex-col gap-3" aria-hidden="true">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    </main>
  )
}
