import { FlatCompat } from "@eslint/eslintrc";
import { fileURLToPath } from "node:url";
import path from "node:path";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const compat = new FlatCompat({ baseDirectory: currentDirectory });

const eslintConfig = [
  {
    ignores: [
      ".next/**",
      ".next-*/**",
      ".local/**",
      ".codex-artifacts/**",
      ".git.codex-disabled/**",
      "dist/**",
      "node_modules/**",
      "public/app/**",
      "public/data/**",
      "test-results/**",
      "playwright-report/**"
    ]
  },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    files: ["tests/**/*.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "warn"
    }
  }
];

export default eslintConfig;
