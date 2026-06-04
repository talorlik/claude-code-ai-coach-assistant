import { createNavigation } from "next-intl/navigation"

import { routing } from "./routing"

/**
 * Locale-aware navigation primitives. These are drop-in replacements for the
 * matching `next/navigation` exports that automatically prepend the active
 * locale prefix, so links and redirects preserve the user's language instead of
 * falling back to the default locale.
 *
 * Use these everywhere inside the `app/[locale]` tree in place of
 * `next/link` and `next/navigation`'s `redirect`/`usePathname`/`useRouter`.
 */
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing)
