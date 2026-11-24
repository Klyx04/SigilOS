import { z } from "zod";

import { DOFUS_CLASSES, DOFUS_JOBS } from "@/lib/dofus-assets";
import type { RushQuestConstraints } from "@/types/rush-constraints";

/**
 * Validation **bornée** des conditions structurées, côté serveur.
 *
 * Le studio God n'est pas la frontière de confiance : tout ce qui arrive dans
 * `upsertRushSequence` repasse ici. Les métiers et les classes sont vérifiés contre les
 * sources uniques (`DOFUS_JOBS`, `DOFUS_CLASSES`), les heures contre `HH:MM`, les
 * effectifs et les niveaux contre des plages fermées. Une forme inconnue est **refusée**,
 * jamais écrite « au cas où ».
 *
 * **Version 2** : une quête peut enchaîner **plusieurs combats** (mesuré le 24/11/2026 :
 * 162 quêtes, jusqu'à 14). La version 1 (un seul `combat`) reste lue et normalisée en
 * mémoire — aucune donnée réelle n'existait, mais un brouillon ou un test ancien ne casse
 * pas l'enregistrement.
 */

const JOB_IDS: ReadonlySet<string> = new Set(Object.values(DOFUS_JOBS).flat().map((job) => job.id));
const CLASS_IDS: ReadonlySet<string> = new Set(DOFUS_CLASSES.map((dofusClass) => dofusClass.id));
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const level = z.number().int().min(1).max(200);
/** Niveau d'un monstre / donjon : Dofus dépasse 200 (mesuré : 1000). */
const monsterLevel = z.number().int().min(1).max(10_000);
const jobId = z.string().refine((id) => JOB_IDS.has(id), "Métier inconnu");
const classId = z.string().refine((id) => CLASS_IDS.has(id), "Classe inconnue");

const roleSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("job"), job: jobId, level: level.optional() }),
  z.object({ kind: z.literal("class"), className: classId, level: level.optional() }),
  z.object({ kind: z.literal("free"), text: z.string().trim().min(1).max(200) }),
]);

const combatSchema = z
  .object({
    mode: z.enum(["solo", "group", "tactical", "soloWaves", "groupWaves"]),
    monsters: z
      .array(
        z.object({
          name: z.string().trim().min(1).max(120),
          count: z.number().int().min(1).max(20),
          level: monsterLevel.optional(),
          health: z.number().int().min(1).max(999999).optional(),
          imageUrl: z.string().trim().max(500).optional(),
        }),
      )
      .max(20)
      .default([]),
    /** Précision libre du guide — informative, jamais une règle de blocage. */
    detail: z.string().trim().max(300).optional(),
  })
  .strict();

const baseShape = {
  hours: z
    .discriminatedUnion("kind", [
      z.object({
        kind: z.literal("window"),
        from: z.string().regex(TIME),
        to: z.string().regex(TIME).optional(),
        optional: z.boolean().optional(),
      }),
      z.object({
        kind: z.literal("wait"),
        minutes: z.number().int().min(1).max(1440),
        npc: z.boolean().optional(),
      }),
    ])
    .nullish(),
  players: z
    .object({
      count: z.number().int().min(1).max(40).optional(),
      roles: z.array(roleSchema).max(10).default([]),
    })
    .nullish(),
  jobs: z
    .array(z.object({ job: jobId, level: level.optional() }))
    .max(10)
    .default([]),
  spells: z.array(z.string().trim().min(1).max(100)).max(10).default([]),
  notes: z.array(z.string().trim().min(1).max(200)).max(10).default([]),
  dungeonChoice: z
    .object({
      dungeons: z
        .array(
          z.object({
            id: z.string().trim().max(100).optional(),
            name: z.string().trim().min(1).max(120),
            bossName: z.string().trim().max(120).optional(),
            level: monsterLevel.optional(),
            imageUrl: z.string().trim().max(500).optional(),
          }),
        )
        .max(8)
        .default([]),
      note: z.string().trim().max(300).optional(),
    })
    .nullish(),
  bashMobs: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(120),
        level: monsterLevel.optional(),
        imageUrl: z.string().trim().max(500).optional(),
      }),
    )
    .max(20)
    .default([]),
};

const v2Schema = z
  .object({
    version: z.literal(2),
    ...baseShape,
    combats: z.array(combatSchema).max(20).default([]),
  })
  .strict();

/** Ancienne forme (un seul combat) — lue puis normalisée vers la version 2. */
const v1Schema = z
  .object({
    version: z.literal(1),
    ...baseShape,
    combat: combatSchema.nullish(),
  })
  .strict();

export const rushQuestConstraintsSchema = z
  .union([v2Schema, v1Schema])
  .transform((value): RushQuestConstraints => {
    if (value.version === 2) return value as RushQuestConstraints;
    const { combat, ...rest } = value;
    return {
      ...rest,
      version: 2,
      combats: combat ? [combat] : [],
    } as RushQuestConstraints;
  });

/** `null` si la valeur est absente ou invalide — l'appelant décide de refuser. */
export function parseRushQuestConstraints(value: unknown): RushQuestConstraints | null {
  if (value === null || value === undefined) return null;
  const parsed = rushQuestConstraintsSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
