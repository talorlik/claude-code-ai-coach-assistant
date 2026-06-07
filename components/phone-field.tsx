"use client"

import * as React from "react"
import { useLocale } from "next-intl"

import {
  COUNTRIES,
  countryByIso2,
  flagEmoji,
} from "@/lib/phone/countries"
import { combineE164, matchCountry, splitE164 } from "@/lib/phone/phone"
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
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

/**
 * Props for {@link PhoneField}, a controlled searchable country-code selector
 * paired with a national-number input.
 */
export interface PhoneFieldProps {
  /** Currently selected country ISO2 code (uppercase, e.g. "IL"). */
  countryIso2: string
  /** National number exactly as typed by the user (separators allowed). */
  national: string
  /** Called with the new ISO2 when the user picks a country. */
  onCountryChange: (iso2: string) => void
  /** Called with the new national number as the user types. */
  onNationalChange: (national: string) => void
  /** Localized placeholder for the country search box. */
  searchPlaceholder: string
  /** Localized "no matching country" text for the empty state. */
  emptyText: string
  /** Marks the national-number input as invalid for styling and a11y. */
  invalid?: boolean
  /** Marks the national-number input as required. */
  required?: boolean
  /**
   * Id applied to the national-number input. A labelling wrapper (e.g. the
   * onboarding `Field`) injects this so its `<Label htmlFor>` associates with
   * the number input - the field's primary control - giving it an accessible
   * name.
   */
  id?: string
}

