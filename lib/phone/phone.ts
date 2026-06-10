import { COUNTRIES, countryByIso2, type Country } from "@/lib/phone/countries"

/** The selector's default country when none can be resolved. */
const DEFAULT_ISO2 = "IL"

/** Countries sorted by descending dial-code length for longest-prefix matching. */
const BY_DIAL_LENGTH: Country[] = [...COUNTRIES].sort(
  (a, b) => b.dialCode.length - a.dialCode.length
)

/** Strips every non-digit character, returning only the digits. */
function digitsOnly(value: string): string {
  return value.replace(/\D/g, "")
}

/**
 * Dial codes whose E.164 number retains the national leading "0" (the trunk
 * prefix is part of the dialable number, not a domestic-only prefix to strip).
 * Italy is the canonical case: a Rome fixed-line is `+39 06 ...` and the 0 is
 * kept, so its E.164 is `+390612345678`. For these, `combineE164` must NOT drop
 * the leading 0, otherwise editing a saved Italian number is non-idempotent
 * (split yields `06...`, recombine would corrupt it to `+396...`).
 *
 * Kept as an explicit, dial-code-keyed set rather than pulling in a full phone
 * library: the set is tiny and stable, and the selector's data is dial-code +
 * ISO2 only. Add a dial code here if the user base grows to a country with the
 * same keep-the-zero rule.
 */
const KEEP_LEADING_ZERO_DIAL_CODES: ReadonlySet<string> = new Set(["+39"])

/**
 * Joins a country dial code and a national number into a normalized E.164
 * string. The national part is reduced to its digits (separators, spaces, and
 * parentheses removed); a single leading trunk-prefix 0 is dropped for the
 * common case, EXCEPT for dial codes in {@link KEEP_LEADING_ZERO_DIAL_CODES}
 * (e.g. Italy) where the leading 0 is part of the E.164 number and is preserved.
 * The dial code is then prepended. Returns an empty string when the national
 * part contains no digits, so an empty field stores as empty rather than a bare
 * dial code.
 *
 * Preserving the zero for keep-the-zero countries makes editing a saved number
 * idempotent: `splitE164` -> display -> `combineE164` round-trips unchanged.
 *
 * @param dialCode - The country dial code with leading "+" (e.g. "+972").
 * @param national - The user-entered local number, possibly with separators.
 * @returns The E.164 string (e.g. "+972541234567"), or "" when no digits.
 */
export function combineE164(dialCode: string, national: string): string {
  const raw = digitsOnly(national)
  const digits = KEEP_LEADING_ZERO_DIAL_CODES.has(dialCode)
    ? raw
    : raw.replace(/^0/, "")
  if (digits.length === 0) return ""
  return `${dialCode}${digits}`
}

/**
 * Splits a stored E.164 string back into a selected country and a national
 * number for editing. Resolution order:
 *
 * 1. If `iso2` names a known country whose dial code prefixes the number, use it
 *    (this resolves shared dial codes like +1 to the exact stored country).
 * 2. Otherwise, the country whose dial code is the longest prefix of the number.
 * 3. Otherwise, the default country (Israel), with an empty national number.
 *
 * @param phone - The stored E.164 string (may be empty or malformed).
 * @param iso2 - The stored ISO2 country code, or null when absent.
 * @returns The resolved country and the national number (dial code removed).
 */
export function splitE164(
  phone: string,
  iso2: string | null
): { country: Country; national: string } {
  const fallback = countryByIso2(DEFAULT_ISO2)!

  if (!phone.startsWith("+")) {
    return { country: fallback, national: "" }
  }

  if (iso2) {
    const stored = countryByIso2(iso2)
    if (stored && phone.startsWith(stored.dialCode)) {
      // An exact-dial-code input (empty national) intentionally selects the
      // stored country with an empty national here, whereas the fallback loop
      // below skips bare-dial-code matches. A real stored E.164 always has a
      // national part, so the two paths never diverge in practice.
      return {
        country: stored,
        national: phone.slice(stored.dialCode.length),
      }
    }
  }

  for (const country of BY_DIAL_LENGTH) {
    if (phone.startsWith(country.dialCode)) {
      const national = phone.slice(country.dialCode.length)
      if (national.length > 0) return { country, national }
    }
  }

  return { country: fallback, national: "" }
}

/**
 * True when `query` matches the country on any of four axes: dial code (with or
 * without a leading "+"), ISO2 code, English name, or Hebrew name. All matching
 * is case-insensitive and substring-based; an empty/whitespace query matches
 * everything.
 *
 * @param query - The user's search text.
 * @param country - The country to test.
 */
export function matchCountry(query: string, country: Country): boolean {
  const q = query.trim().toLowerCase()
  if (q === "") return true

  const dial = country.dialCode.toLowerCase()
  const dialNoPlus = dial.replaceAll("+", "")
  const qNoPlus = q.replaceAll("+", "")

  return (
    dial.includes(q) ||
    dialNoPlus.includes(qNoPlus) ||
    country.iso2.toLowerCase().includes(q) ||
    country.nameEn.toLowerCase().includes(q) ||
    country.nameHe.includes(query.trim())
  )
}
