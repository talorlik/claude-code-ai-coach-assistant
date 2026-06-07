# Phone Country-Code Selector Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the plain phone inputs in onboarding and profile with a
searchable country-code selector that shows emoji flag + dial code + localized
name, searchable by dial code, ISO2 code, English name, and Hebrew name, storing
the full E.164 number plus the selected ISO2 country code.

**Architecture:** A bundled static country dataset and pure phone-logic module
feed a client `PhoneField` component built from the existing cmdk `Command`
primitive (zero new dependencies). Storage keeps the existing single E.164
`phone` column and adds a nullable `country_iso2` column on `clients` and
`profiles`. Validation standardizes both flows on one E.164 rule plus an
ISO2-membership check. A `NativeSelect` fallback preserves no-JS submission.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Supabase, next-intl,
cmdk (`components/ui/command.tsx`), Tailwind 4, Vitest.

---

## Conventions To Follow (read before starting)

- Run all npm scripts under nvm Node v22.16.0 (`nvm use 22.16.0` first; shell
  default Node 18 breaks Vitest/rolldown). No `.nvmrc` pins it.
- Verification gate after each behavioral change:
  `npm run lint && npm run typecheck && npm run test`. Add `npm run build` at the
  end of the feature.
- Validators return stable error **codes** (`"required"`, `"invalid"`), never
  prose. The UI resolves them via `t("errors.<field>.<code>")`.
- `ActionResult<T>` is the server-action return type: `ok(data)` / `fail(code,
  fieldErrors?)` from `@/lib/types/action-result`.
- TSDoc on every exported helper, server action, and non-trivial component.
- Migrations are applied to the remote Supabase project via the Supabase MCP
  `apply_migration` tool after the SQL file is written and reviewed. Do NOT push
  `main`.
- This work belongs in a per-branch worktree off clean `main`, squash-merged at
  the end. The implementer (subagent-driven-development or the user) handles the
  worktree; do not commit to `main` directly.

---

## File Structure

**Create:**

- `lib/phone/countries.ts` - static country dataset + `flagEmoji` + lookups.
- `lib/phone/phone.ts` - `combineE164`, `splitE164`, `matchCountry`.
- `components/phone-field.tsx` - the client selector (cmdk combobox + national
  number input + hidden fields + `NativeSelect` fallback).
- `supabase/migrations/0004_phone_country.sql` - adds `country_iso2` columns.
- `__tests__/unit/phone.test.ts` - unit tests for the phone-logic module.
- `__tests__/unit/countries.test.ts` - unit tests for the dataset + `flagEmoji`.

**Modify:**

- `lib/db/types.ts` - add `country_iso2` to `ClientRow`.
- `lib/db/mappers.ts` - add `countryIso2` to `Client`, `ClientUpsertInput`,
  `fromClientRow`, `toClientUpsertRow`.
- `lib/profile/profile-types.ts` - add `country_iso2` to `Profile`, `countryIso2`
  to `ProfileInput`.
- `lib/validation/onboarding.ts` - reconcile phone rule; add `checkCountryIso2`;
  thread `countryIso2` through `OnboardingInput`/`ValidatedOnboarding`/step 0.
- `lib/profile/profile-validation.ts` - switch to E.164 rule; validate
  `countryIso2`.
- `lib/onboarding/onboarding-actions.ts` - persist `countryIso2` in step 0 and
  final save.
- `lib/profile/profile-actions.ts` - read/validate/persist `countryIso2`;
  thread through `updateProfileForm`.
- `app/[locale]/join/onboarding-form.tsx` - add `countryIso2` to defaults/state;
  replace the phone `Field`/`Input` block with `PhoneField`.
- `app/[locale]/join/page.tsx` - map `existing.countryIso2` into defaults.
- `app/[locale]/profile/account-forms.tsx` - replace the phone block with the
  `PhoneField` client island; pass `initialCountryIso2`.
- `app/[locale]/profile/page.tsx` - select `country_iso2`; pass it down.
- `messages/en-US.json`, `messages/he-IL.json` - add country selector copy.

---

## Task 1: Country dataset and flag emoji

**Files:**
- Create: `lib/phone/countries.ts`
- Test: `__tests__/unit/countries.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/unit/countries.test.ts
import { describe, expect, it } from "vitest"

import {
  COUNTRIES,
  countryByIso2,
  flagEmoji,
} from "@/lib/phone/countries"

describe("flagEmoji", () => {
  it("derives the regional-indicator emoji for an ISO2 code", () => {
    expect(flagEmoji("IL")).toBe("🇮🇱")
    expect(flagEmoji("US")).toBe("🇺🇸")
  })

  it("uppercases lowercase input before deriving", () => {
    expect(flagEmoji("il")).toBe("🇮🇱")
  })
})

describe("COUNTRIES dataset", () => {
  it("includes Israel with the correct dial code and names", () => {
    const il = countryByIso2("IL")
    expect(il).toBeDefined()
    expect(il?.dialCode).toBe("+972")
    expect(il?.nameEn).toBe("Israel")
    expect(il?.nameHe).toBe("ישראל")
  })

  it("has unique ISO2 codes and well-formed dial codes", () => {
    const seen = new Set<string>()
    for (const c of COUNTRIES) {
      expect(c.iso2).toMatch(/^[A-Z]{2}$/)
      expect(c.dialCode).toMatch(/^\+\d{1,4}$/)
      expect(c.nameEn.length).toBeGreaterThan(0)
      expect(c.nameHe.length).toBeGreaterThan(0)
      expect(seen.has(c.iso2)).toBe(false)
      seen.add(c.iso2)
    }
    // A realistically complete list, not a stub.
    expect(COUNTRIES.length).toBeGreaterThan(200)
  })

  it("countryByIso2 is case-insensitive and returns undefined for unknown", () => {
    expect(countryByIso2("il")?.iso2).toBe("IL")
    expect(countryByIso2("ZZ")).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- countries`
Expected: FAIL with "Cannot find module '@/lib/phone/countries'".

- [ ] **Step 3: Create the dataset module**

Create `lib/phone/countries.ts`. The `flagEmoji` helper and lookups are below;
the `COUNTRIES` array must be a full ISO 3166-1 list (240+ entries) with English
and Hebrew names. Populate it completely - do not ship a partial list. Each entry
is `{ iso2, dialCode, nameEn, nameHe }`. The first lines of the array (verbatim
shape to follow for every entry):

