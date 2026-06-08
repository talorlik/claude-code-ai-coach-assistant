"use client"

import { useEffect, useState } from "react"
import { useTranslations } from "next-intl"
import { Download, Share, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  isIos,
  isStandalone,
  readInstallGlobals,
} from "@/lib/pwa/install"
import { cn } from "@/lib/utils"

/**
 * The `beforeinstallprompt` event shape (not in the standard DOM lib). Chromium
 * fires it before showing its native install UI; capturing it lets the app
 * offer a custom, localized install button and trigger the prompt on click.
 */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

/** Which affordance to render once client-side detection resolves. */
type Mode = "hidden" | "prompt" | "ios"

/** Props for the PWA install affordance. */
interface InstallPromptProps {
  /** Optional layout classes supplied by the shell that renders the affordance. */
  className?: string
}

/**
 * Dismissible "Install app" affordance shown in the header. Behavior, decided
 * after mount on the client:
 *
 *  - Already installed (`display-mode: standalone` or iOS `navigator.standalone`):
 *    renders nothing.
 *  - Chromium: waits for `beforeinstallprompt`, then shows an Install button
 *    that calls the captured event's `prompt()`. Hides once accepted or when the
 *    `appinstalled` event fires.
 *  - iOS Safari (no `beforeinstallprompt`): shows a button that opens localized
 *    Add-to-Home-Screen instructions in a dialog, since iOS has no programmatic
 *    install.
 *
 * The user can dismiss the affordance for the session via the close control.
 * All copy comes from the `Pwa` namespace and inherits the document `dir`, so it
 * is translatable and RTL-aware. Renders `null` until detection resolves to
 * avoid a hydration mismatch and a flash of the wrong state.
 *
 * @returns The install control, or `null` when it should not be shown.
 */
export function InstallPrompt({ className }: InstallPromptProps = {}) {
  const t = useTranslations("Pwa.install")
  const [mode, setMode] = useState<Mode>("hidden")
  const [dismissed, setDismissed] = useState(false)
  // The captured Chromium event; `prompt()` can only be called on this instance.
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(
    null
  )

  useEffect(() => {
    const globals = readInstallGlobals()
    if (isStandalone(globals)) {
      return
    }

    function onBeforeInstallPrompt(event: Event) {
      // Suppress Chromium's default mini-infobar so the custom button is the
      // single install entry point, and stash the event for the click handler.
      event.preventDefault()
      setDeferred(event as BeforeInstallPromptEvent)
      setMode("prompt")
    }

    function onInstalled() {
      // Once installed, drop the affordance immediately.
      setMode("hidden")
      setDeferred(null)
    }

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt)
    window.addEventListener("appinstalled", onInstalled)

    // iOS Safari never fires `beforeinstallprompt`; if it is iOS, show the
    // manual instructions path rather than waiting for an event that will not
    // come. Scheduled asynchronously so the effect body does not call setState
    // synchronously (which triggers cascading renders).
    const ios = isIos(globals)
    let active = true
    if (ios) {
      void Promise.resolve().then(() => {
        if (active) setMode("ios")
      })
    }

    return () => {
      active = false
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt)
      window.removeEventListener("appinstalled", onInstalled)
    }
  }, [])

  async function onInstallClick() {
    if (!deferred) return
    await deferred.prompt()
    const choice = await deferred.userChoice.catch(() => null)
    // The event can only be used once; clear it. If accepted, `appinstalled`
    // will also hide the affordance, but clear eagerly so the button cannot be
    // pressed twice.
    setDeferred(null)
    if (choice?.outcome === "accepted") {
      setMode("hidden")
    }
  }

  if (dismissed || mode === "hidden") {
    return null
  }

  if (mode === "ios") {
    return (
      <Dialog>
        <div className={cn("flex items-center gap-1", className)}>
          <DialogTrigger
            render={
              <Button variant="outline" size="sm">
                <Download aria-hidden className="size-4" />
                {t("button")}
              </Button>
            }
          />
          <Button
            variant="ghost"
            size="icon"
            aria-label={t("dismiss")}
            onClick={() => setDismissed(true)}
          >
            <X aria-hidden className="size-4" />
          </Button>
        </div>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("iosTitle")}</DialogTitle>
            <DialogDescription>{t("iosIntro")}</DialogDescription>
          </DialogHeader>
          <ol className="list-decimal space-y-2 ps-5 text-sm">
            <li className="flex items-center gap-2">
              <Share aria-hidden className="size-4 shrink-0" />
              <span>{t("iosStep1")}</span>
            </li>
            <li>{t("iosStep2")}</li>
            <li>{t("iosStep3")}</li>
          </ol>
        </DialogContent>
      </Dialog>
    )
  }

  // mode === "prompt"
  return (
    <div className={cn("flex items-center gap-1", className)}>
      <Button variant="outline" size="sm" onClick={onInstallClick}>
        <Download aria-hidden className="size-4" />
        {t("button")}
      </Button>
      <Button
        variant="ghost"
        size="icon"
        aria-label={t("dismiss")}
        onClick={() => setDismissed(true)}
      >
        <X aria-hidden className="size-4" />
      </Button>
    </div>
  )
}
