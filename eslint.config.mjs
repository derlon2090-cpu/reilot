import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

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
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    // These admin screens intentionally start async loaders from effects and
    // commit their results after the awaited network boundary.
    files: [
      "src/components/admin/AdminPortal.jsx",
      "src/components/admin/AdminSallaCatalog.jsx",
      "src/components/admin/AdminSections.jsx",
      "src/components/admin/AdminTemplateEditor.jsx",
      "src/components/admin/SecurityCenter.jsx"
    ],
    rules: {
      "react-hooks/set-state-in-effect": "off"
    }
  },
  {
    files: ["tests/**/*.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "warn"
    }
  }
];

export default eslintConfig;
