"use client"

import { useFormStatus } from "react-dom"

import { Button } from "@/components/ui/button"

/**
 * A form submit button that reflects the enclosing form's pending state via
 * `useFormStatus`. It must live in its own client component because
 * `useFormStatus` only reads the status of a parent `<form>` from a descendant,
 * which lets the surrounding form stay a Server Component.
 *
 * This is purely a progressive-enhancement affordance: with JavaScript the
 * button disables and swaps to `pendingLabel` while the server action runs;
 * without JavaScript the form still submits natively and this just renders a
 * normal submit button.
 *
 * @param label - The idle button text.
 * @param pendingLabel - The text shown while the action is in flight.
 */
export function SubmitButton({
  label,
  pendingLabel,
}: {
  label: string
  pendingLabel: string
}) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending} className="w-fit">
      {pending ? pendingLabel : label}
    </Button>
  )
}
