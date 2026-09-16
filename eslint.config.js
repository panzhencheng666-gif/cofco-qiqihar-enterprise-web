import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: ["dist", "coverage", "playwright-report", "test-results"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    files: ["**/*.{js,cjs,mjs}"],
    languageOptions: { globals: globals.node },
    rules: tseslint.configs.disableTypeChecked.rules,
  },
  {
    files: ["public/session-recovery-v1.js"],
    languageOptions: { globals: globals.browser },
  },
  {
    files: ["scripts/session-recovery-smoke.cjs"],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      globals: globals.browser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: { "react-hooks": reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/no-floating-promises": "error",
    },
  },
);
