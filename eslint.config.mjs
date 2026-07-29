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
    // Legacy / scratch / debug — jamais lintés
    "cloudflare-workers/**",
    "scratch-*.ts",
    "scratch/**",
    ".gemini/**",
    "services/**",
    "prisma.config.js",
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
      "prefer-const": "warn",

      // React Hooks — classiques
      "react-hooks/rules-of-hooks": "warn",
      "react-hooks/exhaustive-deps": "warn",

      // React Hooks v7 (nouvelles règles) — OFF ou WARN
      // eslint-config-next les force en "error", on les surcharge.
      "react-hooks/immutability": "off",
      "react-hooks/static-components": "off",
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/error-boundaries": "off",

      // React Compiler (règles expérimentales) — Downgrade de error → warn
      // Ces règles détectent des violations de pureté React (Date.now(), refs pendant le rendu...)
      // Elles sont correctes mais trop strictes pour notre codebase existante.
      // On migre progressivement, pas bloquant pour la CI.
      "react-hooks/purity": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/preserve-manual-memoization": "warn",
    }
  },
]);

export default eslintConfig;
