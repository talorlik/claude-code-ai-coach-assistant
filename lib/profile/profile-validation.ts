import type { ActionResult } from "@/lib/types/action-result"
import { fail, ok } from "@/lib/types/action-result"
import type { ProfileInput } from "@/lib/profile/profile-types"
import { normalizePhone } from "@/lib/auth/validation"
import { PHONE_RE } from "@/lib/validation/onboarding"
import { countryByIso2 } from "@/lib/phone/countries"

/** Normalized, validated profile fields. `countryIso2` is null when phone is blank. */
export interface ValidatedProfile {
  fullName: string
  phone: string
  countryIso2: string | null
}

/**
 * Validates and normalizes editable profile fields. Name must be 2-120 chars.
 * Phone is optional: blank passes and stores an empty number with a null
 * country. When present, the phone must match the shared E.164 shape
 * ({@link PHONE_RE}) and `countryIso2` must be a known country code. Errors are
 * stable codes (`"length"`, `"invalid"`) localized by the caller.
 */
export function validateProfile(
  input: ProfileInput
): ActionResult<ValidatedProfile> {
  const fieldErrors: Record<string, string> = {}

  const fullName = input.fullName.trim()
  if (fullName.length < 2 || fullName.length > 120) {
    fieldErrors.fullName = "length"
  }

  const phone = normalizePhone(input.phone)
  let countryIso2: string | null = null

  if (phone) {
    if (!PHONE_RE.test(phone)) {
      fieldErrors.phone = "invalid"
    }
    const raw = (input.countryIso2 ?? "").trim().toUpperCase()
    if (!countryByIso2(raw)) {
      fieldErrors.countryIso2 = "invalid"
    } else {
      countryIso2 = raw
    }
  }

  if (Object.keys(fieldErrors).length > 0) {
    return fail("invalid", fieldErrors)
  }

  return ok({ fullName, phone, countryIso2 })
}
