"use server";

// =============================================================================
// METAMOB SERVER ACTIONS - Archimonstre Module
// =============================================================================

import { auth } from "@/auth";
import { db } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { PERMISSIONS } from "@/lib/permissions";
import { checkGuildPermission } from "@/server/actions/mission-actions";
import {
    verifyMetamobUser,
    getUserMonsters,
    getQuestDetails,
    getPrivateQuestDetails,
    findMonsterOwners,
    clearMonsterCache,
    type MetamobMonster,
    type MonsterOwner,
} from "@/lib/metamob-client";

// -----------------------------------------------------------------------------
// TYPES
// -----------------------------------------------------------------------------

interface ActionResponse<T = void> {
    success: boolean;
    error?: string;
    data?: T;
}

// -----------------------------------------------------------------------------
// SCHEMAS
// -----------------------------------------------------------------------------

const LinkAccountSchema = z.object({
    guildId: z.string().min(1),
    pseudo: z.string()
        .min(2, "Le pseudo doit contenir au moins 2 caractères")
        .max(30, "Le pseudo ne peut pas dépasser 30 caractères")
        .regex(/^[a-zA-Z0-9_-]+$/, "Le pseudo ne peut contenir que des lettres, chiffres, tirets et underscores"),
});

const UnlinkAccountSchema = z.object({
    guildId: z.string().min(1),
});

const GetMonstersSchema = z.object({
    guildId: z.string().min(1),
});

const FindPartnersSchema = z.object({
    guildId: z.string().min(1),
    monsterId: z.number().int().positive(),
});

// -----------------------------------------------------------------------------
// LINK / UNLINK METAMOB ACCOUNT
// -----------------------------------------------------------------------------

/**
 * Link a Metamob account to the user's profile.
 * Validates the pseudo exists and is publicly accessible via the Metamob API.
 */
export async function linkMetamobAccount(
    rawData: z.infer<typeof LinkAccountSchema>
): Promise<ActionResponse<{ pseudo: string; serveur: string | null }>> {
    try {
        // Auth check
        const session = await auth();
        if (!session?.user?.id) {
            return { success: false, error: "Non authentifié" };
        }

        // Validation
        const parsed = LinkAccountSchema.safeParse(rawData);
        if (!parsed.success) {
            return { success: false, error: parsed.error.errors[0]?.message || "Données invalides" };
        }
        const { guildId, pseudo } = parsed.data;

        // Get user profile (multi-tenant check)
        const profile = await db.userProfile.findFirst({
            where: {
                userId: session.user.id,
                guild: { discordGuildId: guildId },
                status: "ACTIVE",
            },
        });

        if (!profile) {
            return { success: false, error: "Profil introuvable" };
        }

        // Verify Metamob account exists and is public
        const metamobUser = await verifyMetamobUser(pseudo);
        if (!metamobUser) {
            return {
                success: false,
                error: "Compte Metamob introuvable ou profil privé. Assurez-vous que votre profil est public sur metamob.fr"
            };
        }

        // Update profile with Metamob link
        await db.userProfile.update({
            where: { id: profile.id },
            data: {
                metamobPseudo: metamobUser.pseudo, // Use the exact casing from Metamob
                metamobVerified: true,
                metamobLastSync: new Date(),
            },
        });

        revalidatePath(`/dashboard/${guildId}/profile`);
        revalidatePath(`/dashboard/${guildId}/archimonstres`);

        return {
            success: true,
            data: {
                pseudo: metamobUser.pseudo,
                serveur: metamobUser.serveur
            }
        };
    } catch (error) {
        console.error("[linkMetamobAccount] Error:", error);

        if (error instanceof Error) {
            if (error.message === "RATE_LIMIT") {
                return { success: false, error: "Trop de requêtes. Réessayez dans quelques minutes." };
            }
            if (error.message === "API_KEY_MISSING") {
                return { success: false, error: "Configuration Metamob manquante. Contactez un administrateur." };
            }
            if (error.message === "API_KEY_INVALID") {
                return { success: false, error: "Clé API Metamob invalide. Contactez un administrateur." };
            }
        }

        return { success: false, error: "Erreur lors de la liaison du compte" };
    }
}

/**
 * Unlink Metamob account from user's profile.
 */
