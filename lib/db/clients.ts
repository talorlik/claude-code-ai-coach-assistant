import { createClient } from "@/lib/supabase/server"
import {
  fromClientRow,
  toClientUpsertRow,
  type Client,
  type ClientUpsertInput,
} from "@/lib/db/mappers"
import type { ClientRow } from "@/lib/db/types"

/**
 * Server-only data access for the `clients` table. All calls go through the
 * request-scoped Supabase client, so RLS applies: a client reads and writes
 * only their own row, while the trainer admin's session resolves the
 * trainer-admin policy. The secret/admin client is never used here.
 */

/**
 * Loads the onboarding profile for the given client (auth user id). Returns
 * `null` when no row exists or RLS hides it. Throws on an unexpected database
 * error so callers fail loudly rather than treating an error as "no client".
 */
export async function getClient(clientId: string): Promise<Client | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("clients")
    .select("*")
    .eq("user_id", clientId)
    .maybeSingle()

  if (error) throw new Error(`Failed to load client: ${error.message}`)
  return data ? fromClientRow(data as ClientRow) : null
}

/**
 * Inserts or updates the caller's client onboarding row and returns the saved
 * domain model. `user_id` is the conflict target, so repeated onboarding edits
 * update in place. RLS enforces that the row's `user_id` matches the caller (or
 * that the caller is the trainer admin). Throws on a database error.
 */
export async function upsertClient(input: ClientUpsertInput): Promise<Client> {
  const supabase = await createClient()
  const row = toClientUpsertRow(input)

  const { data, error } = await supabase
    .from("clients")
    .upsert(row, { onConflict: "user_id" })
    .select("*")
    .single()

  if (error) throw new Error(`Failed to save client: ${error.message}`)
  return fromClientRow(data as ClientRow)
}

/**
 * Lists all client onboarding rows. Intended for the trainer-admin client list;
 * RLS returns rows only when the caller is the trainer admin (a non-admin sees
 * just their own row). Ordered by most recently updated first.
 */
export async function listClients(): Promise<Client[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("clients")
    .select("*")
    .order("updated_at", { ascending: false })

  if (error) throw new Error(`Failed to list clients: ${error.message}`)
  return (data as ClientRow[]).map(fromClientRow)
}
