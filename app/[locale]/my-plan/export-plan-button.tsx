"use client"

import * as React from "react"
import { useLocale, useTranslations } from "next-intl"
import { Download } from "lucide-react"

import { Button } from "@/components/ui/button"

/**
 * Localized "Export PDF" action for the plan view. It calls the protected
 * `/api/pdf/workout-plan` route with the active locale (and an optional
 * `clientId` for the trainer-admin export of a client's plan), then triggers a
 * browser download of the returned PDF blob.
 *
 * State is handled here rather than via a server action because the response is
 * a binary file, not JSON: a normal `fetch` lets us read the blob and create an
 * object URL. Loading and error copy come from the `MyPlan.export` namespace, so
 * the button is identical in English and Hebrew and inherits RTL from the
 * document `dir`.
 *
 * @param clientId - Optional target client; omit on the client's own plan so the
 *   route defaults the export to the signed-in caller.
 */
export function ExportPlanButton({ clientId }: { clientId?: string }) {
  const t = useTranslations("MyPlan")
  const locale = useLocale()
  const [pending, setPending] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  async function onExport() {
    setPending(true)
    setError(null)
    try {
      const params = new URLSearchParams({ locale })
      if (clientId) params.set("clientId", clientId)
      const res = await fetch(`/api/pdf/workout-plan?${params.toString()}`)
      if (!res.ok) {
        setError(t("export.error"))
        return
      }

      const blob = await res.blob()
      const filename = parseFilename(res.headers.get("content-disposition"))
      triggerDownload(blob, filename)
    } catch {
      setError(t("export.error"))
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        variant="outline"
        onClick={onExport}
        disabled={pending}
        data-testid="export-plan-pdf"
      >
        <Download className="size-4" aria-hidden="true" />
        {pending ? t("export.loading") : t("export.label")}
      </Button>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}

/** Extracts a filename from a `content-disposition` header, with a fallback. */
function parseFilename(disposition: string | null): string {
  const match = disposition?.match(/filename="?([^"]+)"?/i)
  return match?.[1] ?? "workout-plan.pdf"
}

/** Creates a temporary object URL and clicks a hidden anchor to save the blob. */
function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}
