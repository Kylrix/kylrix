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
      // Matches common intentional patterns (mounted effects, hydrate-from-async, compose URL cleanup).
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/exhaustive-deps": "off",
      "@next/next/no-img-element": "off",
      "import/no-anonymous-default-export": "off",
    },
  },
];

export default eslintConfig;
