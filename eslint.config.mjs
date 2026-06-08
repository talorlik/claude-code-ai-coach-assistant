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
    // Supabase Edge Functions run on Deno, not Node; their remote imports and
    // `Deno` globals are resolved only at deploy time, so they are linted and
    // type-checked by the Supabase CLI, not by the Next.js toolchain.
    "supabase/functions/**",
  ]),
]);

export default eslintConfig;
