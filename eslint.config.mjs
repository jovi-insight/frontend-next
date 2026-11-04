import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["tests/**/*.cjs", "generate-icons.js"],
    // Estes testes são executados diretamente pelo Node em CommonJS.
    rules: { "@typescript-eslint/no-require-imports": "off", "@next/next/no-assign-module-variable": "off" },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    ".teste-build/**",
    "entrega/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "public/vendor/math-ocr/**",
  ]),
]);

export default eslintConfig;
