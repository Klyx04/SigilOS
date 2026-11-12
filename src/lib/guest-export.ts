/**
 * Guide public — **export / import de la progression locale** (chantier 4, F2).
 *
 * Sans compte, tout vit dans le navigateur : un nettoyage de cookies, un autre appareil ou
 * une navigation privée perdent progression, cité et alignement. Ce module décrit un
 * **fichier JSON** que le visiteur garde lui-même — jamais une synchronisation serveur
 * implicite, jamais un secret.
 *
 * Ce que le fichier contient : les cinq clés de progression (blocs, étapes, repères, donjons,
 * ressources), le personnage déclaré et la route d'alignement locale. **Rien d'autre** : ni
 * clé Metamob (elle n'existe pas pour un anonyme), ni `userId`, ni serveur SigilOS.
 *
 * Ce que l'import refuse, plutôt que de le réparer en silence : un format inconnu, une
 * version inconnue, un guide qui n'est pas le Rush, des listes au-delà des bornes, un état de
 * donjon inconnu, un serveur absurde. Un fichier douteux n'écrit **rien**.
 *
 * Les entrées/sorties `localStorage` sont gardées (`typeof localStorage`) pour rester
 * inoffensives au SSR, comme `guest-progress.ts`.
 */

import { z } from "zod";
import {
    guestCharacterStorageKey,
    guestProgressPrefix,
    guestRouteOrderStorageKey,
    guestRouteStorageKey,
    hasGuestCharacter,
    type GuestCharacter,
} from "@/lib/guest-progress";

export const GUEST_EXPORT_FORMAT = "sigilos.rush.guest";
export const GUEST_EXPORT_VERSION = 1;
export const GUEST_EXPORT_GUIDE = "rush-sylvestre";

/** Un fichier de sauvegarde reste petit ; au-delà, on refuse avant de lire. */
export const GUEST_EXPORT_MAX_BYTES = 2 * 1024 * 1024;

const MAX_MILESTONES = 300;
const MAX_STEPS_PER_MILESTONE = 500;
const MAX_DUNGEON_CHECKS = 2_000;
const MAX_RESOURCE_CHECKS = 2_000;
const MAX_KEY = 200;
const MAX_ROUTE_ORDER = 60;

const keySchema = z.string().min(1).max(MAX_KEY);

const characterSchema = z.object({
    classId: z.string().min(1).max(40).nullable(),
    pseudo: z.string().max(24).nullable(),
    serverId: z.number().int().min(1).max(9_999).nullable(),
});

export const guestExportSchema = z.object({
    format: z.literal(GUEST_EXPORT_FORMAT),
    version: z.literal(GUEST_EXPORT_VERSION),
    guide: z.literal(GUEST_EXPORT_GUIDE),
    /** Horodatage lisible ; jamais utilisé pour décider quoi que ce soit. */
    exportedAt: z.string().max(40).optional(),
    character: characterSchema.nullable(),
    route: z.object({
        camp: z.enum(["bontarien", "brakmarien"]).nullable(),
        order: z.string().max(MAX_ROUTE_ORDER).nullable(),
    }),
    progress: z.object({
        completedMilestones: z.array(keySchema).max(MAX_MILESTONES),
        completedSteps: z
            .record(keySchema, z.array(keySchema).max(MAX_STEPS_PER_MILESTONE))
            .refine(
                (value) => Object.keys(value).length <= MAX_MILESTONES,
                "Trop de blocs dans la sauvegarde."
            ),
        bookmarks: z
            .record(keySchema, keySchema)
            .refine(
                (value) => Object.keys(value).length <= MAX_MILESTONES,
                "Trop de repères dans la sauvegarde."
            ),
        dungeonChecks: z
            .record(keySchema, z.enum(["done", "todo"]))
            .refine(
                (value) => Object.keys(value).length <= MAX_DUNGEON_CHECKS,
                "Trop de donjons dans la sauvegarde."
            ),
        resourceChecks: z.array(keySchema).max(MAX_RESOURCE_CHECKS),
    }),
});

export type GuestExport = z.infer<typeof guestExportSchema>;

