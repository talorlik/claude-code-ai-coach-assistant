import type { OnboardingDefaults } from "@/app/[locale]/join/onboarding-form"
import type { Client } from "@/lib/db/mappers"
import { splitE164 } from "@/lib/phone/phone"

/**
 * Maps a persisted {@link Client} to the onboarding form's string-keyed
 * defaults. Shared by the onboarding wizard page, My Account, and the trainer
 * client editor so the client -> form mapping lives in one place. The national
 * phone number and country are split back out of the stored E.164 value, and
 * the "Other" equipment list is re-joined into the comma-separated free-text
 * field.
 *
 * This lives in a server-safe module (no `"use client"`) so React Server
 * Components - the three pages above are async server components - can call it
 * directly. It previously lived in `onboarding-details-form.tsx`, a client
 * module; invoking a client-module export from the server throws
 * "Attempted to call clientToDefaults() from the server". The only runtime
 * dependency, {@link splitE164}, is itself server-safe; `OnboardingDefaults` is
 * a type and is erased at compile time, so the type-only import of it from the
 * client form module is allowed.
 */
export function clientToDefaults(client: Client): OnboardingDefaults {
  const split = splitE164(client.phone ?? "", client.countryIso2 ?? null)
  return {
    fullName: client.fullName ?? "",
    phone: split.national,
    countryIso2: split.country.iso2,
    age: client.age != null ? String(client.age) : "",
    ageRange: client.ageRange ?? "",
    goals: client.goals,
    fitnessLevel: client.fitnessLevel ?? "",
    limitations: client.limitations ?? "",
    availableDays: client.availableDays,
    availability: client.availability,
    sessionDurationMinutes:
      client.sessionDurationMinutes != null
        ? String(client.sessionDurationMinutes)
        : "",
    preferredLocation: client.preferredLocation ?? "",
    equipment: client.equipment,
    equipmentOtherSelected: client.equipmentOther.length > 0,
    equipmentOther: client.equipmentOther.join(", "),
    notes: client.notes ?? "",
  }
}
