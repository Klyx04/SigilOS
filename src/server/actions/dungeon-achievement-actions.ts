"use server";

/**
 * Succès de donjon — **coche « fait »** du membre (fiche boss interne).
 *
 * Besoin mesuré le 23/10/2026 : l'onglet « Succès » de la fiche boss réutilisait le composant
 * **public** (`PublicBossAchievementsTab`), donc en lecture seule, y compris pour les donjons à
 * **double boss** — impossible de marquer un succès comme fait.
 *
 * Persistance : `UserDungeonProgress` (table **canonique** de « Mes Succès », clé unique
 * `(profileId, achievementId, characterSlot)` — `profileId` = profil de guilde). L'ancienne
 * table `UserDungeonAchievement` est **legacy** : elle est backfillée une fois puis gelée
 * (voir `scripts/backfill-dungeon-achievements.ts`). **Aucune migration.**
 *
 * Gardes : `getUserContext(guildId)` (auth + guilde), `canViewSucces` en lecture,
 * `canEditOwnSucces` en écriture, appartenance du succès au donjon demandé (isolation de
 * la cible), `rateLimit` Redis, Zod borné, écriture idempotente.
 */

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { rateLimit } from "@/lib/ratelimit";
import {
    readSuccesCharacters,
    resolveSuccesCharacterSlotOrNull,
    SUCCES_SLOT_MAX,
    type SuccesCharacter,
} from "@/lib/succes-characters";
import { SUCCES_DUNGEONS_TAKE } from "@/lib/succes-level-brackets";
import {
    listableDungeonAchievements,
    type DungeonAchievementPanelData,
} from "@/lib/rush-dungeon-achievements";
import { loadDungeonAchievementCatalogue } from "@/server/dungeon-achievements";
import { getUserContext } from "./user-actions";

const ToggleSchema = z.object({
    guildId: z.string().min(1).max(32),
    dungeonId: z.string().min(1).max(64),
    achievementId: z.string().min(1).max(64),
    /** `"PRINCIPAL"` ou le pseudo d'une mule déclarée (coche par personnage). */
    characterSlot: z.string().max(SUCCES_SLOT_MAX).optional(),
});

const ReadSchema = z.object({
    guildId: z.string().min(1).max(32),
    dungeonId: z.string().min(1).max(64),
    characterSlot: z.string().max(SUCCES_SLOT_MAX).optional(),
});

type ToggleResponse = { success: boolean; error?: string; done?: boolean };

/** Personnages du profil interne (principal + mules) — une seule lecture. */
async function readProfileCharacters(profileId: string): Promise<SuccesCharacter[]> {
    const profile = await db.userProfile.findUnique({
        where: { id: profileId },
        select: { pseudoDofus: true, classe: true, altPseudos: true },
    });
    return readSuccesCharacters(profile ?? {});
}

/** Slot demandé, validé contre les personnages déclarés (fail-closed). */
async function resolveCharacterSlot(
    profileId: string,
    raw: string | undefined
): Promise<string | null> {
    return resolveSuccesCharacterSlotOrNull(raw, await readProfileCharacters(profileId));
}

/** Bascule « fait » / « à faire » d'un succès de donjon pour le profil courant. */
export async function toggleDungeonAchievement(raw: unknown): Promise<ToggleResponse> {
    const parsed = ToggleSchema.safeParse(raw);
    if (!parsed.success) return { success: false, error: "Données invalides" };
    const { guildId, dungeonId, achievementId } = parsed.data;

    const ctx = await getUserContext(guildId);
    if (!ctx.isAuthenticated || !ctx.profileId) return { success: false, error: "Non autorisé" };
    if (!ctx.canEditOwnSucces) return { success: false, error: "Accès refusé" };

    const characterSlot = await resolveCharacterSlot(ctx.profileId, parsed.data.characterSlot);
    if (!characterSlot) return { success: false, error: "Personnage inconnu." };

    const limited = await rateLimit(`dungeon-achievement:${ctx.profileId}`, 60, 60_000);
    if (!limited.success) return { success: false, error: "Trop d'actions — réessaie dans une minute." };

    try {
        // La cible doit appartenir au donjon demandé (jamais un id fourni tel quel).
        const achievement = await db.dungeonAchievement.findFirst({
            where: { id: achievementId, dungeonId },
            select: { id: true },
        });
        if (!achievement) return { success: false, error: "Succès introuvable pour ce donjon" };

        const existing = await db.userDungeonProgress.findUnique({
            where: {
                profileId_achievementId_characterSlot: {
                    profileId: ctx.profileId,
                    achievementId: achievement.id,
                    characterSlot,
                },
            },
            select: { id: true },
        });

        if (existing) {
            await db.userDungeonProgress.delete({ where: { id: existing.id } });
            return { success: true, done: false };
        }

        try {
            await db.userDungeonProgress.create({
                data: {
                    profileId: ctx.profileId,
                    dungeonId,
                    achievementId: achievement.id,
                    characterSlot,
                    source: "MANUAL",
                },
            });
        } catch (err) {
            // Course : deux clics rapprochés → la contrainte unique tranche, l'état reste « fait ».
            if (typeof err === "object" && err !== null && (err as { code?: string }).code === "P2002") {
                return { success: true, done: true };
            }
            throw err;
        }
        return { success: true, done: true };
    } catch (error) {
        logger.error("[toggleDungeonAchievement] Erreur", { error });
        return { success: false, error: "Impossible d'enregistrer la coche" };
    }
}

