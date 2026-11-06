/**
 * Espace visiteur (rang 57) — **entrées bornées** du profil public (Zod, aucune I/O).
 *
 * Une seule source pour le client (longueurs affichées, aperçu) **et** le serveur
 * (validation de l'action) : deux schémas divergeraient au premier changement de borne.
 *
 * Les valeurs rendues sont **normalisées** (pseudo mis en forme, serveur vérifié, métiers
 * en slug) ; un refus porte toujours un message lisible, jamais un code.
 */

import { z } from "zod";
import { DOFUS_JOBS, getClass } from "@/lib/dofus-assets";
import { AVAILABLE_ACTIVITIES, DOFUS_UNITY_SERVERS } from "@/lib/presentation-constants";
import { declaredGuildNameSchema } from "@/lib/public-profile-rules";
import { PUBLIC_MULES_MAX } from "@/lib/public-profile-dto";
import { formatDofusPseudo } from "@/lib/utils";

/** Bornes dites à l'écran (le composant les importe : jamais une constante recopiée). */
export const PUBLIC_PSEUDO_MIN = 2;
export const PUBLIC_PSEUDO_MAX = 20;
export const PUBLIC_MULE_PSEUDO_MIN = 3;
export const PUBLIC_INTRODUCTION_MAX = 800;
export const PUBLIC_OBJECTIFS_MAX = 400;
export const PUBLIC_METAMOB_PSEUDO_MAX = 60;
export const PUBLIC_METAMOB_KEY_MAX = 200;
export const PUBLIC_PROFESSIONS_MAX = 20;
export const DELETE_CONFIRMATION_WORD = "SUPPRIMER";

/** Ids de serveurs autorisés — même référentiel que la présentation de guilde. */
export const ALLOWED_SERVER_IDS: ReadonlySet<number> = new Set(
    Object.values(DOFUS_UNITY_SERVERS).flatMap((group) =>
        (group as ReadonlyArray<{ id: number }>).map((server) => server.id)
    )
);

/** Slugs de métiers autorisés (`forgeron`, `boulanger`…), dérivés de `DOFUS_JOBS`. */
export const ALLOWED_JOB_IDS: ReadonlySet<string> = new Set(
    (Object.values(DOFUS_JOBS) as unknown as ReadonlyArray<ReadonlyArray<{ id: string }>>)
        .flat()
        .map((job) => job.id)
);

const ACTIVITY_IDS = AVAILABLE_ACTIVITIES.map((activity) => activity.id);

/** Normalise un pseudo : caractères Dofus, casse « Prénom », borné. */
export function normalizePublicPseudo(input: string, min = PUBLIC_PSEUDO_MIN): string | null {
    const formatted = formatDofusPseudo(input).replace(/\s+/g, " ").trim();
    return formatted.length >= min && formatted.length <= PUBLIC_PSEUDO_MAX ? formatted : null;
}

export const publicServerIdSchema = z
    .number()
    .int("Le serveur est invalide.")
    .refine((id) => ALLOWED_SERVER_IDS.has(id), "Choisis un serveur de la liste.");

export const publicPseudoSchema = z
    .string()
    .max(120, "Le pseudo est trop long.")
    .transform((value, ctx) => {
        const formatted = normalizePublicPseudo(value);
        if (!formatted) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: `Le pseudo doit faire entre ${PUBLIC_PSEUDO_MIN} et ${PUBLIC_PSEUDO_MAX} caractères.`,
            });
            return z.NEVER;
        }
        return formatted;
    });


const publicClasseSchema = z
    .string()
    .max(40)
    .transform((value, ctx) => {
        const classe = getClass(value);
        if (!classe) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Choisis une classe de la liste." });
            return z.NEVER;
        }
        return classe.id;
    });

const publicMuleSchema = z.object({
    pseudo: z
        .string()
        .max(120)
        .transform((value, ctx) => {
            const formatted = normalizePublicPseudo(value, PUBLIC_MULE_PSEUDO_MIN);
            if (!formatted) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: `Un pseudo de mule doit faire entre ${PUBLIC_MULE_PSEUDO_MIN} et ${PUBLIC_PSEUDO_MAX} caractères.`,
                });
                return z.NEVER;
            }
            return formatted;
        }),
    classe: z.string().max(40).nullable().optional(),
    level: z.number().int().min(1).max(200).nullable().optional(),
});

export const publicMulesSchema = z
    .array(publicMuleSchema)
    .max(PUBLIC_MULES_MAX)
    .refine(
        (mules) => new Set(mules.map((mule) => mule.pseudo.toLowerCase())).size === mules.length,
        "Une mule ne peut être déclarée qu'une fois."
    );

export const publicPresentationSchema = z.object({
    introduction: z.string().max(PUBLIC_INTRODUCTION_MAX).nullable(),
    objectifs: z.string().max(PUBLIC_OBJECTIFS_MAX).nullable(),
    preferredActivities: z.array(z.string().max(40)).max(ACTIVITY_IDS.length),
});

export const publicProfessionSchema = z.object({
    id: z.string().max(40),
    level: z.number().int().min(1).max(200),
});

export const publicProfessionsSchema = z
    .array(publicProfessionSchema)
    .max(PUBLIC_PROFESSIONS_MAX)
    .refine(
        (entries) => new Set(entries.map((entry) => entry.id)).size === entries.length,
        "Un métier ne peut être déclaré qu'une fois."
    );

export const publicSettingsSchema = z.object({
    showOnDirectory: z.boolean(),
    showPresence: z.boolean(),
});

export const publicMetamobSchema = z.object({
    metamobPseudo: z.string().trim().max(PUBLIC_METAMOB_PSEUDO_MAX),
    /** Absent = inchangé ; chaîne vide = clé retirée ; sinon nouvelle clé (chiffrée par le hook). */
    apiKey: z.string().max(PUBLIC_METAMOB_KEY_MAX).optional(),
});

export const publicIdentitySchema = z.object({
    dofusServerId: publicServerIdSchema,
    pseudoDofus: publicPseudoSchema,
    classe: publicClasseSchema,
    declaredGuildName: declaredGuildNameSchema.nullable(),
});

export const createPublicProfileSchema = z.object({
    dofusServerId: publicServerIdSchema,
    pseudoDofus: publicPseudoSchema,
});

export const deletePublicProfileSchema = z.object({
    confirmation: z.literal(DELETE_CONFIRMATION_WORD, {
        message: `Écris « ${DELETE_CONFIRMATION_WORD} » pour confirmer.`,
    }),
});

/** Filtre une liste d'activités sur la liste blanche (utilisé aussi par la vue). */
export function sanitizePreferredActivities(raw: unknown): string[] {
    if (!Array.isArray(raw)) return [];
    const allowed = new Set<string>(ACTIVITY_IDS);
    return raw.filter((value): value is string => typeof value === "string" && allowed.has(value));
}

/** Vrai si le slug est un métier connu — l'action le vérifie avant toute écriture. */
export function isKnownJobId(value: string): boolean {
    return ALLOWED_JOB_IDS.has(value);
}
