import type { ActionResult } from "@/lib/types/action-result"
import { fail, ok } from "@/lib/types/action-result"
import type { ProfileInput } from "@/lib/profile/profile-types"
import { normalizePhone } from "@/lib/auth/validation"

export interface ValidatedProfile {
  fullName: string
  phone: string
}

/**
 * Validates and normalizes editable profile fields. Name must be 2-120 chars;
 * phone, when provided, must normalize to 7-20 digits. Phone is optional.
 */
export function validateProfile(
  input: ProfileInput
): ActionResult<ValidatedProfile> {
  const fieldErrors: Record<string, string> = {}

  const fullName = input.fullName.trim()
  if (fullName.length < 2 || fullName.length > 120) {
    fieldErrors.fullName = "Name must be between 2 and 120 characters."
  }

  const phone = normalizePhone(input.phone)
  const digits = phone.replace(/\D/g, "")
  if (phone && (digits.length < 7 || digits.length > 20)) {
    fieldErrors.phone = "Enter a valid phone number or leave it blank."
  }

  if (Object.keys(fieldErrors).length > 0) {
    return fail("Please correct the highlighted fields.", fieldErrors)
  }

  return ok({ fullName, phone })
}
