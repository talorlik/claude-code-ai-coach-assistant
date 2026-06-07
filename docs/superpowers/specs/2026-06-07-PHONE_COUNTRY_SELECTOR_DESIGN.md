# Phone Country-Code Selector Design

## Summary

Replace the plain `<Input type="tel">` phone field in onboarding and profile
with a searchable country-code selector. The user picks a country from a
dropdown that shows an emoji flag, the dial code, and the localized country
name, then types the national number. The selector is searchable by dial code,
ISO country code, English name, and Hebrew name.

Storage keeps the full E.164 string in the existing `phone` column and adds a
new `country_iso2` column so that on edit the previously selected country (and
therefore the exact dial code and flag) is restored, even for dial codes shared
by multiple countries.

## Goals

- Searchable country selector with emoji flags (no image assets).
- Search matches dial code (with or without `+`), ISO2 code, English name, and
  Hebrew name simultaneously.
- Localized display: English names under `/en`, Hebrew names under `/he`,
  RTL-aware.
- Store the full E.164 number and the selected ISO2 country code.
- On edit, restore the exact selected country from the stored ISO2.
- Zero new runtime dependencies. Reuse the existing Base UI `Combobox`.
- Preserve the no-JS progressive-enhancement fallback.

## Non-Goals

- No phone library (`libphonenumber-js`, `react-phone-number-input`, etc.).
- No per-country national-number-length validation. Validation stays a generic
  E.164 shape check.
- No backfill of `country_iso2` for existing rows. Existing numbers keep
  working; the column populates on next save.
- No change to how the AI/WhatsApp contact flow reads the number. It keeps
  reading the single E.164 `phone` string.

## Constraints

- Flags MUST be Unicode emoji derived from the ISO2 code via regional-indicator
  code points. No SVG or PNG flag assets.
- Emoji flags do not render on Windows browsers; they fall back to the 2-letter
  code. The selector always shows the dial code and country name alongside the
  flag so the country is identifiable even when the emoji does not render.
- Follow existing project conventions: `Field` + `Input` composition,
  `ActionResult` with `ok`/`fail`, localized error codes resolved via
  `t("errors.<field>.<code>")`, RLS-safe server actions.

## Data Model

### Database

New migration `supabase/migrations/0004_phone_country.sql`:

- `alter table public.clients add column country_iso2 text;`
- `alter table public.profiles add column country_iso2 text;`

Both nullable. No backfill. No index (not queried by country).

The existing `phone text` column on both tables is unchanged. It continues to
store the full normalized E.164 string, e.g. `+972541234567`.

### Application types

- `lib/db/mappers.ts`: add `country_iso2: string | null` to the `Client` row
  shape and `country_iso2` to `ClientUpsertInput`.
- `lib/profile/profile-types.ts`: add `countryIso2: string` to `ProfileInput`
  and `country_iso2: string | null` to the `Profile` row type.

## Country Dataset

New file `lib/phone/countries.ts`.

```ts
export interface Country {
  iso2: string      // "IL"
  dialCode: string  // "+972"
  nameEn: string    // "Israel"
  nameHe: string    // "ישראל"
}

export const COUNTRIES: Country[] = [ /* ~242 entries */ ]

/** Derives the flag emoji from an ISO2 code via regional-indicator symbols. */
export function flagEmoji(iso2: string): string

/** O(1) lookup helpers backed by a Map built once at module load. */
export function countryByIso2(iso2: string): Country | undefined
```

`flagEmoji("IL")` returns `🇮🇱` by mapping each ASCII letter to its
regional-indicator code point (`0x1F1E6 + (charCode - 65)`).

The list is hand-maintained in the repo. Default selected country is Israel
(`IL`).

## Phone Logic

New file `lib/phone/phone.ts`. Pure, dependency-free, unit-testable.

```ts
/** Joins a dial code and a national number into a normalized E.164 string. */
export function combineE164(dialCode: string, national: string): string

/**
 * Splits a stored E.164 string for editing. Prefers the stored iso2 to resolve
 * shared dial codes exactly; falls back to longest-dial-code prefix match, then
 * to the default country.
 */
export function splitE164(
  phone: string,
  iso2: string | null
): { country: Country; national: string }

/**
 * True if the query matches the country on any of: dial code (with or without
 * leading +), ISO2 code, English name, or Hebrew name. Case-insensitive.
 */
export function matchCountry(query: string, country: Country): boolean
```

`combineE164` strips all non-digits from `national`, then concatenates the dial
code: `combineE164("+972", "054-123 4567")` → `"+9725 41234567"` normalized to
`"+972541234567"`.

## Component

New file `components/phone-field.tsx`, a client component.

```ts
interface PhoneFieldProps {
  countryIso2: string         // selected ISO2, controlled by parent
  phone: string               // national number, controlled by parent
  onCountryChange: (iso2: string) => void
  onPhoneChange: (national: string) => void
  error?: string | null
  required?: boolean
  // label / hint passed by the parent Field
}
```

Layout: a `Field` wraps two side-by-side controls.

