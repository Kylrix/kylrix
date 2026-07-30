import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const nextConfigs = require("eslint-config-next/core-web-vitals");
const unusedImports = require("eslint-plugin-unused-imports");

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
    plugins: {
      "unused-imports": unusedImports,
    },
    linterOptions: {
      reportUnusedDisableDirectives: "off",
    },
    rules: {
      // Remove dead imports in CI (autofixable). Broader unused-vars still via knip + cleanup campaigns.
      "unused-imports/no-unused-imports": "error",
      "@typescript-eslint/no-unused-vars": "off",
      "no-unused-vars": "off",
      // Matches common intentional patterns (mounted effects, hydrate-from-async, compose URL cleanup).
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/exhaustive-deps": "off",
      "@next/next/no-img-element": "off",
      "import/no-anonymous-default-export": "off",
    },
  },
];

export default eslintConfig;
