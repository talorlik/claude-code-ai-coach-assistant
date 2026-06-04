import { Skeleton } from "@/components/ui/skeleton"

/**
 * Route-level loading UI for `/[locale]/trainer`, shown by the App Router while
 * the server page awaits its client query. A few skeleton rows stand in for the
 * client list so the layout does not jump when data arrives. Purely visual and
 * locale-agnostic, so no translation lookup is needed.
 */
export default function TrainerLoading() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-12">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-5 w-72" />
      </div>
      <div className="flex flex-col gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    </main>
  )
}