/** Succès déjà marqués « fait » par le profil courant pour un donjon. */
export async function getDungeonAchievementStates(
    rawGuildId: string,
    rawDungeonId: string,
    rawCharacterSlot?: string,
): Promise<{ success: boolean; error?: string; doneIds?: string[] }> {
    const parsed = ReadSchema.safeParse({
        guildId: rawGuildId,
        dungeonId: rawDungeonId,
        characterSlot: rawCharacterSlot,
    });
    if (!parsed.success) return { success: false, error: "Données invalides" };
    const { guildId, dungeonId } = parsed.data;

    const ctx = await getUserContext(guildId);
    if (!ctx.isAuthenticated || !ctx.profileId) return { success: false, error: "Non autorisé" };
    if (!ctx.canViewSucces) return { success: false, error: "Accès refusé" };

    const characterSlot = await resolveCharacterSlot(ctx.profileId, parsed.data.characterSlot);
    if (!characterSlot) return { success: false, error: "Personnage inconnu." };

    try {
        const rows = await db.userDungeonProgress.findMany({
            where: {
                profileId: ctx.profileId,
                characterSlot,
                achievement: { dungeonId },
            },
            select: { achievementId: true },
            take: 500,
        });
        return { success: true, doneIds: rows.map((r) => r.achievementId) };
    } catch (error) {
        logger.error("[getDungeonAchievementStates] Erreur", { error });
        return { success: false, error: "Impossible de lire les coches" };
    }
}

const PanelSchema = z.object({
    guildId: z.string().min(1).max(32),
    /** La quête de l'étape : le donjon doit y être **requis** (pas optionnel). */
    sequenceId: z.string().min(1).max(64),
    dungeonId: z.string().min(1).max(64),
    characterSlot: z.string().max(SUCCES_SLOT_MAX).optional(),
});

/**
 * Panneau des succès d'un donjon — **un** aller-retour pour le guide navigateur.
 *
 * Vérifie la cible côté serveur : la séquence existe, le donjon fait partie de ses
 * `dungeonIds` et n'est **pas** optionnel. Le catalogue est public ; les coches sont
 * celles du profil courant, par personnage.
 */
export async function getRushDungeonAchievementPanel(
    raw: unknown
): Promise<{ success: boolean; error?: string; data?: DungeonAchievementPanelData }> {
    const parsed = PanelSchema.safeParse(raw);
    if (!parsed.success) return { success: false, error: "Données invalides" };
    const { guildId, sequenceId, dungeonId } = parsed.data;

    const ctx = await getUserContext(guildId);
    if (!ctx.isAuthenticated || !ctx.profileId) return { success: false, error: "Non autorisé" };
    if (!ctx.canViewSucces) return { success: false, error: "Module Succès non activé" };

    try {
        const characters = await readProfileCharacters(ctx.profileId);
        const characterSlot = resolveSuccesCharacterSlotOrNull(
            parsed.data.characterSlot,
            characters
        );
        if (!characterSlot) return { success: false, error: "Personnage inconnu." };

        const sequence = await db.guideSequence.findUnique({
            where: { id: sequenceId },
            select: { id: true, dungeonIds: true, dungeonOptionalIds: true },
        });
        if (!sequence) return { success: false, error: "Quête introuvable" };
        if (!sequence.dungeonIds.includes(dungeonId)) {
            return { success: false, error: "Donjon absent de cette quête" };
        }
        if (sequence.dungeonOptionalIds.includes(dungeonId)) {
            return { success: false, error: "Donjon optionnel" };
        }

        const dungeon = await db.dungeon.findUnique({
            where: { id: dungeonId },
            select: {
                id: true,
                name: true,
                bossName: true,
                slug: true,
                imageUrl: true,
                level: true,
                isNoAchievement: true,
            },
        });
        if (!dungeon) return { success: false, error: "Donjon introuvable" };

        const [catalogue, doneRows] = await Promise.all([
            loadDungeonAchievementCatalogue(dungeon.id),
            db.userDungeonProgress.findMany({
                where: {
                    profileId: ctx.profileId,
                    characterSlot,
                    achievement: { dungeonId: dungeon.id },
                },
                select: { achievementId: true },
                take: 100,
            }),
        ]);

        const character = characters.find((row) => row.slot === characterSlot);
        return {
            success: true,
            data: {
                dungeon,
                achievements: listableDungeonAchievements(catalogue),
                doneIds: doneRows.map((row) => row.achievementId),
                slot: characterSlot,
                characterName: character?.name ?? characterSlot,
                characters: characters.map((row) => ({
                    slot: row.slot,
                    name: row.name,
                    isMain: row.isMain,
                })),
                canEdit: ctx.canEditOwnSucces,
            },
        };
    } catch (error) {
        logger.error("[getRushDungeonAchievementPanel] Erreur", { error });
        return { success: false, error: "Impossible de charger les succès du donjon" };
    }
}

