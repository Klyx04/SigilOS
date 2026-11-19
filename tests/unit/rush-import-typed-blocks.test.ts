/**
 * Gardes — **import de blocs typés** (17/11/2026).
 *
 * 🎯 Ce que le lot devait rendre possible : le seed de la route ne crée plus 57 blocs
 * `QUETE_SERIE` muets. Il porte le **type réel** (DOFUS, ALIGNEMENT, DONJON, INFO…),
 * son chapitre, sa description, ses liens et ses quêtes-succès — **sans migration** :
 * les colonnes existent depuis les lots précédents.
 *
 * 🛡️ Ce que ce test verrouille :
 *  · la liste des types acceptés est **exactement** l'enum Prisma (aucun type inventé) ;
 *  · un bloc d'information **sans quête** est planifié et n'est pas un no-op ;
 *  · l'action valide l'image et les liens (safeImageUrl, normalizeRushBlockLinks) ;
 *  · `isSuccess` est écrit ; le type par défaut reste `QUETE_SERIE`.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { isRushImportNoop, planRushImport, type RushImportPayload } from "@/lib/rush-import";

const ACTIONS = readFileSync(
  path.join(process.cwd(), "src/server/actions/optimized-guide-actions.ts"),
  "utf8"
);
const LIB = readFileSync(path.join(process.cwd(), "src/lib/rush-import.ts"), "utf8");
const SCHEMA = readFileSync(path.join(process.cwd(), "prisma/schema.prisma"), "utf8");

const EMPTY = { milestones: [] };

describe("plan — les métadonnées de bloc n'empêchent rien", () => {
  it("un bloc DOFUS typé et un bloc INFO vide sont planifiés", () => {
    const payload: RushImportPayload = {
      blocks: [
        {
          title: "Dofus Domakuro",
          type: "DOFUS",
          chapter: 2,
          chapterLabel: "Pandala",
          description: "Progression officielle du DofusDex.",
          accentColor: "#10b981",
          imageUrl: "https://dofusdb.fr/img/items/1.png",
          tips: "Ne pas lancer la quête avant d'avoir pris les prérequis.",
          links: [{ label: "Guide", url: "https://dofusdb.fr" }],
          dofusId: "domakuro",
          sequences: [
            {
              subGuideName: "Le réveil de Pandala",
              questDbIds: [2149],
              dungeonDbIds: [13],
              isSuccess: false,
              activityTags: [
                { type: "item", name: "Ortie", id: "421", quantity: 50 },
                { type: "donjon", name: "Grotte de Kanigroula" },
              ],
            },
          ],
        },
        { title: "Conseil", type: "INFO", tips: "Un bloc sans quête.", sequences: [] },
      ],
    };

    const plan = planRushImport(payload, EMPTY);
    expect(plan.totals.blocksNew).toBe(2);
    expect(plan.totals.sequencesNew).toBe(1);
    expect(plan.warnings).toHaveLength(0);
    expect(isRushImportNoop(plan)).toBe(false);
  });

  it("un bloc de quêtes vide reste sans contenu mais n'est pas perdu du plan", () => {
    const plan = planRushImport(
      { blocks: [{ title: "Vide", type: "QUETE_SERIE", sequences: [] }] },
      EMPTY
    );
    expect(plan.blocks[0].toCreate).toBe(0);
    expect(plan.totals.blocksNew).toBe(1);
  });
});

describe("verrou de source — l'enum Prisma et l'import ne divergent pas", () => {
  it("la liste fermée de l'import couvre exactement GuideMilestoneType", () => {
    const enumStart = SCHEMA.indexOf("enum GuideMilestoneType {");
    const enumEnd = SCHEMA.indexOf("}", enumStart);
    const enumValues = [...SCHEMA.slice(enumStart, enumEnd).matchAll(/^\s{2}([A-Z_]+)\s/gm)].map(
      (match) => match[1]
    );

    const listStart = ACTIONS.indexOf("const RUSH_IMPORT_BLOCK_TYPES");
    const listEnd = ACTIONS.indexOf("] as const;", listStart);
    const imported = [...ACTIONS.slice(listStart, listEnd).matchAll(/"([A-Z_]+)"/g)].map(
      (match) => match[1]
    );

    expect(new Set(imported)).toEqual(new Set(enumValues));
    expect(imported).toHaveLength(enumValues.length);
  });

  it("le schéma Zod borne les métadonnées et refuse un type inconnu", () => {
    expect(ACTIONS).toContain("type: z.enum(RUSH_IMPORT_BLOCK_TYPES).optional()");
    expect(ACTIONS).toContain("chapter: z.number().int().min(0).max(1000).optional()");
    expect(ACTIONS).toContain("description: z.string().max(8000).nullish()");
    expect(ACTIONS).toContain("accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullish()");
    // Le seed pose `null` : l'import ne doit pas imposer un vert (la DA / le Dofus décide).
    expect(ACTIONS).toContain("accentColor: payloadBlock.accentColor ?? null");
    // Le nouveau guide (seed Trame) refuse l'ancien import legacy, destructif.
    expect(ACTIONS).toContain("seedSource");
    expect(ACTIONS).toContain("l'import legacy est désactivé");
    expect(ACTIONS).toContain("imageUrl: z.string().trim().max(1000).nullish()");
    expect(ACTIONS).toContain("dofusId: z.string().trim().max(64).nullish()");
    expect(ACTIONS).toContain("isSuccess: z.boolean().optional()");
  });

  it("l'écriture valide l'image, les liens et écrit isSuccess", () => {
    expect(ACTIONS).toContain("type: payloadBlock.type ?? \"QUETE_SERIE\"");
    expect(ACTIONS).toContain("safeImageUrl(payloadBlock.imageUrl) || null");
    expect(ACTIONS).toContain("normalizeRushBlockLinks(payloadBlock.links)");
    expect(ACTIONS).toContain("isRushNonQuestBlock(payloadBlock.type)");
    expect(ACTIONS).toContain("isSuccess: sequence.isSuccess ?? false");
    expect(ACTIONS).toContain("chapter: payloadBlock.chapter ?? chapter");
    expect(ACTIONS).toContain("RushImportActivityTagSchema");
    expect(ACTIONS).toContain("...(sequence.activityTags ?? [])");
    // Les donjons passent par l'id **DofusDB** puis sont résolus en `Dungeon.id`.
    // Plafond **partagé** avec le seed (`rush-dungeon-names`) : 29 alternatives mesurées
    // sur « Les totems de Maïmane » — l'ancien 12 en perdait 17 (19/11/2026).
    expect(ACTIONS).toContain("dungeonDbIds: z.array(z.number().int().positive()).max(MAX_RUSH_DUNGEONS_PER_SEQUENCE).optional()");
    expect(ACTIONS).toContain(".array(z.string().trim().min(1).max(200))");
    expect(ACTIONS).toContain(".max(MAX_RUSH_DUNGEONS_PER_SEQUENCE)");
    expect(ACTIONS).toContain("dungeonByDofusDbId");
    expect(ACTIONS).toContain("dungeonByBoss");
    expect(ACTIONS).toContain("dungeonBySlug");
    expect(ACTIONS).toContain("knownDungeonDbIds");
    expect(ACTIONS).toContain("knownDungeonNames");
    expect(ACTIONS).toContain("resolvedByName");
    expect(ACTIONS).toContain("resolveRushDungeonByName");
    expect(ACTIONS).toContain("dungeonDbIds,");
  });

  it("le type d'import expose les métadonnées, pas seulement un titre", () => {
    expect(LIB).toContain("type?: RushMilestoneType | string;");
    expect(LIB).toContain("chapterLabel?: string | null;");
    expect(LIB).toContain("description?: string | null;");
    expect(LIB).toContain("accentColor?: string | null;");
    expect(LIB).toContain("imageUrl?: string | null;");
    expect(LIB).toContain("links?: Array<{ label: string; url: string }> | null;");
    expect(LIB).toContain("dofusId?: string | null;");
    expect(LIB).toContain("isSuccess?: boolean;");
    expect(LIB).toContain("activityTags?: RushImportActivityTag[];");
    expect(LIB).toContain("dungeonDbIds?: number[];");
    expect(LIB).toContain("dungeonNames?: string[];");
    expect(LIB).toContain("knownDungeonDbIds?: ReadonlySet<number>;");
    expect(LIB).toContain("Donjon DofusDB");
  });
});
