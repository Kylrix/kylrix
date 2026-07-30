import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const nextConfigs = require("eslint-config-next/core-web-vitals");
const unusedImports = require("eslint-plugin-unused-imports");
const typescriptEslint = require(
  require.resolve("@typescript-eslint/eslint-plugin", {
    paths: [require.resolve("eslint-config-next")],
  }),
);

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
      "@typescript-eslint": typescriptEslint,
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
      "@next/next/no-img-element": "off",
      "import/no-anonymous-default-export": "off",
    },
  },
];

export default eslintConfig;