/**
 * Fichier reçu → sauvegarde typée, ou `null`. Un fichier douteux n'écrit **rien** : c'est
 * l'appelant qui décide de le dire à l'écran, jamais de le « réparer » en silence.
 */
export function parseGuestExport(raw: unknown): GuestExport | null {
    const parsed = guestExportSchema.safeParse(raw);
    return parsed.success ? parsed.data : null;
}

/**
 * Lit l'état local **complet** d'un personnage. Retourne `null` si une seule clé est
 * illisible ou hors bornes : un export partiel serait une fausse sauvegarde.
 */
export function collectGuestExport(slug: string, character: GuestCharacter | null): GuestExport | null {
    if (typeof localStorage === "undefined" || slug !== GUEST_EXPORT_GUIDE) return null;
    try {
        const prefix = guestProgressPrefix(slug, character);
        const read = (suffix: string) => localStorage.getItem(`${prefix}${suffix}`);
        const storedCamp = localStorage.getItem(guestRouteStorageKey(slug));

        const candidate = {
            format: GUEST_EXPORT_FORMAT,
            version: GUEST_EXPORT_VERSION,
            guide: GUEST_EXPORT_GUIDE,
            exportedAt: new Date().toISOString(),
            character: hasGuestCharacter(character)
                ? {
                      classId: character.classId ?? null,
                      pseudo: character.pseudo ?? null,
                      serverId: character.serverId ?? null,
                  }
                : null,
            route: {
                camp: storedCamp === "bontarien" || storedCamp === "brakmarien" ? storedCamp : null,
                order: localStorage.getItem(guestRouteOrderStorageKey(slug)),
            },
            progress: {
                completedMilestones: JSON.parse(read("completed_ms") ?? "[]"),
                completedSteps: JSON.parse(read("steps") ?? "{}"),
                bookmarks: JSON.parse(read("bookmarks") ?? "{}"),
                dungeonChecks: JSON.parse(read("dungeons") ?? "{}"),
                resourceChecks: JSON.parse(read("resources") ?? "[]"),
            },
        };

        return parseGuestExport(candidate);
    } catch {
        return null;
    }
}

/**
 * Écrit une sauvegarde **sur l'emplacement de son personnage** (celui du fichier), puis la
 * route locale. Import = **remplacement** de cet emplacement, jamais une fusion silencieuse :
 * deux progressions mélangées seraient indiscernables d'une progression réelle.
 */
export function applyGuestExport(slug: string, data: GuestExport): boolean {
    if (typeof localStorage === "undefined" || slug !== data.guide) return false;

    // Ceinture et bretelles : ce qui vient d'un fichier repasse par le schéma avant écriture.
    const parsed = guestExportSchema.safeParse(data);
    if (!parsed.success) return false;
    const value = parsed.data;

    try {
        if (value.character) {
            localStorage.setItem(guestCharacterStorageKey(slug), JSON.stringify(value.character));
        } else {
            localStorage.removeItem(guestCharacterStorageKey(slug));
        }

        // Le personnage d'abord : le préfixe de progression en dépend.
        const prefix = guestProgressPrefix(slug, value.character);
        localStorage.setItem(`${prefix}completed_ms`, JSON.stringify(value.progress.completedMilestones));
        localStorage.setItem(`${prefix}steps`, JSON.stringify(value.progress.completedSteps));
        localStorage.setItem(`${prefix}bookmarks`, JSON.stringify(value.progress.bookmarks));
        localStorage.setItem(`${prefix}dungeons`, JSON.stringify(value.progress.dungeonChecks));
        localStorage.setItem(`${prefix}resources`, JSON.stringify(value.progress.resourceChecks));

        if (value.route.camp) localStorage.setItem(guestRouteStorageKey(slug), value.route.camp);
        else localStorage.removeItem(guestRouteStorageKey(slug));
        if (value.route.order) localStorage.setItem(guestRouteOrderStorageKey(slug), value.route.order);
        else localStorage.removeItem(guestRouteOrderStorageKey(slug));

        return true;
    } catch {
        return false;
    }
}

