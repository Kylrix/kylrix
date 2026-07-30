import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const nextConfigs = require("eslint-config-next/core-web-vitals");

const eslintConfig = [
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "out/**",
      "build/**",
      "**/generated/**",
      "functions/**",
      ".repo/**",
      ".agents/**",
    ],
  },
  ...nextConfigs,
  {
    linterOptions: {
      reportUnusedDisableDirectives: "off",
    },
    rules: {
      // Intra-file unused locals: use knip for cross-file dead code (`pnpm exec knip`).
      // Do not enable @typescript-eslint/no-unused-vars here — it floods past --max-warnings 50.
      // Matches common intentional patterns (mounted effects, hydrate-from-async, compose URL cleanup).
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/exhaustive-deps": "off",
      "@next/next/no-img-element": "off",
      "import/no-anonymous-default-export": "off",
    },
  },
];

export default eslintConfig;
