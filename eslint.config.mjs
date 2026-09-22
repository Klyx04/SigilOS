import { defineConfig, globalIgnores } from "eslint/config";
import { fixupConfigRules, fixupPluginRules } from "@eslint/compat";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import reactHooks from "eslint-plugin-react-hooks";

// ── Phase 4 — Garde-fou anti-régression V2 Dual-Theme ──────────────────────
// Warn (non bloquant) sur les couleurs en dur (text-white, bg-zinc-*, hex en dur,
// couleurs d'état en dur) → les tokens sémantiques thème-aware sont obligatoires.
// Allowlist : fichiers dark-locked/legacy (Songes, worldmap, god, guides, landings)
// + valeurs hex préservées (Discord, rareté Dofus, dégradés de mission, scrims).
const themeNoHardcodedColors = {
  meta: {
    type: "suggestion",
    docs: { description: "Garde-fou V2 Dual-Theme : couleurs en dur interdites (tokens thème-aware obligatoires)." },
    schema: [
      {
        type: "object",
        properties: {
          allowFiles: { type: "array", items: { type: "string" } },
          allowHex: { type: "array", items: { type: "string" } },
        },
        additionalProperties: false,
      },
    ],
  },
  create(context) {
    const filename = String(context.filename ?? context.getFilename?.() ?? "").toLowerCase();
    const options = context.options[0] || {};
    const allowFiles = (options.allowFiles || []).map((p) => String(p).toLowerCase());
    const allowHex = new Set((options.allowHex || []).map((h) => String(h).toLowerCase().replace(/^#/, "")));
    if (allowFiles.some((p) => filename.includes(p))) return {};

    const HEX_RE = /(?<![\w-])(bg|text|border|from|to|via|ring|fill|stroke)-\[#([0-9a-fA-F]{3,8})\]/g;
    const TEXT_WHITE_RE = /(?<![\w-])text-white(?:\/[^ \t\n"'`]*)?/g;
    const TEXT_BLACK_RE = /(?<![\w-])text-black(?:\/[^ \t\n"'`]*)?/g;
    // bg-black BARE (sans /opacité) interdit — les scrims bg-black/N restent autorisés.
    const BG_BLACK_RE = /(?<![\w-])bg-black(?!\/)/g;
    const NEUTRAL_RE = /(?<![\w-])(?:text|bg|border|divide|ring|from|to|via)-(?:zinc|slate|gray|neutral|stone)-\d+(?:\/[^ \t\n"'`]*)?/g;
    const STATE_RE = /(?<![\w-])(?:text|bg|border|from|to|via)-(?:emerald|amber|red|rose|blue|cyan|purple|indigo)-\d+(?:\/[^ \t\n"'`]*)?/g;

    function checkString(text, node) {
      if (!text) return;
      for (const m of text.matchAll(HEX_RE)) {
        if (!allowHex.has(m[2].toLowerCase())) {
          context.report({ node, message: `Couleur en dur : ${m[0]} → token thème-aware obligatoire (bg-surface/bg-popover/text-foreground…) ou ajout à l'allowlist Phase 4.` });
        }
      }
      for (const re of [TEXT_WHITE_RE, TEXT_BLACK_RE, BG_BLACK_RE, NEUTRAL_RE, STATE_RE]) {
        for (const m of text.matchAll(re)) {
          context.report({ node, message: `Couleur en dur : ${m[0]} → token sémantique obligatoire (V2 Dual-Theme).` });
        }
      }
    }

    return {
      Literal(node) {
        if (typeof node.value === "string") checkString(node.value, node);
      },
      TemplateLiteral(node) {
        checkString(node.quasis.map((q) => q.value.cooked ?? q.value.raw).join(""), node);
      },
    };
  },
};

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
      // Phase 4 — garde-fou anti-régression V2 Dual-Theme (warn non bloquant).
      "sigil": { rules: { "no-hardcoded-colors": themeNoHardcodedColors } },
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

      // Phase 4 — garde-fou anti-régression Dual-Theme : couleurs en dur → warn.
      "sigil/no-hardcoded-colors": ["warn", {
        allowFiles: [
          // dark-locked (Phase 2C) — modules volontairement sombres
          "songes", "worldmap", "ocre-filter-bar",
          // guides / Rush / géoguesseur — surfaces legacy en cours de reprise (chantiers dédiés)
          "guide", "rush", "geoguesser",
          // God — console admin dark legacy : chantier dédié (93 fichiers, ~3 500 couleurs)
          "god-sidebar", "god-top-nav", "mobile-god-sidebar", "god-nav-config",
          "\\god\\",
          // données de couleur volontaires (config par catégorie / rendu inline)
          "dofus-tags", "mission-config", "profile-activities", "render-inline-content",
        ],
        allowHex: [
          // Discord (marque + palettes embed)
          "5865f2", "4752c4", "313338", "2b2d31", "4e5058", "3e4171", "00a8fc",
          "dbdee1", "b5bac1", "949ba4", "c9cdfb", "3f4147",
          // Dofus — raretés / stats (dofusbook-preview, accès rapide)
          "e2e2e2", "9d753e", "e33e19", "5ac2ff", "88c72b", "a560df", "f59f0f",
          "008cfc", "2cb14b", "389f81", "f24254", "ef3f3f", "a78bfa", "a855f7",
          "ff4757", "ff6b81", "ef4444",
          // Missions — dégradés de carte par type (mission-card/validation-card)
          "a11a21", "d32f2f", "6b0f14", "4b6b1a", "7cb342", "2d4010", "7d1a6b",
          "ab47bc", "4d1040", "1a6b7d", "26c6da", "10404d", "7d5b1a", "ffa000",
          "4d3810", "7d6b1a", "fbc02d", "4d4010", "f43f5e", "10b981", "d946ef",
          "22d3ee", "fbbf24", "fde047",
          // scrims de lisibilité d'images
          "0d1117",
        ],
      }],

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
