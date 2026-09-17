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
    // Generated at build time by @ducanh2912/next-pwa (see public/.gitignore
    // comment) — minified service-worker bundles, not source we author.
    "public/sw.js",
    "public/sw.js.map",
    "public/workbox-*.js",
    "public/workbox-*.js.map",
    "public/worker-*.js",
    "public/worker-*.js.map",
    "public/fallback-*.js",
    "public/fallback-*.js.map",
    "public/swe-worker-*.js",
    "public/swe-worker-*.js.map",
  ]),
]);

export default eslintConfig;