/** Personnages sélectionnables pour les coches : principal + mules déclarées. */
export async function getMySuccesCharacters(
    rawGuildId: string
): Promise<{ success: boolean; error?: string; characters?: SuccesCharacter[] }> {
    const parsed = z.string().min(1).max(32).safeParse(rawGuildId);
    if (!parsed.success) return { success: false, error: "Données invalides" };

    const ctx = await getUserContext(parsed.data);
    if (!ctx.isAuthenticated || !ctx.profileId) return { success: false, error: "Non autorisé" };

    return { success: true, characters: await readProfileCharacters(ctx.profileId) };
}

const BountyReadSchema = z.object({
    guildId: z.string().min(1).max(32),
    characterSlot: z.string().max(SUCCES_SLOT_MAX).optional(),
});

const BountyToggleSchema = z.object({
    guildId: z.string().min(1).max(32),
    bountyId: z.string().min(1).max(64),
    characterSlot: z.string().max(SUCCES_SLOT_MAX).optional(),
});

/** Avis déjà cochés par le membre pour le personnage sélectionné. */
export async function getUserBountyCompletions(
    rawGuildId: string,
    rawCharacterSlot?: string
): Promise<{ success: boolean; error?: string; bountyIds?: string[] }> {
    const parsed = BountyReadSchema.safeParse({
        guildId: rawGuildId,
        characterSlot: rawCharacterSlot,
    });
    if (!parsed.success) return { success: false, error: "Données invalides" };

    const ctx = await getUserContext(parsed.data.guildId);
    if (!ctx.isAuthenticated || !ctx.profileId) return { success: false, error: "Non autorisé" };
    if (!ctx.canViewSucces) return { success: false, error: "Accès refusé" };

    const characterSlot = await resolveCharacterSlot(ctx.profileId, parsed.data.characterSlot);
    if (!characterSlot) return { success: false, error: "Personnage inconnu." };

    try {
        const rows = await db.userBountyCompletion.findMany({
            where: { userId: ctx.profileId, characterSlot },
            select: { bountyId: true },
            take: 2000,
        });
        return { success: true, bountyIds: rows.map((row) => row.bountyId) };
    } catch (error) {
        logger.error("[getUserBountyCompletions] Erreur", { error });
        return { success: false, error: "Impossible de lire les avis." };
    }
}

/** Coche / décoche un avis de recherche pour le personnage sélectionné. */
export async function toggleUserBounty(raw: unknown): Promise<ToggleResponse> {
    const parsed = BountyToggleSchema.safeParse(raw);
    if (!parsed.success) return { success: false, error: "Données invalides" };
    const { guildId, bountyId } = parsed.data;

    const ctx = await getUserContext(guildId);
    if (!ctx.isAuthenticated || !ctx.profileId) return { success: false, error: "Non autorisé" };
    if (!ctx.canEditOwnSucces) return { success: false, error: "Accès refusé" };

    const characterSlot = await resolveCharacterSlot(ctx.profileId, parsed.data.characterSlot);
    if (!characterSlot) return { success: false, error: "Personnage inconnu." };

    const limited = await rateLimit(`user-bounty:${ctx.profileId}`, 60, 60_000);
    if (!limited.success) return { success: false, error: "Trop d'actions — réessaie dans une minute." };

    try {
        const bounty = await db.bounty.findFirst({
            where: { id: bountyId, isBountyMonster: true },
            select: { id: true },
        });
        if (!bounty) return { success: false, error: "Cet avis de recherche n'existe pas." };

        const existing = await db.userBountyCompletion.findUnique({
            where: {
                userId_bountyId_characterSlot: {
                    userId: ctx.profileId,
                    bountyId: bounty.id,
                    characterSlot,
                },
            },
            select: { id: true },
        });

        if (existing) {
            await db.userBountyCompletion.delete({ where: { id: existing.id } });
            revalidatePath(`/dashboard/${guildId}/succes`);
            return { success: true, done: false };
        }

        try {
            await db.userBountyCompletion.create({
                data: { userId: ctx.profileId, bountyId: bounty.id, characterSlot },
            });
        } catch (err) {
            if (typeof err === "object" && err !== null && (err as { code?: string }).code === "P2002") {
                return { success: true, done: true };
            }
            throw err;
        }
        revalidatePath(`/dashboard/${guildId}/succes`);
        return { success: true, done: true };
    } catch (error) {
        logger.error("[toggleUserBounty] Erreur", { error });
        return { success: false, error: "Impossible d'enregistrer cet avis." };
    }
}


