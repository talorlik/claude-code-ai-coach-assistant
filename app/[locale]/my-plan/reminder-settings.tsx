"use client"

import { useEffect, useState } from "react"
import { useTranslations } from "next-intl"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { disablePush, enablePush, readPushState } from "@/lib/push/client"
import { isPushSupported, readBrowserGlobals } from "@/lib/push/support"

/** Visible status of the opt-in flow, driving the inline feedback message. */
type Status = "idle" | "working" | "enabled" | "denied" | "error"

/**
 * Client reminder-settings card on the My Plan page. Detects Web Push support on
 * mount and renders one of two states:
 *
 *  - Unsupported browser (or push not configured): a clear, localized message
 *    explaining reminders are unavailable - the graceful degradation the feature
 *    requires. No toggle is shown.
 *  - Supported: a switch that runs the opt-in (permission -> subscribe -> persist)
 *    when turned on and the teardown (unsubscribe -> disable) when turned off,
 *    with inline localized feedback for granted/denied/error.
 *
 * The VAPID public key is passed from the server (it is the browser-safe half of
 * the key pair). When it is empty the deployment has not configured push, so the
 * card shows the unsupported state rather than a non-functional toggle.
 *
 * @param vapidPublicKey - The base64url VAPID public key, or `""` when unconfigured.
 */
export function ReminderSettings({
  vapidPublicKey,
}: {
  vapidPublicKey: string
}) {
  const t = useTranslations("Reminders")
  // `null` means "not yet detected" (server render and first client paint), so
  // nothing renders until the client-only capability check resolves. This avoids
  // a hydration mismatch and keeps the effect free of synchronous setState.
  const [supported, setSupported] = useState<boolean | null>(null)
  const [checked, setChecked] = useState(false)
  const [status, setStatus] = useState<Status>("idle")

  useEffect(() => {
    let active = true

    // Run detection and the initial state read together as one async step, so
    // the effect body schedules work rather than setting state synchronously.
    async function detect() {
      const ok = isPushSupported(readBrowserGlobals()) && vapidPublicKey !== ""
      if (!ok) {
        if (active) setSupported(false)
        return
      }
      const { permission, subscribed } = await readPushState().catch(() => ({
        permission: "default" as const,
        subscribed: false,
      }))
      if (!active) return
      setSupported(true)
      setChecked(subscribed)
      if (permission === "denied") setStatus("denied")
      else if (subscribed) setStatus("enabled")
    }

    void detect()
    return () => {
      active = false
    }
  }, [vapidPublicKey])

  async function onToggle(next: boolean) {
    setStatus("working")
    try {
      if (next) {
        const endpoint = await enablePush(vapidPublicKey)
        if (endpoint === null) {
          setChecked(false)
          setStatus("denied")
          return
        }
        setChecked(true)
        setStatus("enabled")
      } else {
        await disablePush()
        setChecked(false)
        setStatus("idle")
      }
    } catch {
      setChecked(false)
      setStatus("error")
    }
  }

  // Detection has not resolved yet (server render / first paint): render nothing
  // to avoid a flash of the wrong state and any hydration mismatch.
  if (supported === null) {
    return null
  }

  if (!supported) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t("title")}</CardTitle>
          <CardDescription>{t("description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertTitle>{t("unsupported.title")}</AlertTitle>
            <AlertDescription>{t("unsupported.description")}</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4">
          <label htmlFor="reminders-toggle" className="text-sm font-medium">
            {t("toggle.label")}
          </label>
          <Switch
            id="reminders-toggle"
            checked={checked}
            disabled={status === "working"}
            onCheckedChange={onToggle}
            aria-label={t("toggle.label")}
          />
        </div>
        {status === "enabled" ? (
          <p className="text-sm text-muted-foreground">{t("status.enabled")}</p>
        ) : null}
        {status === "denied" ? (
          <Alert>
            <AlertTitle>{t("status.deniedTitle")}</AlertTitle>
            <AlertDescription>{t("status.deniedDescription")}</AlertDescription>
          </Alert>
        ) : null}
        {status === "error" ? (
          <Alert>
            <AlertTitle>{t("status.errorTitle")}</AlertTitle>
            <AlertDescription>{t("status.errorDescription")}</AlertDescription>
          </Alert>
        ) : null}
      </CardContent>
    </Card>
  )
}
