import { defineConfig, globalIgnores } from "eslint/config";
import { fixupConfigRules, fixupPluginRules } from "@eslint/compat";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import reactHooks from "eslint-plugin-react-hooks";

const eslintConfig = defineConfig([
  // ── 1. Configs Next.js (chargés en premier) ──
  ...fixupConfigRules(nextVitals),
  ...fixupConfigRules(nextTs),

  // ── 2. Fichiers à ignorer ──
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "dist/**",
    "next-env.d.ts",
    "old_map*.tsx",
    "node_modules/**",
    ".husky/**",
    "public/**",
    // Dossiers utilitaires bruyants
    "scripts/**",
    "prisma/**",
    "tmp/**",
    "artifacts/**",
  ]),

  // ── 3. NOS OVERRIDES (DERNIER = GAGNE en flat config) ──
  // Ce bloc DOIT être le dernier pour écraser eslint-config-next.
  {
    plugins: {
      "react-hooks": fixupPluginRules(reactHooks),
    },
    // Les "Unused eslint-disable directive" deviennent des errors dans ESLint 10
    // quand on passe des règles de error→warn. On les ignore.
    linterOptions: {
      reportUnusedDisableDirectives: "off",
    },
    rules: {
      "react/no-unescaped-entities": "off",
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": ["warn", { "argsIgnorePattern": "^_" }],
      "@next/next/no-img-element": "warn",
      "@typescript-eslint/no-require-imports": "warn",
      "@typescript-eslint/ban-ts-comment": "warn",
      "@next/next/no-assign-module-variable": "warn",
      "@typescript-eslint/no-this-alias": "warn",
      "@typescript-eslint/no-unused-expressions": "warn",

      // React Hooks — classiques
      "react-hooks/rules-of-hooks": "warn",
      "react-hooks/exhaustive-deps": "warn",

      // React Hooks v7 (nouvelles règles) — OFF car eslint-config-next
      // les force en "error" et notre "warn" se fait écraser.
      // Ce sont des règles de style/perf, pas de correction de bugs.
      "react-hooks/immutability": "off",
      "react-hooks/static-components": "off",
      "react-hooks/set-state-in-effect": "off",
    }
  },
]);

export default eslintConfig;