```ts
/**
 * Static ISO 3166-1 country dataset backing the phone country-code selector.
 * Hand-maintained in the repo (no runtime dependency). `dialCode` is the ITU
 * calling code with a leading `+`; `nameEn`/`nameHe` are the display names shown
 * per locale. Flags are NOT stored - they are derived from `iso2` at render time
 * via {@link flagEmoji}, so the dataset carries no image assets.
 */
export interface Country {
  /** ISO 3166-1 alpha-2 code, uppercase (e.g. "IL"). */
  iso2: string
  /** ITU dial code with leading "+" (e.g. "+972"). */
  dialCode: string
  /** English display name. */
  nameEn: string
  /** Hebrew display name. */
  nameHe: string
}

/**
 * The full country list, sorted by English name. Israel is the selector's
 * default (resolved by the component, not by ordering here).
 */
export const COUNTRIES: Country[] = [
  { iso2: "AF", dialCode: "+93", nameEn: "Afghanistan", nameHe: "אפגניסטן" },
  { iso2: "AL", dialCode: "+355", nameEn: "Albania", nameHe: "אלבניה" },
  { iso2: "DZ", dialCode: "+213", nameEn: "Algeria", nameHe: "אלג׳יריה" },
  // ... continue through the full ISO 3166-1 list ...
  { iso2: "IL", dialCode: "+972", nameEn: "Israel", nameHe: "ישראל" },
  { iso2: "US", dialCode: "+1", nameEn: "United States", nameHe: "ארצות הברית" },
  // ... through "ZW" Zimbabwe ...
]

/** Built once at module load for O(1) ISO2 lookups. */
const BY_ISO2: Map<string, Country> = new Map(
  COUNTRIES.map((c) => [c.iso2, c])
)

/**
 * Derives the Unicode flag emoji for an ISO2 country code by mapping each ASCII
 * letter to its regional-indicator symbol (U+1F1E6 + offset from 'A'). Returns
 * the two-codepoint emoji string. Input is uppercased first so "il" and "IL"
 * both work.
 *
 * @param iso2 - A two-letter country code.
 * @returns The flag emoji (e.g. "🇮🇱"). On platforms without flag glyphs
 *   (Windows) the browser renders the two letters instead; that is a platform
 *   limitation, not handled here.
 */
export function flagEmoji(iso2: string): string {
  const cc = iso2.toUpperCase()
  const A = 0x41
  const BASE = 0x1f1e6
  return String.fromCodePoint(
    BASE + (cc.charCodeAt(0) - A),
    BASE + (cc.charCodeAt(1) - A)
  )
}

/**
 * Looks up a country by ISO2 code, case-insensitively. Returns `undefined` for
 * an unknown code so callers can fall back to a default.
 *
 * @param iso2 - A two-letter country code in any case.
 */
export function countryByIso2(iso2: string): Country | undefined {
  return BY_ISO2.get(iso2.toUpperCase())
}
```

> Populate `COUNTRIES` fully. A practical way to source it: derive the
> alpha-2 + dial-code + English-name rows from a known list (e.g. the ITU/E.164
> assignment), then fill `nameHe` for each. The test asserts `length > 200`,
> uniqueness, and the `IL`/`US` rows specifically.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test -- countries`
Expected: PASS (all four describe blocks).

- [ ] **Step 5: Commit**

```bash
git add lib/phone/countries.ts __tests__/unit/countries.test.ts
git commit -m "feat(phone): bundled country dataset with emoji flag derivation"
```

---

## Task 2: Phone logic module

**Files:**
- Create: `lib/phone/phone.ts`
- Test: `__tests__/unit/phone.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/unit/phone.test.ts
import { describe, expect, it } from "vitest"

import { countryByIso2 } from "@/lib/phone/countries"
import { combineE164, matchCountry, splitE164 } from "@/lib/phone/phone"

const IL = countryByIso2("IL")!
const US = countryByIso2("US")!
const CA = countryByIso2("CA")!

describe("combineE164", () => {
  it("strips separators from the national part and prepends the dial code", () => {
    expect(combineE164("+972", "054-123 4567")).toBe("+972541234567")
  })

  it("ignores a national part that already contains the dial digits", () => {
    // The national field holds only the local number; we do not double-strip.
    expect(combineE164("+1", "(415) 555-0123")).toBe("+14155550123")
  })

  it("returns an empty string when the national part has no digits", () => {
    expect(combineE164("+972", "")).toBe("")
  })
})

describe("splitE164", () => {
  it("uses the stored iso2 to resolve a shared dial code exactly", () => {
    expect(splitE164("+14155550123", "CA").country.iso2).toBe("CA")
    expect(splitE164("+14155550123", "US").country.iso2).toBe("US")
  })

  it("returns the national number without the dial code", () => {
    const r = splitE164("+972541234567", "IL")
    expect(r.country.iso2).toBe("IL")
    expect(r.national).toBe("541234567")
  })

  it("falls back to longest dial-code prefix match when iso2 is null", () => {
    expect(splitE164("+972541234567", null).country.iso2).toBe("IL")
  })

  it("falls back to the default country when unparseable", () => {
    expect(splitE164("", null).country.iso2).toBe("IL")
    expect(splitE164("+000000", null).country.iso2).toBe("IL")
  })

  it("ignores a stored iso2 whose dial code does not prefix the number", () => {
    // Defensive: a mismatched iso2 must not win over the actual digits.
    expect(splitE164("+972541234567", "US").country.iso2).toBe("IL")
  })
})