export async function unlinkMetamobAccount(
    rawData: z.infer<typeof UnlinkAccountSchema>
): Promise<ActionResponse> {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return { success: false, error: "Non authentifié" };
        }

        const parsed = UnlinkAccountSchema.safeParse(rawData);
        if (!parsed.success) {
            return { success: false, error: "Données invalides" };
        }
        const { guildId } = parsed.data;

        const profile = await db.userProfile.findFirst({
            where: {
                userId: session.user.id,
                guild: { discordGuildId: guildId },
                status: "ACTIVE",
            },
        });

        if (!profile) {
            return { success: false, error: "Profil introuvable" };
        }

        // Clear cache for this user
        if (profile.metamobPseudo) {
            clearMonsterCache(profile.metamobPseudo);
        }

        // Remove Metamob link
        await db.userProfile.update({
            where: { id: profile.id },
            data: {
                metamobPseudo: null,
                metamobVerified: false,
                metamobLastSync: null,
            },
        });

        revalidatePath(`/dashboard/${guildId}/profile`);
        revalidatePath(`/dashboard/${guildId}/archimonstres`);

        return { success: true };
    } catch (error) {
        console.error("[unlinkMetamobAccount] Error:", error);
        return { success: false, error: "Erreur lors de la suppression du lien" };
    }
}

// -----------------------------------------------------------------------------
// FETCH MONSTERS
// -----------------------------------------------------------------------------

export interface MyArchimonstresData {
    monsters: MetamobMonster[];
    stats: {
        total: number;
        manquants: number;
        possedes: number;
        doublons: number;
    };
    lastSync: Date | null;
}

/**
 * Get the current user's archimonster collection.
 */
export async function getMyArchimonsters(
    guildId: string
): Promise<ActionResponse<MyArchimonstresData>> {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return { success: false, error: "Non authentifié" };
        }

        // Permission check
        const guard = await checkGuildPermission(session, guildId, PERMISSIONS.ARCHIS_VIEW);
        if (!guard.allowed) {
            return { success: false, error: "Accès au module Archimonstres non autorisé" };
        }

        const profile = await db.userProfile.findFirst({
            where: {
                userId: session.user.id,
                guild: { discordGuildId: guildId },
                status: "ACTIVE",
            },
            select: {
                metamobPseudo: true,
                metamobVerified: true,
                metamobLastSync: true,
            },
        });

        if (!profile) {
            return { success: false, error: "Profil introuvable" };
        }

        if (!profile.metamobPseudo || !profile.metamobVerified) {
            return {
                success: false,
                error: "Aucun compte Metamob lié. Liez votre compte dans votre profil."
            };
        }

        const monsters = await getUserMonsters(profile.metamobPseudo);

        // Calculate stats
        const stats = {
            total: monsters.length,
            manquants: monsters.filter(m => m.etat === "MANQUANT").length,
            possedes: monsters.filter(m => m.etat === "POSSEDE").length,
            doublons: monsters.filter(m => m.etat === "DOUBLON").length,
        };

        // Update last sync time
        await db.userProfile.update({
            where: {
                userId_guildId: {
                    userId: session.user.id,
                    guildId: profile.metamobPseudo ? guildId : ""
                }
            },
            data: { metamobLastSync: new Date() },
        }).catch(() => {
            // Non-blocking update
        });

        return {
            success: true,
            data: {
                monsters,
                stats,
                lastSync: profile.metamobLastSync,
            },
        };
    } catch (error) {
        console.error("[getMyArchimonsters] Error:", error);

        if (error instanceof Error) {
            if (error.message === "RATE_LIMIT") {
                return { success: false, error: "Trop de requêtes vers Metamob. Réessayez plus tard." };
            }
            if (error.message === "API_KEY_MISSING") {
                return { success: false, error: "Module Metamob non configuré. Contactez un administrateur." };
            }
            if (error.message === "API_KEY_INVALID") {
                return { success: false, error: "Clé API Metamob expirée ou invalide. Contactez un administrateur." };
            }
        }

        return { success: false, error: "Erreur lors de la récupération des données" };
    }
}

// -----------------------------------------------------------------------------
// GUILD DOUBLONS MAP - Pre-compute exchange availability (lightweight)
// -----------------------------------------------------------------------------

export interface DoublonsMapData {
    /** Map of monsterId -> number of guild members who have this as doublon */
    availableExchanges: Record<number, number>;
    /** Total unique monsters available for exchange in the guild */
    totalMonstersAvailable: number;
}

/**
 * Get a map of all monsters available for exchange in the guild.
 * This is a lightweight call that returns aggregated data for fast display.
 * Excludes the current user's own doublons.
 */
