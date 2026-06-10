import { readdirSync, readFileSync } from "node:fs"
import { join, resolve } from "node:path"

import { describe, expect, it } from "vitest"

/**
 * Single-service-worker guard. PWA work (batch 20) must extend the existing
 * push worker (batch 15), never add a second competing one - two service
 * workers racing for control of the same scope is a classic regression. This
 * test enforces both halves of that contract:
 *
 *  1. Exactly one service-worker file exists, at `public/sw.js`.
 *  2. That file still registers the batch-15 `push` and `notificationclick`
 *     handlers, so making the app installable did not regress reminders, AND it
 *     now also carries the PWA `install`/`activate`/`fetch` lifecycle.
 *
 * It mirrors the no-middleware guard's mindset (a deterministic backstop, not
 * advice) but lives as a test because the offending file is a worker, not a
 * Next.js convention file.
 */
const projectRoot = resolve(process.cwd())
const publicDir = resolve(projectRoot, "public")

/** Directories excluded from the worker scan (deps, build output, reports). */
const IGNORED_DIRS = new Set([
  "node_modules",
  ".next",
  ".git",
  ".worktrees",
  "playwright-report",
  "test-results",
])

/** Recursively collects JS/TS file paths under `dir`, skipping ignored dirs. */
function collectSourceFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!IGNORED_DIRS.has(entry.name)) {
        collectSourceFiles(join(dir, entry.name), acc)
      }
    } else if (/\.(js|mjs|ts)$/.test(entry.name)) {
      acc.push(join(dir, entry.name))
    }
  }
  return acc
}

/** Heuristic: a file that registers ServiceWorker lifecycle listeners. */
function looksLikeServiceWorker(contents: string): boolean {
  return (
    /self\.addEventListener\(\s*["'](install|activate|fetch|push)["']/.test(
      contents
    ) || /ServiceWorkerGlobalScope/.test(contents)
  )
}

describe("single service worker", () => {
  it("ships exactly one service-worker file, at public/sw.js", () => {
    // Scan the source tree (excluding deps and build output) for any file that
    // behaves like a service worker; only public/sw.js may. Test files are
    // excluded so this guard does not match itself.
    const workers = collectSourceFiles(projectRoot)
      .filter((path) => !path.includes(`${join("__tests__")}`))
      .filter((path) => {
        try {
          return looksLikeServiceWorker(readFileSync(path, "utf8"))
        } catch {
          return false
        }
      })

    expect(workers).toEqual([resolve(publicDir, "sw.js")])
  })

  it("keeps the batch-15 push handlers in sw.js", () => {
    const sw = readFileSync(resolve(publicDir, "sw.js"), "utf8")
    expect(sw).toContain('self.addEventListener("push"')
    expect(sw).toContain('self.addEventListener("notificationclick"')
  })

  it("adds the PWA offline lifecycle to sw.js", () => {
    const sw = readFileSync(resolve(publicDir, "sw.js"), "utf8")
    expect(sw).toContain('self.addEventListener("install"')
    expect(sw).toContain('self.addEventListener("activate"')
    expect(sw).toContain('self.addEventListener("fetch"')
  })
})
