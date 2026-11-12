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
 */

const JOB_IDS: ReadonlySet<string> = new Set(Object.values(DOFUS_JOBS).flat().map((job) => job.id));
const CLASS_IDS: ReadonlySet<string> = new Set(DOFUS_CLASSES.map((dofusClass) => dofusClass.id));
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const level = z.number().int().min(1).max(200);
const jobId = z.string().refine((id) => JOB_IDS.has(id), "Métier inconnu");
const classId = z.string().refine((id) => CLASS_IDS.has(id), "Classe inconnue");

const roleSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("job"), job: jobId, level: level.optional() }),
  z.object({ kind: z.literal("class"), className: classId, level: level.optional() }),
  z.object({ kind: z.literal("free"), text: z.string().trim().min(1).max(200) }),
]);

export const rushQuestConstraintsSchema = z
  .object({
    version: z.literal(1),
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
  })
  .strict();

/** `null` si la valeur est absente ou invalide — l'appelant décide de refuser. */
export function parseRushQuestConstraints(value: unknown): RushQuestConstraints | null {
  if (value === null || value === undefined) return null;
  const parsed = rushQuestConstraintsSchema.safeParse(value);
  return parsed.success ? (parsed.data as RushQuestConstraints) : null;
}
