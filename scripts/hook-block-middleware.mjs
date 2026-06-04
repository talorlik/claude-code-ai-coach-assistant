#!/usr/bin/env node
// PreToolUse hook: hard-block any Write/Edit whose target is a root (or src/)
// `middleware.ts`. This project is Next.js 16 - request interception lives in
// `proxy.ts`, never `middleware.ts`. This stops an agent from creating the file
// in the first place (vector the build-gate guard cannot prevent, only detect).
//
// Claude Code passes the tool call as JSON on stdin. To BLOCK, exit code 2 and
// write the reason to stderr (the harness feeds stderr back to the model). Any
// other exit code (including 0) allows the call. We fail OPEN on parse errors -
// a malformed payload must not wedge every file write; the build-gate guard is
// the deterministic backstop.

import { basename, dirname, normalize } from "node:path";

function read(stream) {
  return new Promise((resolve) => {
    let data = "";
    stream.setEncoding("utf8");
    stream.on("data", (c) => (data += c));
    stream.on("end", () => resolve(data));
    stream.on("error", () => resolve(""));
  });
}

const raw = await read(process.stdin);

let payload;
try {
  payload = JSON.parse(raw);
} catch {
  process.exit(0); // fail open: don't break writes on a bad payload
}

const filePath = payload?.tool_input?.file_path;
if (typeof filePath !== "string" || filePath.length === 0) {
  process.exit(0);
}

const name = basename(filePath);
const isMiddleware = /^middleware\.(ts|js|mjs|cts|mts)$/.test(name);

if (isMiddleware) {
  // Block only a ROOT-level middleware - the only place Next.js resolves a
  // request interceptor: the project root, or a top-level `src/`. A deeper
  // `middleware.ts` (e.g. lib/foo/middleware.ts) is an unrelated file, allowed.
  //
  // Write/Edit always pass an ABSOLUTE file_path, and the hook receives the
  // project root as `cwd`. Compare the file's directory to cwd and cwd/src.
  const dir = normalize(dirname(filePath)).replace(/\\/g, "/").replace(/\/$/, "");
  const cwd = typeof payload?.cwd === "string"
    ? normalize(payload.cwd).replace(/\\/g, "/").replace(/\/$/, "")
    : "";

  // Primary check: directory equals project root or its top-level `src/`.
  let atRoot = cwd !== "" && (dir === cwd || dir === `${cwd}/src`);

  // Fallback for when cwd is absent or paths are relative: treat a bare
  // filename (no directory) or a `src/`-parented file as root-level.
  if (cwd === "") {
    const segs = dir.split("/").filter((s) => s && s !== ".");
    atRoot = segs.length === 0 || segs[segs.length - 1] === "src";
  }

  if (atRoot) {
    process.stderr.write(
      [
        "BLOCKED by project guard: refusing to create a root `middleware.ts`.",
        "",
        "This project targets Next.js 16, which uses root `proxy.ts` (exporting",
        "`proxy`) for request interception - NOT `middleware.ts`. A root",
        "middleware file breaks Supabase `updateSession` and next-intl routing.",
        "",
        "Compose the logic into the existing `proxy.ts` instead.",
      ].join("\n"),
    );
    process.exit(2); // block
  }
}

process.exit(0); // allow