export async function getGuildDoublonsMap(
    guildId: string
): Promise<ActionResponse<DoublonsMapData>> {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return { success: false, error: "Non authentifié" };
        }

        // Permission check
        const guard = await checkGuildPermission(session, guildId, PERMISSIONS.ARCHIS_VIEW);
        if (!guard.allowed) {
            return { success: true, data: { availableExchanges: {}, totalMonstersAvailable: 0 } };
        }

        // Get current user's metamob pseudo to exclude their own data
        const currentProfile = await db.userProfile.findFirst({
            where: {
                userId: session.user.id,
                guild: { discordGuildId: guildId },
                status: "ACTIVE",
            },
            select: { metamobPseudo: true },
        });

        // Get all OTHER guild members with linked Metamob accounts
        const members = await db.userProfile.findMany({
            where: {
                guild: { discordGuildId: guildId },
                status: "ACTIVE",
                metamobVerified: true,
                metamobPseudo: { not: null },
                userId: { not: session.user.id }, // Exclude self
            },
            select: {
                metamobPseudo: true,
            },
        });

        // Build map: monsterId -> count of members who have it as doublon
        const availableExchanges: Record<number, number> = {};

        for (const member of members) {
            if (!member.metamobPseudo) continue;

            try {
                const monsters = await getUserMonsters(member.metamobPseudo);
                const doublons = monsters.filter(m => m.etat === "DOUBLON");

                for (const doublon of doublons) {
                    availableExchanges[doublon.id] = (availableExchanges[doublon.id] || 0) + 1;
                }
            } catch {
                // Skip members with API errors
                continue;
            }
        }

        return {
            success: true,
            data: {
                availableExchanges,
                totalMonstersAvailable: Object.keys(availableExchanges).length,
            },
        };
    } catch (error) {
        console.error("[getGuildDoublonsMap] Error:", error);

        if (error instanceof Error) {
            if (error.message === "API_KEY_MISSING" || error.message === "API_KEY_INVALID") {
                return { success: true, data: { availableExchanges: {}, totalMonstersAvailable: 0 } };
            }
        }

        return { success: false, error: "Erreur lors du chargement" };
    }
}

// -----------------------------------------------------------------------------
// GUILD AGGREGATION
// -----------------------------------------------------------------------------

export interface GuildMemberArchi {
    profileId: string;
    displayName: string;
    metamobPseudo: string;
    stats: {
        doublons: number;
        manquants: number;
    };
}

export interface GuildArchiData {
    members: GuildMemberArchi[];
    totalLinkedMembers: number;
}

/**
 * Get aggregated archimonster data for all linked guild members.
 */
export async function getGuildArchimonsters(
    guildId: string
): Promise<ActionResponse<GuildArchiData>> {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return { success: false, error: "Non authentifié" };
        }

        // Get all guild members with linked Metamob accounts
        const members = await db.userProfile.findMany({
            where: {
                guild: { discordGuildId: guildId },
                status: "ACTIVE",
                metamobVerified: true,
                metamobPseudo: { not: null },
            },
            select: {
                id: true,
                pseudoDofus: true,
                discordNickname: true,
                metamobPseudo: true,
                user: { select: { name: true } },
            },
        });

        const membersWithStats: GuildMemberArchi[] = [];

        for (const member of members) {
            if (!member.metamobPseudo) continue;

            try {
                const monsters = await getUserMonsters(member.metamobPseudo);
                membersWithStats.push({
                    profileId: member.id,
                    displayName: member.discordNickname || member.pseudoDofus || member.user.name || "Anonyme",
                    metamobPseudo: member.metamobPseudo,
                    stats: {
                        doublons: monsters.filter(m => m.etat === "DOUBLON").length,
                        manquants: monsters.filter(m => m.etat === "MANQUANT").length,
                    },
                });
            } catch {
                // Skip members with API errors
                continue;
            }
        }

        return {
            success: true,
            data: {
                members: membersWithStats,
                totalLinkedMembers: membersWithStats.length,
            },
        };
    } catch (error) {
        console.error("[getGuildArchimonsters] Error:", error);
        return { success: false, error: "Erreur lors de la récupération des données" };
    }
}

// -----------------------------------------------------------------------------
// MATCHMAKER
// -----------------------------------------------------------------------------

/**
 * Find guild members who have a specific monster as doublon (available for trade).
 */
export async function findExchangePartners(
    rawData: z.infer<typeof FindPartnersSchema>
): Promise<ActionResponse<MonsterOwner[]>> {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return { success: false, error: "Non authentifié" };
        }

        const parsed = FindPartnersSchema.safeParse(rawData);
        if (!parsed.success) {
            return { success: false, error: "Données invalides" };
        }
        const { guildId, monsterId } = parsed.data;

        // Get all guild members with linked Metamob accounts (except current user)
        const members = await db.userProfile.findMany({
            where: {
                guild: { discordGuildId: guildId },
                status: "ACTIVE",
                metamobVerified: true,
                metamobPseudo: { not: null },
                userId: { not: session.user.id }, // Exclude self
            },
            select: {
                id: true,
                pseudoDofus: true,
                discordNickname: true,
                metamobPseudo: true,
                user: { select: { name: true } },
            },
        });

        const memberPseudos = members
            .filter(m => m.metamobPseudo)
            .map(m => ({
                metamobPseudo: m.metamobPseudo!,
                profileId: m.id,
                displayName: m.discordNickname || m.pseudoDofus || m.user.name || "Anonyme",
            }));

        const owners = await findMonsterOwners(monsterId, memberPseudos);

        return { success: true, data: owners };
    } catch (error) {
        console.error("[findExchangePartners] Error:", error);
        return { success: false, error: "Erreur lors de la recherche" };
    }
}

