/**
 * Espace visiteur (rang 57) — **progression de rush en base** (V1d), couche serveur.
 *
 * Quatre opérations, et un invariant qui les tient toutes : le `publicProfileId` vient de
 * `getPublicAccount()`, **jamais** du client. Aucune requête ne porte de `guildId`.
 *
 * · `save`   — upsert de l'emplacement (le navigateur reste la source, la base est le miroir) ;
 * · `adopt`  — recopie **une seule fois** la progression locale (`createMany skipDuplicates`) ;
 * · `reset`  — efface **un** emplacement, jamais tout le profil ;
 * · `load`   — dit seulement si l'emplacement existe (pas de lecture de progression en V1d :
 *              c'est V2a qui lit, quand le guide devient connecté).
 *
 * Le `guideId` est une **constante serveur** (`rush-sylvestre`) : il n'est jamais reçu du client.
 */

import type { ZodError } from "zod";
import { db } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { rateLimit } from "@/lib/ratelimit";
import { getPublicAccount } from "@/server/public-account";
import {
    PUBLIC_RUSH_GUIDE_ID,
    publicRushProgressSchema,
    publicRushResetSchema,
    publicRushSlotSchemaInput,
    toPublicRushColumns,
} from "@/lib/public-rush-progress";

export type RushActionResult = { success: true } | { success: false; error: string };

export type RushProgressState =
    | { success: true; exists: boolean; updatedAt: string | null }
    | { success: false; error: string };

const SESSION_EXPIRED = "Ta session a expiré. Reconnecte-toi pour continuer.";
const RATE_LIMITED = "Trop d'enregistrements d'affilée. Réessaie dans un instant.";
const WRITE_FAILED = "Impossible d'enregistrer ta progression pour l'instant.";

function firstIssue(error: ZodError): string {
    return error.issues[0]?.message ?? "Progression invalide.";
}

/** Rate limit commun : rend le refus, ou `null` quand la mutation peut continuer. */
async function limit(
    scope: string,
    userId: string,
    max: number,
    windowMs = 60_000
): Promise<{ success: false; error: string } | null> {
    const result = await rateLimit(`visitor:${scope}:${userId}`, max, windowMs);
    return result.success ? null : { success: false, error: RATE_LIMITED };
}

/** Clé unique d'un emplacement — écrite **une fois**, utilisée par les quatre opérations. */
function slotKey(publicProfileId: string, characterSlot: string) {
    return {
        publicProfileId_guideId_characterSlot: {
            publicProfileId,
            guideId: PUBLIC_RUSH_GUIDE_ID,
            characterSlot,
        },
    } as const;
}

/**
 * Enregistre un emplacement. `upsert` : la première coche crée la ligne, les suivantes la
 * mettent à jour — jamais de doublon (contrainte unique profil + guide + emplacement).
 */
export async function savePublicRushProgress(raw: unknown): Promise<RushActionResult> {
    const parsed = publicRushProgressSchema.safeParse(raw);
    if (!parsed.success) return { success: false, error: firstIssue(parsed.error) };

    const account = await getPublicAccount();
    if (!account) return { success: false, error: SESSION_EXPIRED };

    const limited = await limit("rush-save", account.userId, 60);
    if (limited) return limited;

    const { characterSlot, ...columns } = toPublicRushColumns(parsed.data);

    try {
        await db.publicRushProgress.upsert({
            where: slotKey(account.profile.id, characterSlot),
            create: { publicProfileId: account.profile.id, guideId: PUBLIC_RUSH_GUIDE_ID, ...columns },
            update: columns,
        });
        return { success: true };
    } catch (error) {
        logger.error("[Espace visiteur] Progression non enregistrée", { error });
        return { success: false, error: WRITE_FAILED };
    }
}

/**
 * Adoption de la progression locale, **une seule fois**.
 *
 * `createMany({ skipDuplicates: true })` rend l'opération **idempotente par construction** :
 * le deuxième appel ne crée rien (`count: 0`) et n'écrase jamais une progression déjà en base.
 * C'est ce qui permet au guide d'appeler l'adoption à chaque ouverture sans risque.
 */
export async function adoptPublicRushProgress(
    raw: unknown
): Promise<{ success: true; adopted: boolean } | { success: false; error: string }> {
    const parsed = publicRushProgressSchema.safeParse(raw);
    if (!parsed.success) return { success: false, error: firstIssue(parsed.error) };

    const account = await getPublicAccount();
    if (!account) return { success: false, error: SESSION_EXPIRED };

    const limited = await limit("rush-adopt", account.userId, 5);
    if (limited) return limited;

    const { characterSlot, ...columns } = toPublicRushColumns(parsed.data);

    try {
        const created = await db.publicRushProgress.createMany({
            data: [
                {
                    publicProfileId: account.profile.id,
                    guideId: PUBLIC_RUSH_GUIDE_ID,
                    characterSlot,
                    ...columns,
                },
            ],
            skipDuplicates: true,
        });
        return { success: true, adopted: created.count > 0 };
    } catch (error) {
        logger.error("[Espace visiteur] Adoption de progression impossible", { error });
        return { success: false, error: WRITE_FAILED };
    }
}

/** Efface **un** emplacement (pas le profil, pas les autres personnages). */
export async function resetPublicRushProgress(raw: unknown): Promise<RushActionResult> {
    const parsed = publicRushResetSchema.safeParse(raw);
    if (!parsed.success) return { success: false, error: firstIssue(parsed.error) };

    const account = await getPublicAccount();
    if (!account) return { success: false, error: SESSION_EXPIRED };

    const limited = await limit("rush-reset", account.userId, 5);
    if (limited) return limited;

    try {
        await db.publicRushProgress.deleteMany({
            where: {
                publicProfileId: account.profile.id,
                guideId: PUBLIC_RUSH_GUIDE_ID,
                characterSlot: parsed.data.characterSlot,
            },
        });
        return { success: true };
    } catch (error) {
        logger.error("[Espace visiteur] Réinitialisation de progression impossible", { error });
        return { success: false, error: WRITE_FAILED };
    }
}

/**
 * L'emplacement existe-t-il déjà en base ? C'est **la seule** question posée en V1d : le guide
 * s'en sert pour décider d'adopter (une fois) ou de simplement mirroter. Aucune progression
 * n'est renvoyée — la lecture appartient à V2a.
 */
export async function loadPublicRushProgress(raw: unknown): Promise<RushProgressState> {
    const parsed = publicRushSlotSchemaInput.safeParse(raw);
    if (!parsed.success) return { success: false, error: firstIssue(parsed.error) };

    const account = await getPublicAccount();
    if (!account) return { success: false, error: SESSION_EXPIRED };

    try {
        const row = await db.publicRushProgress.findUnique({
            where: slotKey(account.profile.id, parsed.data.characterSlot),
            select: { updatedAt: true },
        });
        return {
            success: true,
            exists: row !== null,
            updatedAt: row?.updatedAt.toISOString() ?? null,
        };
    } catch (error) {
        logger.error("[Espace visiteur] Lecture de progression impossible", { error });
        return { success: false, error: "Impossible de lire ta progression pour l'instant." };
    }
}
