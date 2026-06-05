"use client"

import * as React from "react"
import { useTranslations } from "next-intl"
import { RefreshCw } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { REGENERATION_REASON_MAX_LENGTH } from "@/lib/validation/regeneration"
import type { ActionResult } from "@/lib/types/action-result"

/** Field-error codes the reason input can surface, plus general error codes. */
const REASON_ERROR_KEYS = ["required", "tooShort", "tooLong"] as const
const GENERAL_ERROR_KEYS = ["noClient", "aiError", "saveError"] as const
type KnownErrorKey =
  | (typeof REASON_ERROR_KEYS)[number]
  | (typeof GENERAL_ERROR_KEYS)[number]

/** Narrows an arbitrary code to one this dialog knows how to localize. */
function isKnownErrorKey(code: string | undefined): code is KnownErrorKey {
  if (code == null) return false
  return (
    (REASON_ERROR_KEYS as readonly string[]).includes(code) ||
    (GENERAL_ERROR_KEYS as readonly string[]).includes(code)
  )
}

/** Minimal success shape the dialog needs from a regeneration action. */
export interface RegenerateSuccess {
  workoutCount: number
}

/**
 * Reusable plan-regeneration dialog shared by the client My Plan page and the
 * trainer client dashboard. It renders a trigger button, a confirmation dialog
 * explaining the current plan will be archived, and a required reason textarea.
 * On submit it calls the injected `onRegenerate` callback (the page binds the
 * correct server action, so the dialog stays generic and unaware of who is
 * triggering it). Reason validation errors and AI/save failures are mapped to
 * localized copy under the `Regeneration` namespace; a success closes the dialog
 * and refreshes the page so the new active plan renders.
 *
 * Copy comes from the `Regeneration` namespace and is identical in both locales;
 * the dialog inherits RTL from the document direction.
 *
 * @param onRegenerate - Server-action wrapper taking the reason and returning an
 *   `ActionResult`. The caller binds any extra arguments (e.g. clientId).
 * @param onSuccess - Optional callback fired after a successful regeneration,
 *   used to refresh server-rendered data.
 * @param variant - Visual emphasis of the trigger button; defaults to outline.
 */
export function RegeneratePlanDialog({
  onRegenerate,
  onSuccess,
  variant = "outline",
}: {
  onRegenerate: (reason: string) => Promise<ActionResult<RegenerateSuccess>>
  onSuccess?: () => void
  variant?: "outline" | "default" | "secondary"
}) {
  const t = useTranslations("Regeneration")
  const [open, setOpen] = React.useState(false)
  const [reason, setReason] = React.useState("")
  const [pending, setPending] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  function resetState() {
    setReason("")
    setError(null)
    setPending(false)
  }

  /** Maps a server failure (field code or general code) to display copy. */
  function messageFor(result: {
    error: string
    fieldErrors?: Record<string, string>
  }): string {
    const code = result.fieldErrors?.reason ?? result.error
    if (isKnownErrorKey(code)) {
      return t(`errors.${code}`)
    }
    return t("errors.generic")
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    setPending(true)
    setError(null)

    const result = await onRegenerate(reason)
    setPending(false)

    if (!result.ok) {
      setError(messageFor(result))
      return
    }

    resetState()
    setOpen(false)
    onSuccess?.()
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) resetState()
      }}
    >
      <DialogTrigger
        render={<Button variant={variant} className="gap-2" />}
        data-testid="regenerate-open"
      >
        <RefreshCw className="size-4" aria-hidden="true" />
        {t("trigger")}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{t("title")}</DialogTitle>
            <DialogDescription>{t("description")}</DialogDescription>
          </DialogHeader>

          <div className="grid gap-2">
            <Label htmlFor="regeneration-reason">{t("reasonLabel")}</Label>
            <Textarea
              id="regeneration-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t("reasonPlaceholder")}
              maxLength={REGENERATION_REASON_MAX_LENGTH}
              rows={3}
              data-testid="regenerate-reason"
            />
          </div>

          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}

          <DialogFooter>
            <DialogClose
              render={<Button type="button" variant="ghost" />}
              disabled={pending}
            >
              {t("cancel")}
            </DialogClose>
            <Button
              type="submit"
              disabled={pending || reason.trim() === ""}
              data-testid="regenerate-submit"
            >
              {pending ? t("submitting") : t("submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
