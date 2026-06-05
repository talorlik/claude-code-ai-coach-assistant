import { getCurrentUserRole } from "@/lib/auth/roles"
import { isSupportedLocale, routing, type Locale } from "@/i18n/routing"
import { loadWorkoutPlanPdfData } from "@/lib/pdf/load-plan-pdf-data"
import { buildWorkoutPlanPdf } from "@/lib/pdf/workout-plan-pdf"

/**
 * Protected workout-plan PDF export.
 *
 * `GET /api/pdf/workout-plan?clientId=<id>&locale=<en|he>`
 *
 * This route is the trust boundary for the export: a page guard is not
 * sufficient because a route is independently callable. It:
 *
 * - requires an authenticated session (401 otherwise);
 * - authorizes the target: the caller may always export their own plan; only a
 *   trainer admin may export another client's plan (`clientId` differing from
 *   the caller), otherwise 403. RLS is the data-layer backstop;
 * - returns 404 when the target client has no active plan;
 * - streams a complete `application/pdf` document with a download filename.
 *
 * The PDF is built server-side; no Supabase key or AI key is ever exposed. The
 * `locale` hint selects the document's labels and text direction, defaulting to
 * the app default locale for an unknown or absent value.
 */
export async function GET(req: Request): Promise<Response> {
  const { userId, isAdmin } = await getCurrentUserRole()
  if (!userId) {
    return Response.json({ error: "unauthorized" }, { status: 401 })
  }

  const url = new URL(req.url)
  const requestedClientId = url.searchParams.get("clientId")?.trim() || userId

  // Only the trainer admin may export a plan that is not their own.
  if (requestedClientId !== userId && !isAdmin) {
    return Response.json({ error: "forbidden" }, { status: 403 })
  }

  const locale = resolveLocale(url.searchParams.get("locale"))

  const data = await loadWorkoutPlanPdfData(requestedClientId)
  if (!data) {
    return Response.json({ error: "noActivePlan" }, { status: 404 })
  }

  const bytes = await buildWorkoutPlanPdf(data, locale)
  const filename = buildFilename(data.planTitle)

  // Copy into a fresh ArrayBuffer-backed view so the body is a plain BodyInit
  // (pdf-lib returns a Uint8Array over a possibly larger buffer).
  const body = new Uint8Array(bytes)

  return new Response(body, {
    status: 200,
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="${filename}"`,
      "content-length": String(body.byteLength),
      "cache-control": "no-store",
    },
  })
}

/** Resolves a `?locale=` hint to a supported locale, defaulting to the app default. */
function resolveLocale(value: string | null): Locale {
  return value && isSupportedLocale(value) ? value : routing.defaultLocale
}

/**
 * Builds a safe, ASCII download filename from the plan title. Falls back to a
 * stable default; non-filename-safe characters are collapsed to hyphens so the
 * `content-disposition` header stays well-formed across browsers.
 */
function buildFilename(planTitle: string | null): string {
  const base = (planTitle ?? "workout-plan")
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .toLowerCase()
  return `${base || "workout-plan"}.pdf`
}