export type GuildBountyDirectoryMember = {
    id: string;
    name: string;
    imageUrl: string | null;
    classe: string | null;
};

export type GuildBountyDirectoryEntry = {
    bountyId: string;
    name: string;
    level: number;
    zoneName: string | null;
    slug: string | null;
    imageUrl: string | null;
    hasCompleted: GuildBountyDirectoryMember[];
    missing: GuildBountyDirectoryMember[];
};

/**
 * Filtre commun interne des avis de recherche : pour chaque avis, qui l'a fait et qui le
 * cherche encore parmi les membres **ACTIFs** de la guilde. Même périmètre que
 * `getDungeonDirectory` (canViewGuildSucces, guilde résolue par `discordGuildId`), et une
 * coche portée par plusieurs personnages du même profil ne crée qu'une entrée.
 */
export async function getGuildBountyDirectory(
    rawGuildId: string
): Promise<{ success: boolean; error?: string; data?: GuildBountyDirectoryEntry[] }> {
    const parsed = z.string().min(1).max(32).safeParse(rawGuildId);
    if (!parsed.success) return { success: false, error: "Données invalides" };

    const user = await getUserContext(parsed.data);
    if (!user.canViewGuildSucces) return { success: false, error: "Accès refusé" };

    try {
        const guildConfig = await db.guildConfig.findUnique({
            where: { discordGuildId: parsed.data },
            select: { id: true },
        });
        if (!guildConfig) return { success: false, error: "Guilde introuvable" };

        const [bounties, activeMembers] = await Promise.all([
            db.bounty.findMany({
                where: { isBountyMonster: true },
                select: {
                    id: true,
                    name: true,
                    level: true,
                    zoneName: true,
                    slug: true,
                    imageUrl: true,
                },
                orderBy: [{ level: "asc" }, { name: "asc" }],
                take: SUCCES_DUNGEONS_TAKE,
            }),
            db.userProfile.findMany({
                where: { guildId: guildConfig.id, status: "ACTIVE" },
                select: {
                    id: true,
                    discordNickname: true,
                    pseudoDofus: true,
                    classe: true,
                    user: { select: { image: true } },
                },
            }),
        ]);

        if (bounties.length === 0) return { success: true, data: [] };

        const completions = await db.userBountyCompletion.findMany({
            where: {
                bountyId: { in: bounties.map((bounty) => bounty.id) },
                user: { guildId: guildConfig.id, status: "ACTIVE" },
            },
            select: { bountyId: true, userId: true },
            // Borne de sécurité haute : 96 avis × une guilde de 200 membres actifs = 19 200
            // lignes. Un plafond plus bas afficherait de faux « cherchent encore ».
            take: 20_000,
        });

        const byBounty = new Map<string, Set<string>>();
        for (const row of completions) {
            const set = byBounty.get(row.bountyId) ?? new Set<string>();
            set.add(row.userId);
            byBounty.set(row.bountyId, set);
        }

        const data = bounties.map((bounty) => {
            const doneIds = byBounty.get(bounty.id) ?? new Set<string>();
            const hasCompleted: GuildBountyDirectoryMember[] = [];
            const missing: GuildBountyDirectoryMember[] = [];

            for (const member of activeMembers) {
                const row: GuildBountyDirectoryMember = {
                    id: member.id,
                    name: member.pseudoDofus || member.discordNickname || "Inconnu",
                    imageUrl: member.user.image,
                    classe: member.classe,
                };
                if (doneIds.has(member.id)) hasCompleted.push(row);
                else missing.push(row);
            }

            const byName = (a: GuildBountyDirectoryMember, b: GuildBountyDirectoryMember) =>
                a.name.localeCompare(b.name, "fr", { sensitivity: "base" });
            hasCompleted.sort(byName);
            missing.sort(byName);

            return {
                bountyId: bounty.id,
                name: bounty.name,
                level: bounty.level,
                zoneName: bounty.zoneName,
                slug: bounty.slug,
                imageUrl: bounty.imageUrl,
                hasCompleted,
                missing,
            };
        });

        return { success: true, data };
    } catch (error) {
        logger.error("[getGuildBountyDirectory] Erreur", { error });
        return { success: false, error: "Impossible de lire les avis de la guilde." };
    }
}