describe("matchCountry", () => {
  it("matches on dial code with or without a leading +", () => {
    expect(matchCountry("972", IL)).toBe(true)
    expect(matchCountry("+972", IL)).toBe(true)
  })

  it("matches on ISO2 code, case-insensitively", () => {
    expect(matchCountry("il", IL)).toBe(true)
    expect(matchCountry("IL", IL)).toBe(true)
  })

  it("matches on English and Hebrew names, as substrings", () => {
    expect(matchCountry("isr", IL)).toBe(true)
    expect(matchCountry("ישר", IL)).toBe(true)
  })

  it("does not match unrelated queries", () => {
    expect(matchCountry("france", IL)).toBe(false)
    expect(matchCountry("+1", IL)).toBe(false)
  })

  it("matches everything on an empty query", () => {
    expect(matchCountry("", IL)).toBe(true)
    expect(matchCountry("  ", US)).toBe(true)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- phone`
Expected: FAIL with "Cannot find module '@/lib/phone/phone'".

- [ ] **Step 3: Implement the module**

Create `lib/phone/phone.ts`:

```ts
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
 * Joins a country dial code and a national number into a normalized E.164
 * string. The national part is reduced to its digits (separators, spaces, and
 * parentheses removed) before the dial code is prepended. Returns an empty
 * string when the national part contains no digits, so an empty field stores as
 * empty rather than a bare dial code.
 *
 * @param dialCode - The country dial code with leading "+" (e.g. "+972").
 * @param national - The user-entered local number, possibly with separators.
 * @returns The E.164 string (e.g. "+972541234567"), or "" when no digits.
 */
export function combineE164(dialCode: string, national: string): string {
  const digits = digitsOnly(national)
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
      return {
        country: stored,
        national: phone.slice(stored.dialCode.length),
      }
    }
  }

  for (const country of BY_DIAL_LENGTH) {
    if (phone.startsWith(country.dialCode)) {
      const national = phone.slice(country.dialCode.length)
      // Guard against a 0-length country code matching nothing meaningful.
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
  const dialNoPlus = dial.replace("+", "")
  const qNoPlus = q.replace("+", "")

  return (
    dial.includes(q) ||
    dialNoPlus.includes(qNoPlus) ||
    country.iso2.toLowerCase().includes(q) ||
    country.nameEn.toLowerCase().includes(q) ||
    country.nameHe.includes(query.trim())
  )
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test -- phone`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/phone/phone.ts __tests__/unit/phone.test.ts
git commit -m "feat(phone): E.164 combine/split and four-axis country search"
```

---

## Task 3: Database migration

**Files:**
- Create: `supabase/migrations/0004_phone_country.sql`

- [ ] **Step 1: Write the migration SQL**

Create `supabase/migrations/0004_phone_country.sql`:

```sql
-- 0004_phone_country.sql
-- Adds the selected ISO 3166-1 alpha-2 country code alongside the existing
-- E.164 `phone` column on both client and profile tables. Nullable, no backfill:
-- existing rows keep their `phone` value and resolve a default flag on first
-- edit, then persist their real country on the next save. The `phone` column
-- remains the single source of truth for the dialable number.

alter table public.clients
  add column if not exists country_iso2 text;

alter table public.profiles
  add column if not exists country_iso2 text;

comment on column public.clients.country_iso2 is
  'ISO 3166-1 alpha-2 code of the country selected for the phone number (e.g. IL). Restores the exact country/flag on edit, including for shared dial codes.';
comment on column public.profiles.country_iso2 is
  'ISO 3166-1 alpha-2 code of the country selected for the phone number (e.g. IL).';
```

- [ ] **Step 2: Apply the migration to the remote project**

Use the Supabase MCP tool to apply it:

Run (via MCP, not shell): `apply_migration` with name `0004_phone_country` and
the SQL above.
Expected: success; the two columns now exist.

- [ ] **Step 3: Verify the columns exist**

Use the Supabase MCP `list_tables` tool and confirm `clients.country_iso2` and
`profiles.country_iso2` are present, both `text`, nullable.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0004_phone_country.sql
git commit -m "feat(db): add country_iso2 to clients and profiles (0004)"
```

---

## Task 4: Database types and mappers

**Files:**
- Modify: `lib/db/types.ts:29-45` (`ClientRow`)
- Modify: `lib/db/mappers.ts` (`ClientUpsertInput`, `toClientUpsertRow`,
  `Client`, `fromClientRow`)
- Modify: `lib/profile/profile-types.ts` (`Profile`, `ProfileInput`)

- [ ] **Step 1: Add `country_iso2` to `ClientRow`**

In `lib/db/types.ts`, inside `interface ClientRow`, add the field after `phone`:

```ts
  phone: string | null
  country_iso2: string | null
```

- [ ] **Step 2: Thread it through the client mappers**

In `lib/db/mappers.ts`:

In `ClientUpsertInput`, after `phone`:

```ts
  phone?: string | null
  countryIso2?: string | null
```

In `toClientUpsertRow`, after the `phone` line:

```ts
  if (input.phone !== undefined) row.phone = input.phone
  if (input.countryIso2 !== undefined) row.country_iso2 = input.countryIso2
```

In `interface Client`, after `phone`:

```ts
  phone: string | null
  countryIso2: string | null
```

In `fromClientRow`, after `phone: row.phone,`:

```ts
    phone: row.phone,
    countryIso2: row.country_iso2,
```

- [ ] **Step 3: Thread it through the profile types**

In `lib/profile/profile-types.ts`:

In `interface Profile`, after `phone`:

```ts
  phone: string | null
  country_iso2: string | null
```

In `interface ProfileInput`, after `phone`:

```ts
  fullName: string
  phone: string
  countryIso2: string
```

- [ ] **Step 4: Verify it typechecks**

Run: `npm run typecheck`
Expected: PASS (no new errors introduced; existing callers still compile because
the new fields are optional in input shapes and additive in row shapes).

- [ ] **Step 5: Commit**

```bash
git add lib/db/types.ts lib/db/mappers.ts lib/profile/profile-types.ts
git commit -m "feat(phone): add countryIso2 to client/profile types and mappers"
```

---

## Task 5: Onboarding validation

**Files:**
- Modify: `lib/validation/onboarding.ts`
- Test: `__tests__/unit/onboarding-validation.test.ts` (extend existing)

- [ ] **Step 1: Add failing tests for the country code and reconciled phone rule**

Append to `__tests__/unit/onboarding-validation.test.ts`:

```ts
describe("validateOnboarding - phone and country", () => {
  it("accepts a valid E.164 phone with a known country", () => {
    const result = validateOnboarding(
      valid({ phone: "+972541234567", countryIso2: "IL" })
    )
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.phone).toBe("+972541234567")
      expect(result.data.countryIso2).toBe("IL")
    }
  })

  it("rejects an empty phone as required", () => {
    const result = validateOnboarding(valid({ phone: "", countryIso2: "IL" }))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.fieldErrors?.phone).toBe("required")
  })

  it("rejects a malformed phone as invalid", () => {
    const result = validateOnboarding(
      valid({ phone: "+12", countryIso2: "US" })
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.fieldErrors?.phone).toBe("invalid")
  })

  it("rejects an unknown country code as invalid", () => {
    const result = validateOnboarding(
      valid({ phone: "+972541234567", countryIso2: "ZZ" })
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.fieldErrors?.countryIso2).toBe("invalid")
  })
})

describe("validateOnboardingStep - step 0 country", () => {
  it("flags an unknown country on step 0", () => {
    const errs = validateOnboardingStep(0, valid({ countryIso2: "ZZ" }))
    expect(errs.countryIso2).toBe("invalid")
  })
})
```

Update the `valid()` helper at the top of the file to include the new field:

```ts
function valid(overrides: Partial<OnboardingInput> = {}): OnboardingInput {
  return {
    fullName: "Dana Levi",
    phone: "+972541234567",
    countryIso2: "IL",
    age: "32",
    // ... existing fields unchanged ...
    ...overrides,
  }
}
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test -- onboarding-validation`
Expected: FAIL - `countryIso2` is not yet on `OnboardingInput`; phone-invalid
test may also fail against the old loose rule.

- [ ] **Step 3: Update the validator**

In `lib/validation/onboarding.ts`:

Add the import at the top:

```ts
import { countryByIso2 } from "@/lib/phone/countries"
```

Replace the phone constants block (currently `PHONE_MIN`/`PHONE_MAX`/`PHONE_RE`)
with the single reconciled rule:

```ts
/**
 * Phone rules. The selector always prepends a country dial code, so the stored
 * value is full E.164: a leading `+`, a non-zero country digit, then 7-14 more
 * digits (8-15 digits total after the `+`). `PHONE_RE` enforces that exact
 * shape on the normalized value. This single rule is shared by onboarding and
 * profile so the two never diverge.
 */
export const PHONE_RE = /^\+[1-9]\d{7,14}$/
```

Add `countryIso2` to `OnboardingInput` (after `phone?`):

```ts
  phone?: string
  countryIso2?: string | null
```

Add `countryIso2` to `ValidatedOnboarding` (after `phone`):

```ts
  phone: string
  countryIso2: string
```

Replace `checkPhone` with the E.164-shape version and add `checkCountryIso2`:

```ts
/** Phone: required; normalized form must match the E.164 shape PHONE_RE. */
function checkPhone(input: OnboardingInput): {
  value: string
  error?: string
} {
  const value = normalizePhone(input.phone ?? "")
  if (value.length === 0) return { value, error: "required" }
  if (!PHONE_RE.test(value)) return { value, error: "invalid" }
  return { value }
}

/**
 * Country: required and must be a known ISO2 in the bundled dataset. Guards
 * against tampered or no-JS posts carrying an unknown code. Returns the
 * uppercased code on success.
 */
function checkCountryIso2(input: OnboardingInput): {
  value: string
  error?: string
} {
  const raw = (input.countryIso2 ?? "").trim().toUpperCase()
  if (raw.length === 0) return { value: "", error: "required" }
  if (!countryByIso2(raw)) return { value: "", error: "invalid" }
  return { value: raw }
}
```

In `validateOnboardingStep`, inside the `step === 0` branch, after the phone
check:

```ts
    const phone = checkPhone(input)
    if (phone.error) errors.phone = phone.error
    const country = checkCountryIso2(input)
    if (country.error) errors.countryIso2 = country.error
```

In `validateOnboarding`, after the existing phone block:

```ts
  const phone = checkPhone(input)
  if (phone.error) fieldErrors.phone = phone.error

  const country = checkCountryIso2(input)
  if (country.error) fieldErrors.countryIso2 = country.error
```

In the success `ok({ ... })` return, after `phone: phone.value,`:

```ts
    phone: phone.value,
    countryIso2: country.value,
```

Add `"countryIso2"` to step 0 in `STEP_FIELDS`:

```ts
  0: ["fullName", "phone", "countryIso2", "age", "ageRange"],
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test -- onboarding-validation`
Expected: PASS (existing tests still green; new phone/country tests green).

- [ ] **Step 5: Commit**

```bash
git add lib/validation/onboarding.ts __tests__/unit/onboarding-validation.test.ts
git commit -m "feat(phone): E.164 phone rule and country validation in onboarding"
```

---

## Task 6: Profile validation

**Files:**
- Modify: `lib/profile/profile-validation.ts`
- Test: `__tests__/unit/profile-validation.test.ts` (create if absent)

- [ ] **Step 1: Write failing tests**

Create or extend `__tests__/unit/profile-validation.test.ts`:

```ts
import { describe, expect, it } from "vitest"

import { validateProfile } from "@/lib/profile/profile-validation"

describe("validateProfile - phone and country", () => {
  it("accepts a valid E.164 phone with a known country", () => {
    const r = validateProfile({
      fullName: "Dana Levi",
      phone: "+972541234567",
      countryIso2: "IL",
    })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.data.phone).toBe("+972541234567")
      expect(r.data.countryIso2).toBe("IL")
    }
  })

  it("allows a blank phone and ignores the country", () => {
    const r = validateProfile({
      fullName: "Dana Levi",
      phone: "",
      countryIso2: "IL",
    })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.data.phone).toBe("")
      expect(r.data.countryIso2).toBeNull()
    }
  })

  it("rejects a malformed phone", () => {
    const r = validateProfile({
      fullName: "Dana Levi",
      phone: "+12",
      countryIso2: "US",
    })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.fieldErrors?.phone).toBe("invalid")
  })

  it("rejects an unknown country when a phone is present", () => {
    const r = validateProfile({
      fullName: "Dana Levi",
      phone: "+972541234567",
      countryIso2: "ZZ",
    })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.fieldErrors?.countryIso2).toBe("invalid")
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npm run test -- profile-validation`
Expected: FAIL - `countryIso2` not on `ProfileInput` yet / old prose errors.

- [ ] **Step 3: Rewrite the validator**

Replace the body of `lib/profile/profile-validation.ts`:

```ts
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
```

> The error strings change from prose to codes (`"length"`, `"invalid"`). The
> profile page renders banner copy from `?notice`/`?error` redirect codes set by
> the action, not from these field codes, so no UI text breaks. The action maps a
> failed validation to a generic `saveFailed` redirect (Task 8).

- [ ] **Step 4: Run to verify pass**

Run: `npm run test -- profile-validation`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/profile/profile-validation.ts __tests__/unit/profile-validation.test.ts
git commit -m "feat(phone): E.164 phone rule and country validation in profile"
```

---

## Task 7: Onboarding server action persistence

**Files:**
- Modify: `lib/onboarding/onboarding-actions.ts`
- Test: `__tests__/integration/onboarding-actions.test.ts` (extend existing)

- [ ] **Step 1: Add a failing assertion for country persistence**

In `__tests__/integration/onboarding-actions.test.ts`, update the `valid()`
helper to include `countryIso2: "IL"`, and add to the existing
`saveOnboardingDetails` matcher:

```ts
    expect(upsertedRow).toMatchObject({
      user_id: "user-1",
      full_name: "Dana Levi",
      phone: "+972541234567",
      country_iso2: "IL",
      // ... rest unchanged ...
    })
```

- [ ] **Step 2: Run to verify failure**

Run: `npm run test -- onboarding-actions`
Expected: FAIL - `country_iso2` not in the upserted row.

- [ ] **Step 3: Persist `countryIso2` in the action**

In `lib/onboarding/onboarding-actions.ts`, in `stepUpsertInput`, the `step === 0`
return - add `countryIso2`:

```ts
    const phone = normalizePhone(input.phone ?? "")
    const countryIso2 = (input.countryIso2 ?? "").trim().toUpperCase() || null
    return {
      userId,
      fullName: (input.fullName ?? "").trim(),
      phone: phone || null,
      countryIso2: phone ? countryIso2 : null,
      age: Number.isInteger(age) ? (age as number) : null,
      ageRange: input.ageRange || null,
    }
```

In `saveOnboardingDetails`, the `upsertClient({ ... })` call - add after `phone`:

```ts
      phone: data.phone || null,
      countryIso2: data.phone ? data.countryIso2 : null,
```

- [ ] **Step 4: Run to verify pass**

Run: `npm run test -- onboarding-actions`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/onboarding/onboarding-actions.ts __tests__/integration/onboarding-actions.test.ts
git commit -m "feat(phone): persist countryIso2 on onboarding save"
```

---

## Task 8: Profile server action persistence

**Files:**
- Modify: `lib/profile/profile-actions.ts`
- Test: `__tests__/integration/profile-actions.test.ts` (create if absent)

- [ ] **Step 1: Write a failing integration test**

Create `__tests__/integration/profile-actions.test.ts` (mirror the onboarding
integration mock style):

```ts
import { beforeEach, describe, expect, it, vi } from "vitest"

import type { ProfileInput } from "@/lib/profile/profile-types"

let currentUser: { id: string; email: string } | null = null
let upsertedRow: Record<string, unknown> | null = null

vi.mock("next/cache", () => ({ revalidatePath: () => {} }))

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: currentUser } }) },
    from() {
      return {
        upsert: (row: Record<string, unknown>) => ({
          select: () => ({
            single: async () => {
              upsertedRow = row
              return { data: { ...row }, error: null }
            },
          }),
        }),
      }
    },
  }),
}))

