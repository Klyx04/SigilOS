/**
 * Garde — **blocs Combat tactique / semi-tactique + liens + markdown** (12/11/2026).
 *
 * 🎯 Ce que le lot livre :
 *  · deux types de bloc d'information (non cochables) avec une image fournie ;
 *  · un champ libre markdown borné (gras, italique, titres, listes, couleurs) ;
 *  · des liens nommés (vidéo YouTube, guide écrit) avec favicon automatique ;
 *  · une modale large pour **tous** les types de bloc, champ libre redimensionnable.
 *
 * 🛡️ Ce fichier tient le schéma, le câblage du studio et les trois surfaces.
 * Les règles pures sont testées dans `rush-block-types`, `rush-block-links` et
 * `rush-markdown` ; les composants ne sont pas rendus dans un DOM.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const codeOf = (path: string) =>
  readFileSync(path, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");

const SCHEMA = readFileSync("prisma/schema.prisma", "utf8");
const MIGRATION = readFileSync(
  "prisma/migrations/20270131000000_add_rush_combat_blocks/migration.sql",
  "utf8",
);
const STUDIO = codeOf("src/components/god/rush-editor/RushEditorStudio.tsx");
const ACTIONS = codeOf("src/server/actions/optimized-guide-actions.ts");
const TIMELINE = codeOf("src/app/dashboard/[guildId]/quetes-dofus/guide/[slug]/RushTimelineClient.tsx");
const PUBLIC = codeOf("src/app/guides/rush-sylvestre/_components/PublicRushGuideClient.tsx");
const OVERLAY = codeOf("src/app/overlay/guide/[guildId]/[slug]/GuideOverlayClient.tsx");
const SIDEBAR = codeOf("src/components/dofus-quests/rush/RushChapterSidebar.tsx");

describe("schéma — deux types et une colonne de liens", () => {
  it("les deux valeurs sont dans l'enum Prisma", () => {
    expect(SCHEMA).toContain("COMBAT_TACTIQUE");
    expect(SCHEMA).toContain("COMBAT_SEMI_TACTIQUE");
  });

  it("`GuideMilestone.links` est un JSON nullable (aucun backfill)", () => {
    expect(SCHEMA).toContain("links           Json?");
  });

  it("la migration est additive et rejouable", () => {
    expect(MIGRATION).toContain("ADD VALUE IF NOT EXISTS 'COMBAT_TACTIQUE'");
    expect(MIGRATION).toContain("ADD VALUE IF NOT EXISTS 'COMBAT_SEMI_TACTIQUE'");
    expect(MIGRATION).toContain('ADD COLUMN IF NOT EXISTS "links" JSONB');
    expect(MIGRATION).not.toMatch(/DROP\s+(TABLE|COLUMN|TYPE)/i);
  });
});

describe("studio — palette, modale et éditeurs", () => {
  it("la palette porte les deux types avec l'image fournie", () => {
    expect(STUDIO).toContain('value: "COMBAT_TACTIQUE"');
    expect(STUDIO).toContain('value: "COMBAT_SEMI_TACTIQUE"');
    expect(STUDIO).toContain("RUSH_COMBAT_BLOCK_META.COMBAT_TACTIQUE.image");
    expect(STUDIO).toContain("RUSH_COMBAT_BLOCK_META.COMBAT_SEMI_TACTIQUE.image");
  });

  it("le formulaire de bloc est monté une seule fois, dans l'inspecteur ou la modale", () => {
    expect(STUDIO).toContain("const blockForm = blockBeingEdited ? (");
    expect(STUDIO).toContain("open={blockFullscreen && !!blockForm}");
    expect(STUDIO).toContain("max-w-[min(1100px,calc(100vw-2rem))]");
  });

  it("le champ libre est redimensionnable et porte une barre markdown", () => {
    expect(STUDIO).toContain("resize-y");
    expect(STUDIO).toContain("min-h-[160px]");
    expect(STUDIO).toContain("RushMarkdownToolbar");
    expect(STUDIO).toContain("RushMarkdown blocks={parseRushMarkdown");
  });

  it("les liens sont éditables (nom + URL), avec favicon", () => {
    expect(STUDIO).toContain("RushBlockLinksEditor");
    expect(STUDIO).toContain("+ Lien");
    expect(STUDIO).toContain("<SiteFavicon");
    expect(STUDIO).toContain("links: m.links ?? undefined");
  });

  it("l'image du bloc reste importable et modifiable", () => {
    expect(STUDIO).toContain("<BlockImageField");
    expect(STUDIO).toContain("onEditChange({ imageUrl: url })");
  });

  it("les blocs Combat ne portent ni route ni quêtes", () => {
    expect(STUDIO).toContain("const isCombat = isRushCombatBlock(type);");
    expect(STUDIO).toContain("{!isTips && !isSeparator && !isCombat && (");
  });
});

describe("serveur — les liens sont bornés avant écriture", () => {
  it("`upsertRushMilestone` accepte et normalise `links`", () => {
    expect(ACTIONS).toContain("links?: unknown;");
    expect(ACTIONS).toContain("normalizeRushBlockLinks(data.links)");
  });

  it("un update sans `links` n'efface pas les liens existants", () => {
    expect(ACTIONS).toContain("...(data.links !== undefined ? { links: normalizeRushBlockLinks(data.links) } : {})");
  });
});

describe("surfaces — un seul bandeau partagé", () => {
  it("les trois surfaces montent RushCombatBanner", () => {
    expect(TIMELINE).toContain("RushCombatBanner");
    expect(PUBLIC).toContain("RushCombatBanner");
    expect(OVERLAY).toContain("RushCombatBanner");
  });

  it("le guide et l'overlay utilisent la bonne densité", () => {
    expect(TIMELINE).toContain('surface="page"');
    expect(PUBLIC).toContain('surface="page"');
    expect(OVERLAY).toContain('surface="pip"');
  });

  it("les filtres passent par la règle unique, jamais par une liste locale", () => {
    expect(TIMELINE).toContain("isRushNonQuestBlock");
    expect(PUBLIC).toContain("isRushNonQuestBlock");
    expect(SIDEBAR).toContain("isRushNonQuestBlock");
  });
});
