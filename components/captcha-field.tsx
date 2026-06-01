"use client"

import { useRef, useState } from "react"
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile"
import { useTheme } from "next-themes"

/**
 * Cloudflare Turnstile captcha field for auth forms.
 *
 * The widget solves a challenge in the browser and yields a short-lived token,
 * mirrored into a hidden `<input name="captchaToken">` so the enclosing
 * server-action form carries it unchanged. The action forwards it to Supabase
 * as `options.captchaToken`, which Supabase verifies against the secret key.
 *
 * Degrades gracefully: when `NEXT_PUBLIC_TURNSTILE_SITE_KEY` is unset, nothing
 * renders and no hidden input is emitted, so forms keep working. On expiry or
 * error the token is cleared so a stale token is never submitted.
 */
export function CaptchaField() {
  const { resolvedTheme } = useTheme()
  const ref = useRef<TurnstileInstance | null>(null)
  const [token, setToken] = useState("")
  const [errored, setErrored] = useState(false)

  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
  if (!siteKey) return null

  return (
    <div className="flex flex-col gap-2">
      <input type="hidden" name="captchaToken" value={token} />
      <Turnstile
        ref={ref}
        siteKey={siteKey}
        options={{
          theme: resolvedTheme === "dark" ? "dark" : "light",
          language: "en",
        }}
        onSuccess={(value) => {
          setToken(value)
          setErrored(false)
        }}
        onExpire={() => {
          setToken("")
          ref.current?.reset()
        }}
        onError={() => {
          setToken("")
          setErrored(true)
        }}
      />
      {errored ? (
        <p className="text-sm text-destructive" role="alert">
          Captcha verification failed. Please try again.
        </p>
      ) : null}
    </div>
  )
}
