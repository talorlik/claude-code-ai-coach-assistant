"use client"

import { useCallback, useSyncExternalStore, type ReactNode } from "react"
import { ChevronDown } from "lucide-react"

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { cn } from "@/lib/utils"

/**
 * Props for {@link CollapsibleSection}.
 */
export interface CollapsibleSectionProps {
  /** Visible section heading; also the accessible name of the trigger button. */
  title: string
  /**
   * Stable `localStorage` key for this section's open/closed state, e.g.
   * `"trainer-section:plan-detail"`. The stored value is `"1"` (open) or
   * `"0"` (closed); any missing/other value means closed.
   */
  storageKey: string
  /** The section body, revealed when the section is expanded. */
  children: ReactNode
  /** Optional muted subtitle rendered above the body when expanded. */
  subtitle?: ReactNode
  /**
   * Optional action (e.g. a button) rendered in the header, to the side of the
   * title. It sits OUTSIDE the trigger button so it stays independently
   * clickable (no nested interactive elements).
   */
  headerAction?: ReactNode
  /**
   * Visual treatment:
   * - `"card"` (default): a standalone `<section>` card with the shared
   *   `rounded-lg border bg-card` shell and an `<h2>` title.
   * - `"bare"`: no card shell, rendered as a plain `<div>` with an `<h3>`
   *   title and a top divider, for embedding as a collapsible sub-region INSIDE
   *   an existing card (e.g. the workout breakdown under "Current plan").
   */
  variant?: "card" | "bare"
  /** Forwarded to the trigger button for e2e/unit selection. */
  "data-testid"?: string
}

/**
 * Reads the persisted open flag for `storageKey` from `localStorage`. Returns
 * `false` (collapsed) when storage is unavailable or the key is unset.
 */
function readOpen(storageKey: string): boolean {
  try {
    return window.localStorage.getItem(storageKey) === "1"
  } catch {
    return false
  }
}

/**
 * A collapsible card section for the trainer client-detail page. Renders the
 * shared card shell with a header whose title doubles as the expand/collapse
 * trigger: a full-width button showing the title and a `ChevronDown` that
 * rotates 180 degrees when open. The body and optional subtitle live in the
 * collapsible panel and are hidden when collapsed.
 *
 * State is collapsed by default and persisted per `storageKey` in
 * `localStorage`. The open flag is read through `useSyncExternalStore`: the
 * server snapshot is always collapsed (avoiding an SSR/hydration mismatch),
 * while the client snapshot reflects the persisted value on the first client
 * render. All storage access is guarded, so a storage failure degrades to
 * collapsed state.
 *
 * The header is a flex row (title at the start, chevron/action at the end), so
 * it mirrors correctly under RTL with no extra work.
 *
 * Pass `variant="bare"` to drop the card shell and embed the collapsible as a
 * sub-region inside another card (see the workout breakdown under the trainer
 * "Current plan" card).
 */
export function CollapsibleSection({
  title,
  storageKey,
  children,
  subtitle,
  headerAction,
  variant = "card",
  "data-testid": dataTestId,
}: CollapsibleSectionProps) {
  // Subscribe to same-key storage changes so toggles (and other instances or
  // tabs) re-render. The handler is keyed on storageKey.
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      window.addEventListener("storage", onStoreChange)
      // A custom event lets same-tab writes notify subscribers (the native
      // "storage" event only fires in OTHER tabs).
      window.addEventListener(`collapsible-section:${storageKey}`, onStoreChange)
      return () => {
        window.removeEventListener("storage", onStoreChange)
        window.removeEventListener(
          `collapsible-section:${storageKey}`,
          onStoreChange
        )
      }
    },
    [storageKey]
  )

  // Collapsed on the server (and during hydration) to avoid a mismatch; the
  // client snapshot reflects the persisted value.
  const open = useSyncExternalStore(
    subscribe,
    () => readOpen(storageKey), // client snapshot
    () => false // server snapshot: always collapsed
  )

  const handleOpenChange = useCallback(
    (next: boolean) => {
      try {
        window.localStorage.setItem(storageKey, next ? "1" : "0")
      } catch {
        // Storage write failed: nothing persisted, but still notify so the UI
        // reflects the intended state for this session.
      }
      // Notify same-tab subscribers; useSyncExternalStore re-reads the snapshot.
      window.dispatchEvent(new Event(`collapsible-section:${storageKey}`))
    },
    [storageKey]
  )

  const bare = variant === "bare"
  const Heading = bare ? "h3" : "h2"

  return (
    <Collapsible
      open={open}
      onOpenChange={handleOpenChange}
      // Card variant renders the Root as a <section> so the header (with its
      // action) and the panel (subtitle + body) share one semantic region. The
      // bare variant is a plain <div> sub-region inside an existing card. Base
      // UI uses the `render` prop (not `asChild`) to override the host element.
      render={bare ? undefined : <section />}
      className={cn(
        !bare && "rounded-lg border bg-card text-card-foreground"
      )}
    >
      <div
        className={cn(
          "flex items-center gap-2",
          bare ? "py-2" : "p-4"
        )}
      >
        <CollapsibleTrigger
          data-testid={dataTestId}
          className={cn(
            "group flex flex-1 items-center justify-between gap-2 text-start",
            "rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
          )}
        >
          <Heading
            className={cn("font-medium", bare ? "text-sm" : "text-lg")}
          >
            {title}
          </Heading>
          <ChevronDown
            aria-hidden="true"
            className="size-5 shrink-0 text-muted-foreground transition-transform group-data-[panel-open]:rotate-180"
          />
        </CollapsibleTrigger>
        {headerAction ? <div className="shrink-0">{headerAction}</div> : null}
      </div>
      <CollapsibleContent>
        <div className={cn(bare ? "pb-2" : "px-4 pb-4")}>
          {subtitle ? (
            <p className="mb-3 text-sm text-muted-foreground">{subtitle}</p>
          ) : null}
          {children}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
