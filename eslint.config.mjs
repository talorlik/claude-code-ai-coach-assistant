import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Per-branch worktrees live under `.worktrees/` (see `~/.claude/CLAUDE.md`
    // worktree model). Their bundled `node_modules` and build output would
    // otherwise be linted from the primary checkout while a worktree is live,
    // surfacing third-party `no-this-alias`/`no-require-imports`/`ban-ts-comment`
    // errors that are not this project's code.
    ".worktrees/**",
    // Supabase Edge Functions run on Deno, not Node; their remote imports and
    // `Deno` globals are resolved only at deploy time, so they are linted and
    // type-checked by the Supabase CLI, not by the Next.js toolchain.
    "supabase/functions/**",
  ]),
  // Honor the underscore-prefix convention for intentionally-unused bindings
  // (e.g. mock signatures like `async (_id: string) => ...` that document a
  // parameter they do not consume). Next's TypeScript preset enables
  // `@typescript-eslint/no-unused-vars` without an ignore pattern, so the
  // prefix the tests already use was being flagged. This makes the prefix
  // meaningful instead of cosmetic.
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },
]);

export default eslintConfig;
