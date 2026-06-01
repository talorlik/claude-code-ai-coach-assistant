/**
 * Discriminated result type returned by server actions. On success `data`
 * carries the payload; on failure `error` is a user-safe message and
 * `fieldErrors` optionally maps form fields to per-field messages.
 */
export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string> }

export function ok<T>(data: T): ActionResult<T> {
  return { ok: true, data }
}

export function fail<T = never>(
  error: string,
  fieldErrors?: Record<string, string>
): ActionResult<T> {
  return fieldErrors ? { ok: false, error, fieldErrors } : { ok: false, error }
}
