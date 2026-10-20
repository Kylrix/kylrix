import { createRequire } from "node:module";

const _require = createRequire(import.meta.url);
const _nextConfigs = _require("eslint-config-next/core-web-vitals");
const _unusedImports = _require("eslint-plugin-unused-imports");
const _typescriptEslint = _require(
  _require.resolve("@typescript-eslint/eslint-plugin", {
    paths: [_require.resolve("eslint-config-next")],
  }),
);

const _eslintConfig = [
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "dist/**",
      "packages/**",
      "packages/*/dist/**",
      "out/**",
      "build/**",
      "**/generated/**",
      "functions/**",
      ".repo/**",
      ".agents/**",
      ".ignore/**",
      "scripts/**",
    ],
  },
  ..._nextConfigs,
  {
    plugins: {
      "unused-imports": _unusedImports,
      "@typescript-eslint": _typescriptEslint,
    },
    linterOptions: {
      reportUnusedDisableDirectives: "off",
    },
    rules: {
      "unused-imports/no-unused-imports": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          ignoreRestSiblings: true,
        },
      ],
      "no-unused-vars": "off",
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/exhaustive-deps": "off",
      "react-hooks/preserve-manual-memoization": "off",
      "react-hooks/refs": "off",
      "react-hooks/purity": "off",
      "react-hooks/globals": "off",
      "react-hooks/immutability": "off",
      "react-hooks/rules-of-hooks": "error",
      "@next/next/no-img-element": "off",
      "import/no-anonymous-default-export": "off",
    },
  },
];

export default _eslintConfig;
