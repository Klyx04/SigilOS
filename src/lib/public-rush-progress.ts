/**
 * Espace visiteur (rang 57) — **progression de rush en base** (V1d) : règles pures, aucune I/O.
 *
 * Le guide public écrit aujourd'hui dans le `localStorage`, sous quatre clés
 * (`src/lib/guest-progress.ts` : `completed_ms`, `steps`, `bookmarks`, `dungeons`). Ce module
 * décrit ce que l'on accepte d'en envoyer au serveur, et **rien de plus** :
 *
 *  · **borné** : une liste de blocs, des étapes par bloc, des repères, des coches de donjons —
 *    chacun plafonné. Au-delà, on **refuse** (jamais une troncature silencieuse : une donnée
 *    tronquée serait indiscernable d'une progression réellement plus courte) ;
 *  · **fermé** : `dungeonChecks` n'accepte que `"done"` / `"todo"`, `characterSlot` qu'un slug
 *    ou `PRINCIPAL` — le reste est rejeté ;
 *  · **aucun champ privé** : ni pseudo du compte, ni Metamob, ni `userId`. Le seul identifiant
 *    est l'emplacement (`characterSlot`), qui vient du navigateur du visiteur lui-même.
 */

import { z } from "zod";

/** Slug du guide Rush — le seul guide dont la progression est persistée en V1d. */
export const PUBLIC_RUSH_GUIDE_ID = "rush-sylvestre";

/** Les guides acceptés par le store : une liste fermée, jamais une valeur venue du client. */
export const PUBLIC_RUSH_GUIDES: ReadonlySet<string> = new Set([PUBLIC_RUSH_GUIDE_ID]);

/** Emplacement du personnage principal — même convention que les trois tables internes. */
export const PUBLIC_SLOT_PRINCIPAL = "PRINCIPAL";

/** Bornes dites à l'écran (aucune constante recopiée). */
export const PUBLIC_RUSH_MAX_MILESTONES = 300;
export const PUBLIC_RUSH_MAX_STEPS_PER_MILESTONE = 500;
export const PUBLIC_RUSH_MAX_DUNGEON_CHECKS = 2_000;
export const PUBLIC_RUSH_SLOT_MAX = 60;

/** Longueur maximale d'une clé (id de bloc, d'étape, d'occurrence `sequenceId::dungeonKey`). */
const MAX_KEY = 200;

const keySchema = z.string().min(1).max(MAX_KEY);

/**
 * Emplacement : `PRINCIPAL` ou le slug du personnage (`guestCharacterSlot` : `moniop-295`).
 * Volontairement restrictif — un emplacement est une **clé**, pas un texte libre.
 */
export const publicRushSlotSchema = z
    .string()
    .min(1, "Emplacement manquant.")
    .max(PUBLIC_RUSH_SLOT_MAX, "Emplacement trop long.")
    .regex(/^[A-Za-z0-9_-]+$/, "Emplacement invalide.");

/** Le payload complet, tel que le guide public l'envoie. */
export const publicRushProgressSchema = z.object({
    characterSlot: publicRushSlotSchema,
    characterName: z.string().max(40).nullable().optional(),
    classe: z.string().max(40).nullable().optional(),
    /** Blocs terminés (ids de `GuideMilestone`). */
    completedMilestones: z.array(keySchema).max(PUBLIC_RUSH_MAX_MILESTONES).default([]),
    /** Étapes cochées, par bloc. */
    completedSteps: z
        .record(keySchema, z.array(keySchema).max(PUBLIC_RUSH_MAX_STEPS_PER_MILESTONE))
        .default({})
        .refine(
            (value) => Object.keys(value).length <= PUBLIC_RUSH_MAX_MILESTONES,
            "Trop de blocs dans la progression."
        ),
    /** Repère « Je suis ici », par bloc. */
    bookmarks: z
        .record(keySchema, keySchema)
        .default({})
        .refine(
            (value) => Object.keys(value).length <= PUBLIC_RUSH_MAX_MILESTONES,
            "Trop de repères dans la progression."
        ),
    /** Coches de donjons, par occurrence (`sequenceId::dungeonKey`). */
    dungeonChecks: z
        .record(z.string().max(MAX_KEY), z.enum(["done", "todo"]))
        .default({})
        .refine(
            (value) => Object.keys(value).length <= PUBLIC_RUSH_MAX_DUNGEON_CHECKS,
            "Trop de donjons dans la progression."
        ),
    currentStep: keySchema.nullable().optional(),
});

export type PublicRushProgressPayload = z.infer<typeof publicRushProgressSchema>;

/** Réinitialisation : on n'efface **qu'un** emplacement, jamais tout le profil. */
export const publicRushResetSchema = z.object({ characterSlot: publicRushSlotSchema });

/** Lecture/adoption : le store a seulement besoin de savoir **quel** emplacement regarder. */
export const publicRushSlotSchemaInput = z.object({ characterSlot: publicRushSlotSchema });

/**
 * Payload → colonnes Prisma. Une seule conversion, utilisée par `save` **et** `adopt` :
 * `undefined` devient `null` (les colonnes sont nullables) et les `Json` reçoivent la forme
 * exacte du stockage local, pour que V2a puisse relire sans transformation.
 */
export function toPublicRushColumns(payload: PublicRushProgressPayload) {
    return {
        characterSlot: payload.characterSlot,
        characterName: payload.characterName ?? null,
        classe: payload.classe ?? null,
        completedMilestones: payload.completedMilestones,
        completedSteps: payload.completedSteps,
        bookmarks: payload.bookmarks,
        dungeonChecks: payload.dungeonChecks,
        currentStep: payload.currentStep ?? null,
    };
}