/**
 * Controlled phone input: a searchable popover combobox of countries (emoji
 * flag + dial code + localized name) next to the national-number field.
 *
 * Filtering is delegated to {@link matchCountry} (cmdk's own filter is disabled
 * via `shouldFilter={false}`), which matches on dial code, ISO2, and both the
 * English and Hebrew country names.
 *
 * Submission contract (both paths submit `phone-national` + `countryIso2`; the
 * server treats those two as the source of truth and recombines them into E.164
 * authoritatively via {@link combineE164}):
 *
 * - JS ON: the visible national-number input submits as `phone-national`, and a
 *   hidden `countryIso2` input carries the selected country. A hidden `phone`
 *   input additionally carries the pre-combined E.164 number as a convenience /
 *   optimization for the JS path; it is non-authoritative and the server still
 *   recombines from `phone-national` + `countryIso2`.
 * - JS OFF: the visible national-number input submits as `phone-national`, and
 *   the `<noscript>` `NativeSelect` submits `countryIso2`. There is no hidden
 *   `phone` value in this path (the hidden inputs are not rendered without JS),
 *   so the server reconstruction from `phone-national` + `countryIso2` is the
 *   only path that produces E.164. The hidden `phone` value does NOT update
 *   without JS.
 *
 * Because the JS-path hidden `countryIso2` and the no-JS `<noscript>` select
 * share the same name, the `<noscript>` picker is inert once JS hydrates (only
 * the hidden input is in the DOM then), so `countryIso2` is never double-submitted.
 *
 * RTL is handled by the surrounding `dir` attribute and logical CSS, so layout
 * uses flex/gap rather than physical left/right offsets.
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
  id,
}: PhoneFieldProps) {
  const locale = useLocale()
  const isHe = locale === "he"

  // Fall back to Israel when the incoming ISO2 is unknown; "IL" always exists
  // in COUNTRIES so the non-null assertion is safe.
  const selected = countryByIso2(countryIso2) ?? countryByIso2("IL")!
  const selectedName = isHe ? selected.nameHe : selected.nameEn

  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState("")

  const filtered = React.useMemo(
    () => COUNTRIES.filter((c) => matchCountry(query, c)),
    [query],
  )

  return (
    <div className="flex items-start gap-2">
      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(next)
          // Reset the search when the popover closes so it reopens clean.
          if (!next) setQuery("")
        }}
      >
        <PopoverTrigger
          render={
            <Button
              type="button"
              variant="outline"
              aria-label={`${selected.dialCode} ${selectedName}`}
              className="w-40 shrink-0 justify-between font-normal"
            />
          }
        >
          <span className="flex min-w-0 items-center gap-1.5">
            <span aria-hidden="true">{flagEmoji(selected.iso2)}</span>
            <span className="text-muted-foreground">{selected.dialCode}</span>
            <span className="truncate">{selectedName}</span>
          </span>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-(--anchor-width) p-0">
          <Command shouldFilter={false}>
            <CommandInput
              value={query}
              onValueChange={setQuery}
              placeholder={searchPlaceholder}
            />
            <CommandList>
              <CommandEmpty>{emptyText}</CommandEmpty>
              {filtered.map((c) => {
                const name = isHe ? c.nameHe : c.nameEn
                return (
                  <CommandItem
                    key={c.iso2}
                    value={c.iso2}
                    data-checked={c.iso2 === selected.iso2}
                    aria-current={c.iso2 === selected.iso2 ? "true" : undefined}
                    onSelect={() => {
                      onCountryChange(c.iso2)
                      setQuery("")
                      setOpen(false)
                    }}
                  >
                    <span aria-hidden="true">{flagEmoji(c.iso2)}</span>
                    <span className="text-muted-foreground">{c.dialCode}</span>
                    <span className="truncate">{name}</span>
                  </CommandItem>
                )
              })}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      <Input
        id={id}
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

      {/*
        JS-path hidden inputs. `phone` is non-authoritative: it is a
        convenience pre-combination of the E.164 number for the JS path only.
        The server recombines from `phone-national` + `countryIso2`, so this
        value can be ignored server-side. Both are readOnly/uncontrolled: their
        value is derived each render and never edited in place.
      */}
      <input
        type="hidden"
        name="phone"
        readOnly
        value={combineE164(selected.dialCode, national)}
      />
      <input
        type="hidden"
        name="countryIso2"
        readOnly
        value={selected.iso2}
      />

      {/*
        No-JS fallback: a native country picker that submits `countryIso2`
        when JS is off, so the server can recombine it with `phone-national`
        into E.164. Inert once JS hydrates (only the hidden countryIso2 input
        is in the DOM then), so no double submit. No emoji in option text -
        native option emoji rendering is unreliable across platforms.
      */}
      <noscript>
        <NativeSelect name="countryIso2" defaultValue={selected.iso2}>
          {COUNTRIES.map((c) => (
            <NativeSelectOption key={c.iso2} value={c.iso2}>
              {c.dialCode} {isHe ? c.nameHe : c.nameEn}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </noscript>
    </div>
  )
}

/**
 * Self-contained wrapper around {@link PhoneField} for Server Components that
 * render a plain `<form action>`. It seeds its own country/national state from
 * an existing E.164 phone via {@link splitE164} and renders the controlled
 * {@link PhoneField}, so the hidden `phone`/`countryIso2` inputs post correctly
 * without the parent owning any client state.
 */
export function PhoneFieldUncontrolled({
  initialPhone,
  initialCountryIso2,
  searchPlaceholder,
  emptyText,
  id,
}: {
  /** Existing stored phone in E.164 form (may be empty). */
  initialPhone: string
  /** Existing stored country ISO2 (may be empty). */
  initialCountryIso2: string
  /** Localized placeholder for the country search box. */
  searchPlaceholder: string
  /** Localized "no matching country" text for the empty state. */
  emptyText: string
  /**
   * Id forwarded to the national-number input so a sibling `<Label htmlFor>`
   * associates with the field's primary control.
   */
  id?: string
}) {
  const seed = splitE164(initialPhone, initialCountryIso2 || null)
  const [iso2, setIso2] = React.useState(seed.country.iso2)
  const [national, setNational] = React.useState(seed.national)

  return (
    <PhoneField
      countryIso2={iso2}
      national={national}
      onCountryChange={setIso2}
      onNationalChange={setNational}
      searchPlaceholder={searchPlaceholder}
      emptyText={emptyText}
      id={id}
    />
  )
}