1. Country combobox (Base UI `Combobox` from `components/ui/combobox.tsx`):
   - Trigger shows `<flag> <dialCode> <localized name>`, e.g. `🇮🇱 +972 ישראל`.
   - Opening reveals the search input and a scrollable `ComboboxList`.
   - Each `ComboboxItem` renders `<flag> <dialCode> <name>`.
   - Filtering uses `matchCountry`. `ComboboxEmpty` shows a localized
     "no matches" message.
   - A hidden input named `countryIso2` carries the selected ISO2 for no-JS
     form submission.
2. National-number input (existing `Input`):
   - `type="tel"`, `inputMode="tel"`, `autoComplete="tel-national"`,
     `name="phone"`.
   - Strips non-digits on change.

The component does not own the combined value. The parent form combines via
`combineE164(country.dialCode, national)` when building the value it validates
and submits, keeping a single source of truth.

Localized name selection (English vs Hebrew) is driven by the active locale,
read with `useLocale()` from `next-intl`.

## Validation

Standardize both onboarding and profile on a single E.164 rule, replacing the
current onboarding-strict / profile-loose inconsistency.

In `lib/validation/onboarding.ts` and `lib/profile/profile-validation.ts`:

- `phone`: must match `/^\+[1-9]\d{7,14}$/` (leading `+`, non-zero country
  digit, 8-15 digits total). Onboarding: required. Profile: optional (empty
  allowed; when empty, `country_iso2` is ignored).
- `country_iso2`: must be a known ISO2 present in `COUNTRIES`. Guards against
  tampered or no-JS posts with a bad value. On mismatch → error code `invalid`.

Errors remain localized codes (`required`, `invalid`) resolved by the UI via
`t("errors.phone.<code>")`. A new `errors.countryIso2.invalid` code is added.

The shared `normalizePhone` helper in `lib/auth/validation.ts` is reused for
digit normalization. `PHONE_MIN`/`PHONE_MAX`/`PHONE_RE` constants in
`lib/validation/onboarding.ts` are reconciled to the single rule above.

## Server Actions

- `lib/onboarding/onboarding-actions.ts`: the per-step upsert for the
  "About You" step and the final `saveOnboardingDetails` include `country_iso2`.
  The server re-validates both `phone` and `country_iso2`.
- `lib/profile/profile-actions.ts`: `updateProfile` and the FormData wrapper
  `updateProfileForm` include `country_iso2`. When phone is blank, `country_iso2`
  is stored as null.

Both actions assemble/validate authoritatively server-side, so the JS and no-JS
paths converge on identical stored values.

## Localization

Add to `messages/en-US.json` and `messages/he-IL.json` under the relevant
namespaces (`Onboarding`, and the profile/account namespace):

- `fields.countryCode` - selector label (or reuse the existing phone label
  group; the national-number input keeps `fields.phone`).
- `placeholders.countrySearch` - search input placeholder.
- `empty.countrySearch` - "no matching country" text.
- `errors.countryIso2.invalid` - validation error.

Country names themselves live in `lib/phone/countries.ts` (`nameEn`/`nameHe`),
not in the message catalogs, because they are a fixed dataset, not UI copy.

## No-JS Fallback

The field renders inside a real `<form>`. With JS disabled:

- The combobox degrades to a plain `<select name="countryIso2">` listing
  `<dialCode> <name>` options. No emoji in `<option>` text (native `<option>`
  emoji rendering is unreliable); dial code + name identify the country.
- The number stays `<input name="phone">`.
- The server action reads both fields, validates, and stores them.

With JS enabled, the combobox drives a hidden `countryIso2` input so the same
field names post in both modes.

## Call Sites

1. `app/[locale]/join/onboarding-form.tsx` - `StepAboutYou`: replace the phone
   `Field`/`Input` block with `PhoneField`; thread `countryIso2` through the
   form state (`OnboardingDefaults`), per-step save, and final submit.
2. `app/[locale]/profile/account-forms.tsx` - `ContactDetailsForm`: replace the
   phone field with `PhoneField`; thread `countryIso2` through state and the
   update action.

On load, both call sites use `splitE164(storedPhone, storedIso2)` to initialize
the selected country and national number.

## Testing

Unit (Vitest):

- `flagEmoji`: known ISO2 → expected emoji; lowercase input handled.
- `combineE164`: strips separators, prepends dial code, normalizes.
- `splitE164`: stored iso2 resolves shared codes (`+1`/`US` vs `+1`/`CA`);
  fallback to longest-prefix match when iso2 absent; fallback to default when
  unparseable.
- `matchCountry`: matches on each of the four axes; case-insensitive; `+`
  optional on dial code.
- Validation: valid E.164 passes; bad shape → `invalid`; empty phone in profile
  passes; unknown `country_iso2` → `invalid`; required-but-empty in onboarding
  → `required`.

Integration:

- Onboarding "About You" per-step save persists `phone` and `country_iso2`.
- Profile update persists both; blank phone stores null `country_iso2`.

E2E (Playwright, RTL aware): open the selector, search "972" and "ישראל" and
"IL", select Israel, type a national number, submit, reload, confirm the country
and number are restored.

## Risks and Trade-offs

- Emoji flags do not render on Windows; mitigated by always showing dial code +
  name.
- Hand-maintained country list can drift from ITU updates; acceptable, edited in
  one file.
- Tightening profile phone validation from 7-20 digits to E.164 8-15 may reject
  a small number of previously-accepted malformed values on next edit; this is
  the intended correctness improvement.