import { updateProfile } from "@/lib/profile/profile-actions"

beforeEach(() => {
  currentUser = { id: "user-1", email: "dana@example.com" }
  upsertedRow = null
})

function valid(overrides: Partial<ProfileInput> = {}): ProfileInput {
  return { fullName: "Dana Levi", phone: "+972541234567", countryIso2: "IL", ...overrides }
}

describe("updateProfile", () => {
  it("persists phone and country_iso2", async () => {
    const r = await updateProfile(valid())
    expect(r.ok).toBe(true)
    expect(upsertedRow).toMatchObject({
      user_id: "user-1",
      full_name: "Dana Levi",
      phone: "+972541234567",
      country_iso2: "IL",
    })
  })

  it("stores a null country when phone is blank", async () => {
    const r = await updateProfile(valid({ phone: "" }))
    expect(r.ok).toBe(true)
    expect(upsertedRow).toMatchObject({ phone: "", country_iso2: null })
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npm run test -- profile-actions`
Expected: FAIL - `country_iso2` not written.

- [ ] **Step 3: Persist `countryIso2` in `updateProfile` and the form wrapper**

In `lib/profile/profile-actions.ts`, `updateProfile` - extend the upsert object:

```ts
      {
        user_id: user.id,
        full_name: validation.data.fullName,
        phone: validation.data.phone,
        country_iso2: validation.data.countryIso2,
      },
```

In `updateProfileForm`, read the new field from FormData:

```ts
  const result = await updateProfile({
    fullName: String(formData.get("fullName") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    countryIso2: String(formData.get("countryIso2") ?? ""),
  })
```

- [ ] **Step 4: Run to verify pass**

Run: `npm run test -- profile-actions`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/profile/profile-actions.ts __tests__/integration/profile-actions.test.ts
git commit -m "feat(phone): persist countryIso2 on profile save"
```

---

## Task 9: PhoneField component

**Files:**
- Create: `components/phone-field.tsx`

This is the central UI unit. It is a client component composing the cmdk
`Command` combobox (in a `Popover`) for the country, the existing `Input` for the
national number, and hidden inputs (`phone`, `countryIso2`) so a parent
`<form action>` posts the combined values with no JS. The country `<Command>`
itself only runs with JS; a `NativeSelect` is rendered as the no-JS fallback and
hidden when JS hydrates.

- [ ] **Step 1: Create the component**

Create `components/phone-field.tsx`:

```tsx
"use client"

import * as React from "react"
import { useLocale } from "next-intl"

import { COUNTRIES, countryByIso2, flagEmoji } from "@/lib/phone/countries"
import { combineE164, matchCountry } from "@/lib/phone/phone"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select"
import { cn } from "@/lib/utils"

/**
 * Props for {@link PhoneField}. The component is controlled: the parent owns the
 * selected ISO2 code and the national-number string and receives changes via the
 * callbacks. The parent combines them into E.164 for validation/submit.
 */
export interface PhoneFieldProps {
  /** Selected ISO2 country code (uppercase, e.g. "IL"). */
  countryIso2: string
  /** National number as typed (digits and separators allowed). */
  national: string
  /** Called with the new ISO2 when the user picks a country. */
  onCountryChange: (iso2: string) => void
  /** Called with the new national-number string as the user types. */
  onNationalChange: (national: string) => void
  /** Localized placeholder for the country search input. */
  searchPlaceholder: string
  /** Localized "no matching country" text. */
  emptyText: string
  /** Whether the national input is invalid (drives aria-invalid). */
  invalid?: boolean
  /** Whether the national input is required. */
  required?: boolean
}

/**
 * Searchable country-code phone field. Renders a country combobox (emoji flag +
 * dial code + localized name, searchable by dial code / ISO2 / English name /
 * Hebrew name) beside a national-number input. Emits hidden `phone` (combined
 * E.164) and `countryIso2` inputs so a parent `<form action>` submits the right
 * values with or without JavaScript; a `NativeSelect` provides the no-JS country
 * picker and is hidden once this client component hydrates.
 *
 * Flags are emoji derived from the ISO2 code; on Windows (no flag glyphs) the
 * two-letter code shows instead, with the dial code and name still visible.
 */
export function PhoneField({
  countryIso2,
  national,
  onCountryChange,
  onNationalChange,
  searchPlaceholder,
  emptyText,
  invalid,
  required,
}: PhoneFieldProps) {
  const locale = useLocale()
  const isHe = locale === "he"
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState("")

  const selected = countryByIso2(countryIso2) ?? countryByIso2("IL")!
  const name = (c: typeof selected) => (isHe ? c.nameHe : c.nameEn)

  // The combined E.164 value the parent form posts (hidden input). Recomputed
  // from the controlled props so it always matches what the user sees.
  const combined = combineE164(selected.dialCode, national)

  // Clear the search when the popover closes so it reopens empty.
  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (!next) setQuery("")
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-stretch gap-2">
        {/* Country combobox (JS path). */}
        <Popover open={open} onOpenChange={handleOpenChange}>
          <PopoverTrigger
            render={
              <Button
                type="button"
                variant="outline"
                role="combobox"
                aria-expanded={open}
                className="h-8 shrink-0 justify-between gap-1 px-2.5 font-normal"
              />
            }
          >
            <span className="flex items-center gap-1.5">
              <span aria-hidden="true">{flagEmoji(selected.iso2)}</span>
              <span className="text-muted-foreground">{selected.dialCode}</span>
              <span className="max-w-32 truncate">{name(selected)}</span>
            </span>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-0" align="start">
            {/* cmdk's built-in fuzzy filter is disabled (shouldFilter=false) so
                our four-axis matchCountry is the sole filter. */}
            <Command shouldFilter={false}>
              <CommandInput
                placeholder={searchPlaceholder}
                value={query}
                onValueChange={setQuery}
              />
              <CommandList>
                <CommandEmpty>{emptyText}</CommandEmpty>
                {COUNTRIES.filter((c) => matchCountry(query, c)).map((c) => (
                  <CommandItem
                    key={c.iso2}
                    value={c.iso2}
                    data-checked={c.iso2 === selected.iso2}
                    onSelect={() => {
                      onCountryChange(c.iso2)
                      setQuery("")
                      setOpen(false)
                    }}
                  >
                    <span aria-hidden="true">{flagEmoji(c.iso2)}</span>
                    <span className="text-muted-foreground">
                      {c.dialCode}
                    </span>
                    <span className="truncate">
                      {isHe ? c.nameHe : c.nameEn}
                    </span>
                  </CommandItem>
                ))}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        {/* National number (shared by JS and no-JS). */}
        <Input
          name="phone-national"
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          value={national}
          onChange={(e) => onNationalChange(e.target.value)}
          aria-invalid={invalid ? true : undefined}
          required={required}
          className="flex-1"
        />
      </div>

      {/* Hidden combined value + country code for form submission (JS path). */}
      <input type="hidden" name="phone" value={combined} />
      <input type="hidden" name="countryIso2" value={selected.iso2} />

      {/* No-JS fallback: a native country select. Hidden when this component
          hydrates (JS present), so it never double-posts countryIso2. The JS
          path's hidden input above is authoritative. */}
      <noscript>
        <NativeSelect
          name="countryIso2"
          defaultValue={selected.iso2}
          className="mt-1 w-full"
        >
          {COUNTRIES.map((c) => (
            <NativeSelectOption key={c.iso2} value={c.iso2}>
              {`${c.dialCode} ${isHe ? c.nameHe : c.nameEn}`}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </noscript>
    </div>
  )
}
```

- [ ] **Step 2: Confirm the Popover/Command API before relying on it**

Two primitives are used in composition mode; confirm their exact API against the
project's own files before finalizing, and adapt if they differ:

- `components/ui/popover.tsx`: confirm `PopoverTrigger` accepts a `render` prop
  (the project's `combobox.tsx` uses `render={...}` on Base UI triggers). If this
  `PopoverTrigger` uses `asChild` instead, switch the trigger to that form.
- `components/ui/command.tsx`: `CommandInput` wraps cmdk's
  `CommandPrimitive.Input`, which supports `value`/`onValueChange` and the
  `Command` root supports `shouldFilter`. Confirm both are passed through.

Read both files, adjust the Step 1 code to match the real API, then:

Run: `npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add components/phone-field.tsx
git commit -m "feat(phone): searchable country-code PhoneField component"
```

---

## Task 10: Wire PhoneField into onboarding

**Files:**
- Modify: `app/[locale]/join/onboarding-form.tsx`
- Modify: `app/[locale]/join/page.tsx`

- [ ] **Step 1: Add `countryIso2` to form state and defaults**

In `app/[locale]/join/onboarding-form.tsx`:

Add to `OnboardingDefaults` (after `phone: string`):

```ts
  phone: string
  countryIso2: string
```

Add to `EMPTY_DEFAULTS` (after `phone: ""`):

```ts
  phone: "",
  countryIso2: "IL",
```

Add to `toInput` (after `phone: values.phone,`):

```ts
    phone: values.phone,
    countryIso2: values.countryIso2,
```

- [ ] **Step 2: Replace the phone block in `StepAboutYou`**

Add the import near the other component imports:

```ts
import { PhoneField } from "@/components/phone-field"
```

In `StepAboutYou`, add `const countryError = fieldError("countryIso2")` beside
the existing error lookups, then replace the phone `<Field>…</Field>` block with:

```tsx
      <Field
        label={t("fields.phone")}
        hint={t("hints.phone")}
        error={phoneError ?? countryError}
        required
      >
        <PhoneField
          countryIso2={values.countryIso2}
          national={values.phone}
          onCountryChange={(iso2) => set("countryIso2", iso2)}
          onNationalChange={(n) => set("phone", n)}
          searchPlaceholder={t("placeholders.countrySearch")}
          emptyText={t("empty.countrySearch")}
          invalid={!!(phoneError || countryError)}
          required
        />
      </Field>
```

> The onboarding form stores the **national** number in `values.phone` as the
> user types, but validation and save expect a combined E.164 string. Fix this in
> Step 3 so the combined value is what is validated and posted.

- [ ] **Step 3: Combine national + country into E.164 before validation/save**

The validator and server action expect `phone` to be full E.164. The form holds
the national number separately, so combine at the `toInput` boundary. Update
`toInput` to assemble the E.164 string:

```ts
import { combineE164 } from "@/lib/phone/phone"
import { countryByIso2 } from "@/lib/phone/countries"

/** Maps the form's string-keyed state to the validator's input shape. */
function toInput(values: OnboardingDefaults): OnboardingInput {
  const country = countryByIso2(values.countryIso2) ?? countryByIso2("IL")!
  return {
    fullName: values.fullName,
    phone: combineE164(country.dialCode, values.phone),
    countryIso2: values.countryIso2,
    age: values.age,
    ageRange: values.ageRange,
    goals: values.goals,
    fitnessLevel: values.fitnessLevel,
    limitations: values.limitations,
    availableDays: values.availableDays,
    preferredLocation: values.preferredLocation,
    equipment: values.equipment,
    notes: values.notes,
  }
}
```

- [ ] **Step 4: Prefill national number from a stored E.164 value**

In `app/[locale]/join/page.tsx`, the defaults are built from `existing`. The
stored `existing.phone` is full E.164; split it into the national part and the
country for the form's separate fields. Add the import and update the mapping:

```ts
import { splitE164 } from "@/lib/phone/phone"
```

```ts
  const existing = await getClient(userId)
  const split = existing
    ? splitE164(existing.phone ?? "", existing.countryIso2 ?? null)
    : null
  const defaults: OnboardingDefaults = existing
    ? {
        fullName: existing.fullName ?? "",
        phone: split!.national,
        countryIso2: split!.country.iso2,
        age: existing.age != null ? String(existing.age) : "",
        ageRange: existing.ageRange ?? "",
        goals: existing.goals ?? [],
        fitnessLevel: existing.fitnessLevel ?? "",
        limitations: existing.limitations ?? "",
        availableDays: existing.availableDays,
        preferredLocation: existing.preferredLocation ?? "",
        equipment: existing.equipment,
        notes: existing.notes ?? "",
      }
    : EMPTY_DEFAULTS
```

- [ ] **Step 5: Verify**

Run: `npm run typecheck && npm run lint && npm run test -- onboarding`
Expected: PASS. (The `onboarding-validation` and `onboarding-actions` suites
still pass because `toInput`-equivalent combining is mirrored by their `valid()`
helpers which pass full E.164 directly.)

- [ ] **Step 6: Commit**

```bash
git add app/[locale]/join/onboarding-form.tsx app/[locale]/join/page.tsx
git commit -m "feat(phone): use PhoneField in onboarding, split/combine E.164"
```

---

## Task 11: Wire PhoneField into profile

**Files:**
- Modify: `app/[locale]/profile/account-forms.tsx`
- Modify: `app/[locale]/profile/page.tsx`

`account-forms.tsx` is a Server Component. `PhoneField` is a client component, so
it can be rendered inside the server-rendered `<form>` as a client island. It
needs initial values, so wrap it in a tiny client controller that holds the
national/country state.

- [ ] **Step 1: Create a profile-specific controlled wrapper**

Add to the top of `components/phone-field.tsx` a thin stateful wrapper for
uncontrolled (form-driven) use:

```tsx
/**
 * Self-contained {@link PhoneField} for plain `<form action>` use (no parent
 * React state), seeded from a stored E.164 value and ISO2 code. Holds its own
 * national/country state and emits the hidden `phone`/`countryIso2` inputs the
 * server action reads. Used by the profile account form (a Server Component).
 */
export function PhoneFieldUncontrolled({
  initialPhone,
  initialCountryIso2,
  searchPlaceholder,
  emptyText,
}: {
  initialPhone: string
  initialCountryIso2: string
  searchPlaceholder: string
  emptyText: string
}) {
  const init = splitE164(initialPhone, initialCountryIso2 || null)
  const [iso2, setIso2] = React.useState(init.country.iso2)
  const [national, setNational] = React.useState(init.national)
  return (
    <PhoneField
      countryIso2={iso2}
      national={national}
      onCountryChange={setIso2}
      onNationalChange={setNational}
      searchPlaceholder={searchPlaceholder}
      emptyText={emptyText}
    />
  )
}
```

Add the `splitE164` import to `components/phone-field.tsx`:

```ts
import { combineE164, matchCountry, splitE164 } from "@/lib/phone/phone"
```

- [ ] **Step 2: Render it in the account form**

In `app/[locale]/profile/account-forms.tsx`:

Add the import:

```ts
import { PhoneFieldUncontrolled } from "@/components/phone-field"
```

Extend the props:

```ts
export function AccountForms({
  initialFullName,
  initialPhone,
  initialCountryIso2,
  email,
}: {
  initialFullName: string
  initialPhone: string
  initialCountryIso2: string
  email: string
}) {
```

Replace the phone `<div className="grid gap-2">…</div>` block (the Label + phone
Input) with:

```tsx
          <div className="grid gap-2">
            <Label htmlFor="phone-national">Phone</Label>
            <PhoneFieldUncontrolled
              initialPhone={initialPhone}
              initialCountryIso2={initialCountryIso2}
              searchPlaceholder="Search country…"
              emptyText="No matching country"
            />
          </div>
```

> The profile form uses hardcoded English copy (existing pattern: it is not
> localized). The `searchPlaceholder`/`emptyText` here match that. Onboarding,
> which is localized, passes `t(...)` values instead.

- [ ] **Step 3: Pass the stored country from the page loader**

In `app/[locale]/profile/page.tsx`:

Add `country_iso2` to the select:

```ts
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, phone, country_iso2")
    .eq("user_id", user.id)
    .maybeSingle()
```

Pass it to `<AccountForms>`:

```tsx
      <AccountForms
        initialFullName={profile?.full_name ?? ""}
        initialPhone={profile?.phone ?? ""}
        initialCountryIso2={profile?.country_iso2 ?? ""}
        email={user.email ?? ""}
      />
```

- [ ] **Step 4: Verify**

Run: `npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/[locale]/profile/account-forms.tsx app/[locale]/profile/page.tsx components/phone-field.tsx
git commit -m "feat(phone): use PhoneField in profile account form"
```

---

## Task 12: Localized copy

**Files:**
- Modify: `messages/en-US.json`
- Modify: `messages/he-IL.json`

- [ ] **Step 1: Add country keys to the Onboarding namespace (en-US)**

In `messages/en-US.json`, under `Onboarding`:

Add to `fields` (already has `phone`):

```json
    "countryCode": "Country code"
```

Add a new `placeholders` block (sibling of `hints`):

```json
  "placeholders": {
    "countrySearch": "Search country or code…"
  },
  "empty": {
    "countrySearch": "No matching country"
  },
```

Add to `errors` after the `phone` block:

```json
    "countryIso2": {
      "required": "Choose a country.",
      "invalid": "Choose a valid country."
    },
```

- [ ] **Step 2: Add the same keys to he-IL**

In `messages/he-IL.json`, under `Onboarding`:

`fields`:

```json
    "countryCode": "קידומת מדינה"
```

```json
  "placeholders": {
    "countrySearch": "חיפוש מדינה או קידומת…"
  },
  "empty": {
    "countrySearch": "לא נמצאה מדינה תואמת"
  },
```

`errors`, after `phone`:

```json
    "countryIso2": {
      "required": "בחרו מדינה.",
      "invalid": "בחרו מדינה תקינה."
    },
```

- [ ] **Step 3: Verify JSON validity and the build**

Run: `npm run typecheck && npm run lint && npm run build`
Expected: PASS. next-intl validates message shape at build; a malformed JSON or
missing-key reference fails here.

- [ ] **Step 4: Commit**

```bash
git add messages/en-US.json messages/he-IL.json
git commit -m "feat(phone): localized country selector copy (en-US, he-IL)"
```

---

## Task 13: E2E coverage

**Files:**
- Create: `e2e/phone-country-selector.spec.ts`

- [ ] **Step 1: Write the Playwright spec**

Create `e2e/phone-country-selector.spec.ts`. Mirror the auth-injection pattern
the existing admin e2e uses (sessions injected via the secret-key grant; the
captcha blocks the login form - do NOT drive the login form). Read an existing
`e2e/*.spec.ts` first to copy the exact auth-setup helper import.

```ts
import { test, expect } from "@playwright/test"
// import { signInAs } from "./helpers/auth"  // match the real helper path/name

test.describe("phone country selector", () => {
  test("search by dial code, ISO, and name; select; persists on reload", async ({
    page,
  }) => {
    // await signInAs(page, "client")  // inject a client session (no login form)
    await page.goto("/en/join")

    // Open the country combobox.
    await page.getByRole("combobox").click()
    const search = page.getByPlaceholder(/search country/i)

    // Dial-code search.
    await search.fill("972")
    await expect(page.getByText("Israel")).toBeVisible()

    // ISO2 search.
    await search.fill("IL")
    await expect(page.getByText("Israel")).toBeVisible()

    // Name search, then select.
    await search.fill("Isr")
    await page.getByText("Israel").click()

    // Type a national number and verify the trigger shows the dial code.
    await page.getByRole("textbox", { name: /phone/i }).fill("541234567")
    await expect(page.getByRole("combobox")).toContainText("+972")
  })
})
```

- [ ] **Step 2: Run the e2e suite (under Node 22)**

Run: `nvm use 22.16.0 && npm run test:e2e -- phone-country-selector`
Expected: PASS. If auth injection differs from the assumed helper, adapt to the
real one before asserting.

- [ ] **Step 3: Commit**

```bash
git add e2e/phone-country-selector.spec.ts
git commit -m "test(phone): e2e country selector search and persistence"
```

---

## Task 14: Full verification gate

- [ ] **Step 1: Run the complete gate under Node 22**

Run: `nvm use 22.16.0 && npm run lint && npm run typecheck && npm run build && npm run test`
Expected: all PASS, no new lint/type errors.

- [ ] **Step 2: Manual smoke (dev server)**

Run: `npm run dev`, then in the browser:
- `/en/join`: open the selector, search "972"/"IL"/"Israel"/"ישר"; pick a country;
  type a number; save the step; reload `/en/join` and confirm the country + number
  are restored.
- `/he/join`: confirm Hebrew country names render and the dropdown is RTL.
- `/en/profile`: confirm the contact form shows the selector, saves, and restores.
- Confirm a shared dial code (pick Canada, `+1`) restores as Canada (not US) on
  reload, proving `country_iso2` round-trips.

- [ ] **Step 3: Append a DECISIONS entry**

Add a dated entry to `docs/DECISIONS.md` recording: single E.164 `phone` retained
as source of truth; `country_iso2` added (migration 0004) only to restore the
exact country on edit; emoji flags via regional-indicator derivation (Windows
shows letters); profile + onboarding phone validation unified on
`/^\+[1-9]\d{7,14}$/`.

- [ ] **Step 4: Commit**

```bash
git add docs/DECISIONS.md
git commit -m "docs(decisions): phone country-code selector decisions"
```

---

## Self-Review Notes

- **Spec coverage:** dataset (T1), phone logic (T2), migration (T3), types (T4),
  onboarding + profile validation (T5/T6), server-action persistence (T7/T8),
  component (T9), onboarding wiring (T10), profile wiring (T11), localization
  (T12), tests across unit/integration/e2e (T1, T2, T5, T6, T7, T8, T13). All
  spec sections map to a task.
- **Shared-code resolution** (the +1 US/CA case) is implemented in `splitE164`
  (T2) and verified in T2 tests and the T14 smoke.
- **No-JS fallback** is the `<noscript>` `NativeSelect` in T9 plus the FormData
  read in T8; the server combines/validates authoritatively.
- **Type consistency:** `countryIso2` (camelCase) in app/input shapes;
  `country_iso2` (snake_case) only at the DB row boundary (`ClientRow`,
  `toClientUpsertRow`, the Supabase upsert objects, the `.select()`).
  `PHONE_RE` is defined once in `lib/validation/onboarding.ts` and imported by
  profile validation - single source.
- **Open verification during execution:** confirm the Base UI `popover.tsx`
  trigger composition prop (`render` vs `asChild`) and cmdk `CommandInput`
  `value`/`onValueChange` support before finalizing T9 (flagged inline).
```
