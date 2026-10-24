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
    // Generated or copied files – not our code, don't lint them:
    "app/generated/**", // Prisma client (npm run db:generate)
    "public/maplibre/**", // MapLibre worker (copied by postinstall)
  ]),
]);

export default eslintConfig;