// -----------------------------------------------------------------------------
// REFRESH CACHE
// -----------------------------------------------------------------------------

/**
 * Force refresh the cache for the current user's Metamob data.
 */
export async function refreshMyMetamobCache(
    guildId: string
): Promise<ActionResponse> {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return { success: false, error: "Non authentifié" };
        }

        const profile = await db.userProfile.findFirst({
            where: {
                userId: session.user.id,
                guild: { discordGuildId: guildId },
                status: "ACTIVE",
            },
            select: { metamobPseudo: true },
        });

        if (!profile?.metamobPseudo) {
            return { success: false, error: "Aucun compte Metamob lié" };
        }

        // Clear cache and re-fetch
        clearMonsterCache(profile.metamobPseudo);
        await getUserMonsters(profile.metamobPseudo);

        // Update sync timestamp
        await db.userProfile.updateMany({
            where: {
                userId: session.user.id,
                guild: { discordGuildId: guildId },
            },
            data: { metamobLastSync: new Date() },
        });

        revalidatePath(`/dashboard/${guildId}/archimonstres`);

        return { success: true };
    } catch (error) {
        console.error("[refreshMyMetamobCache] Error:", error);
        return { success: false, error: "Erreur lors du rafraîchissement" };
    }
}

// -----------------------------------------------------------------------------
// PROFILE MATCHING - Find archis that a member proposes that the viewer needs
// -----------------------------------------------------------------------------

export interface MatchingArchi {
    id: number;
    nom: string;
    imageUrl: string;
    zone: string;
    ownerQuantite: number;
}

export interface ProfileMatchData {
    matches: MatchingArchi[];
    ownerPseudo: string;
    ownerDisplayName: string;
}

/**
 * Get archimonstres that a profile owner proposes (doublons) and the current user is missing.
 * Used on read-only profile view to show potential exchanges.
 */
export async function getProfileMatchingArchis(
    guildId: string,
    targetProfileId: string
): Promise<ActionResponse<ProfileMatchData | null>> {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return { success: false, error: "Non authentifié" };
        }

        // Get viewer's profile
        const viewerProfile = await db.userProfile.findFirst({
            where: {
                userId: session.user.id,
                guild: { discordGuildId: guildId },
                status: "ACTIVE",
            },
            select: {
                metamobPseudo: true,
                metamobVerified: true,
            },
        });

        // If viewer has no Metamob linked, can't do matching
        if (!viewerProfile?.metamobPseudo || !viewerProfile.metamobVerified) {
            return { success: true, data: null };
        }

        // Get target profile
        const targetProfile = await db.userProfile.findFirst({
            where: {
                id: targetProfileId,
                guild: { discordGuildId: guildId },
                status: "ACTIVE",
            },
            select: {
                metamobPseudo: true,
                metamobVerified: true,
                pseudoDofus: true,
                discordNickname: true,
                user: { select: { name: true } },
            },
        });

        if (!targetProfile?.metamobPseudo || !targetProfile.metamobVerified) {
            return { success: true, data: null };
        }

        // Get both users' monsters
        const [viewerMonsters, targetMonsters] = await Promise.all([
            getUserMonsters(viewerProfile.metamobPseudo),
            getUserMonsters(targetProfile.metamobPseudo),
        ]);

        // Find what the viewer is MISSING and target has as DOUBLON
        const viewerMissingIds = new Set(
            viewerMonsters
                .filter((m) => m.etat === "MANQUANT")
                .map((m) => m.id)
        );

        const matches: MatchingArchi[] = targetMonsters
            .filter((m) => m.etat === "DOUBLON" && viewerMissingIds.has(m.id))
            .map((m) => ({
                id: m.id,
                nom: m.nom,
                imageUrl: m.imageUrl,
                zone: m.zone || "",
                ownerQuantite: m.quantite,
            }));

        return {
            success: true,
            data: {
                matches,
                ownerPseudo: targetProfile.metamobPseudo,
                ownerDisplayName: targetProfile.discordNickname ||
                    targetProfile.pseudoDofus ||
                    targetProfile.user.name ||
                    "Membre",
            },
        };
    } catch (error) {
        console.error("[getProfileMatchingArchis] Error:", error);

        if (error instanceof Error) {
            if (error.message === "API_KEY_MISSING" || error.message === "API_KEY_INVALID") {
                return { success: true, data: null }; // Silently fail for widget
            }
        }

        return { success: false, error: "Erreur lors du chargement" };
    }
}
