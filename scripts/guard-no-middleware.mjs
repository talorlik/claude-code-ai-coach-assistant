#!/usr/bin/env node
// Guard: this project is Next.js 16, which uses root `proxy.ts` (exporting
// `proxy`) for request interception. The legacy `middleware.ts` convention must
// never reappear - a stray root middleware.ts either conflicts with proxy.ts or
// is silently ignored, breaking Supabase session refresh and next-intl routing.
//
// This runs in the verification gate (prebuild, pretypecheck) so it catches a
// middleware.ts created by ANY vector the Write-hook cannot see: a dependency
// codemod, a next-intl/Supabase `init` script, a manual copy from old docs, or
// a merge. It is the deterministic backstop, not advice.
//
// Exit non-zero (fail the gate) if a forbidden file exists. Silent on success.

import { existsSync } from "node:fs";
import { resolve } from "node:path";

// Next.js resolves middleware from the project root or a top-level `src/`.
// Cover both, every extension Next.js accepts.
const FORBIDDEN = [
  "middleware.ts",
  "middleware.js",
  "middleware.mjs",
  "src/middleware.ts",
  "src/middleware.js",
  "src/middleware.mjs",
];

const offenders = FORBIDDEN.filter((rel) => existsSync(resolve(process.cwd(), rel)));

if (offenders.length > 0) {
  console.error(
    [
      "",
      "BLOCKED: forbidden middleware file(s) detected:",
      ...offenders.map((f) => `  - ${f}`),
      "",
      "This project targets Next.js 16, which uses root `proxy.ts` (exporting",
      "`proxy`), NOT `middleware.ts`. A root middleware file breaks Supabase",
      "session refresh and next-intl locale routing.",
      "",
      "Fix: delete the middleware file and compose its logic into `proxy.ts`",
      "instead (chain it with the existing Supabase `updateSession` call).",
      "",
    ].join("\n"),
  );
  process.exit(1);
}
