/**
 * A profile row exactly as stored in the database. Declared by hand (no
 * generated database.types.ts) since the table is small.
 */
export interface Profile {
  user_id: string
  full_name: string | null
  phone: string | null
  country_iso2: string | null
  created_at: string
  updated_at: string
}

/**
 * Editable profile fields submitted from the account page, before validation.
 */
export interface ProfileInput {
  fullName: string
  phone: string
  countryIso2: string
}
