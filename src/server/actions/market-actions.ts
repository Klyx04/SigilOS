"use server";

import { db } from "@/lib/prisma";
import { auth } from "@/auth";
import { logger } from "@/lib/logger";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { getUserContext, type ActionResponse } from "./user-actions";
import { KAMAS_MAX } from "@/lib/market/kamas";
import { computeStatQuality, computeStatsHash } from "@/lib/market/stat-quality";
import { findNativeRange, toNativeEffects, type DofusItemEffectLike, type MarketNativeEffect } from "@/lib/market/effects";
import { loadMarketReferential } from "@/lib/market/referential";
import { publishListingToDiscord, syncListingMessage } from "@/server/market/discord";
import { writeMarketAuditLog } from "@/server/market/audit";
import { reserveMarketListingCore } from "@/server/market/reservations";
import {
    MARKET_AUDIT_ACTIONS,
    MARKET_DELETE_REASONS,
    MARKET_LIMITS,
    MARKET_TERMINAL_STATUSES,
    isMarketTransitionAllowed,
} from "./market-constants";

// ---------------------------------------------------------------------------
// TYPES
// ---------------------------------------------------------------------------

export type MarketListingRecord = Prisma.MarketListingGetPayload<{
    include: {
        stats: true;
        components: true;
        profile: {
            select: {
                id: true;
                pseudoDofus: true;
                classe: true;
                userId: true;
                user: { select: { name: true; image: true } };
            };
        };
    };
}>;

export type MarketCatalogFilters = {
    search?: string;
    type?: "EQUIPMENT" | "RESOURCE" | "SERVICE" | "WANTED" | "ALL";
    status?: "DRAFT" | "ACTIVE" | "RESERVED" | "SOLD" | "EXPIRED" | "WITHDRAWN" | "ALL";
    mineOnly?: boolean;
    hideTerminal?: boolean;
    sort?: "recent" | "price_asc" | "price_desc" | "level_desc";
};

export type MyMarketData = {
    active: MarketListingRecord[];
    archived: MarketListingRecord[];
};

// ---------------------------------------------------------------------------
// ZOD — validation systématique (§0.1 exigences)
// ---------------------------------------------------------------------------

const marketComponentSchema = z.object({
    dofusDbItemId: z.number().int().positive().nullable().optional(),
    name: z.string().trim().min(1).max(120),
    iconUrl: z.string().trim().max(500).nullable().optional(),
    quantity: z.number().int().positive().max(1_000_000_000),
    unitLabel: z.string().trim().max(40).nullable().optional(),
});

const marketStatSchema = z.object({
    effectId: z.number().int(),
    characteristic: z.number().int().nullable().optional(),
    label: z.string().trim().min(1).max(80),
    naturalMin: z.number().int().nullable().optional(),
    naturalMax: z.number().int().nullable().optional(),
    actualValue: z
        .number()
        .int()
        .min(MARKET_LIMITS.STAT_VALUE_MIN, "Valeur invraisemblable, vérifie ta saisie")
        .max(MARKET_LIMITS.STAT_VALUE_MAX, "Valeur invraisemblable, vérifie ta saisie"),
    origin: z.enum(["NATIVE", "EXO"]).default("NATIVE"),
});

const marketListingBaseSchema = z.object({
    type: z.enum(["EQUIPMENT", "RESOURCE", "SERVICE", "WANTED"]),
    title: z.string().trim().min(3, "Titre trop court").max(MARKET_LIMITS.TITLE_MAX),
    description: z.string().trim().max(MARKET_LIMITS.DESCRIPTION_MAX).nullable().optional(),
    forgedBy: z.string().trim().max(80).nullable().optional(),
    priceKamas: z.number().int().min(0).max(KAMAS_MAX).nullable().optional(),
    negotiable: z.boolean().default(true),
    acceptsTrade: z.boolean().default(false),
    dofusDbItemId: z.number().int().positive().nullable().optional(),
    itemName: z.string().trim().max(160).nullable().optional(),
    itemIconUrl: z.string().trim().max(500).nullable().optional(),
    itemLevel: z.number().int().min(0).max(300).nullable().optional(),
    itemTypeName: z.string().trim().max(80).nullable().optional(),
    quantity: z.number().int().positive().max(1_000_000_000).nullable().optional(),
    unitLabel: z.string().trim().max(40).nullable().optional(),
    minQuantity: z.number().int().positive().max(1_000_000_000).nullable().optional(),
    components: z.array(marketComponentSchema).max(MARKET_LIMITS.MAX_COMPONENTS).default([]),
    stats: z.array(marketStatSchema).max(MARKET_LIMITS.MAX_STATS).default([]),
});

export type MarketListingInput = z.input<typeof marketListingBaseSchema>;

// ---------------------------------------------------------------------------
// HELPERS INTERNES (non exportés — fichier "use server")
// ---------------------------------------------------------------------------

/** Retire les liens d'un texte libre (anti-phishing / anti-slop, §16.4). */
function sanitizeMarketText(value: string | null | undefined): string | null {
    if (!value) return null;
    const cleaned = value
        .replace(/https?:\/\/\S+/gi, "[lien retiré]")
        .replace(/\bdiscord\.gg\/\S+/gi, "[invitation retirée]")
        .replace(/\s{3,}/g, "  ")
        .trim();
    return cleaned.length > 0 ? cleaned : null;
}

/**
 * Résout le contexte (guildConfig interne) + vérifie module + permission.
 * ⚠️ L'isolation vient TOUJOURS du contexte serveur (§16.2).
 */
async function resolveMarketContext(guildId: string) {
    const user = await getUserContext(guildId);
    if (!user.isAuthenticated || !user.isMember || !user.canViewMarket) {
        return { error: "Accès refusé" as const };
    }
    const guildConfig = await db.guildConfig.findUnique({
        where: { discordGuildId: guildId },
        select: {
            id: true,
            marketMaxActivePerMember: true,
            marketMaxLifetimeDays: true,
            marketReservationHours: true,
            marketNotifyChannelId: true,
            marketNotifyRoleId: true,
            marketChannelKind: true,
            marketAllowedPingRoleIds: true,
        },
    });
    if (!guildConfig) return { error: "Guilde introuvable" as const };
    return { user, guildConfig };
}

const MARKET_INCLUDE = {
    stats: true,
    components: { orderBy: { position: "asc" } },
    profile: {
        select: {
            id: true,
            pseudoDofus: true,
            classe: true,
            userId: true,
            user: { select: { name: true, image: true } },
        },
    },
} satisfies Prisma.MarketListingInclude;

/**
 * S2.8/S2.9 — Recalcule les stats **côté serveur** : la plage native provient
 * **toujours** du catalogue (`GameItem.nativeEffects`) et jamais du client (§12.8).
 * Un effet non natif est étiqueté `EXO` (jamais refusé, D34/D35) ; le libellé est
 * tiré du référentiel data-driven (S2.5bis) avec repli sur le libellé déclaré.
 */
async function resolveServerStats(
    dofusDbItemId: number | null | undefined,
    stats: z.infer<typeof marketStatSchema>[]
): Promise<{
    rows: Omit<Prisma.MarketListingStatCreateManyInput, "listingId">[];
    hash: string | null;
}> {
    if (stats.length === 0) return { rows: [], hash: null };

    const [item, referential] = await Promise.all([
        dofusDbItemId
            ? db.gameItem.findUnique({
                  where: { ankamaId: dofusDbItemId },
                  select: { nativeEffects: true, effects: true },
              })
            : Promise.resolve(null),
        loadMarketReferential(),
    ]);
    // 🛡️ Filet de sécurité (S2.12) : `nativeEffects` est vide sur les lignes
    // siphonnées AVANT l'ajout de la colonne (données périmées). On dérive alors
    // les plages depuis `effects` (forme brute DofusDB tolérée, `diceNum`/
    // `diceSide`). Lecture seule : la réparation définitive (backfill) se fait
    // depuis le panneau God, et le prochain siphon complète les données.
    const natives =
        (item?.nativeEffects as MarketNativeEffect[] | null) ??
        toNativeEffects({ effects: item?.effects as DofusItemEffectLike[] | null });

    const rows = stats.map((stat) => {
        const range = findNativeRange(natives, {
            effectId: stat.effectId,
            characteristic: stat.characteristic ?? null,
        });
        // La plage native est une SOURCE SERVEUR : le client ne la fixe jamais.
        const naturalMin = range ? range.from : null;
        const naturalMax = range ? range.to : null;
        const origin = range ? stat.origin : "EXO";
        const label =
            (stat.characteristic != null && referential.labels[stat.characteristic]) ||
            referential.effectLabels[stat.effectId] ||
            stat.label;
        return {
            effectId: stat.effectId,
            characteristic: stat.characteristic ?? null,
            label,
            naturalMin,
            naturalMax,
            actualValue: stat.actualValue,
            origin,
            quality: computeStatQuality({
                naturalMin,
                naturalMax,
                actualValue: stat.actualValue,
                origin,
            }),
        };
    });

    return { rows, hash: computeStatsHash(rows) };
}


// ---------------------------------------------------------------------------
// LECTURE (S1.13)
// ---------------------------------------------------------------------------

/** Catalogue d'annonces de la guilde — filtré côté serveur, jamais par le client. */
export async function getMarketListings(
    guildId: string,
    filters?: MarketCatalogFilters
): Promise<ActionResponse<MarketListingRecord[]>> {
    try {
        const ctx = await resolveMarketContext(guildId);
        if ("error" in ctx) return { success: false, error: ctx.error };
        const { user, guildConfig } = ctx;

        const status = filters?.status ?? "ALL";
        const hideTerminal = filters?.hideTerminal !== false;
        const where: Prisma.MarketListingWhereInput = {
            guildId: guildConfig.id,
            deletedAt: null,
        };

        if (filters?.mineOnly) {
            // « Mes annonces » : brouillons et retirées inclus (le vendeur voit tout).
            where.profileId = user.profileId ?? "__none__";
            if (status !== "ALL") where.status = status;
            else if (hideTerminal) where.status = { notIn: MARKET_TERMINAL_STATUSES };
        } else {
            // Catalogue public : jamais les brouillons ni les annonces retirées.
            if (status !== "ALL" && status !== "DRAFT" && status !== "WITHDRAWN") {
                where.status = status;
            } else if (hideTerminal) {
                where.status = { in: ["ACTIVE", "RESERVED"] };
            } else {
                where.status = { in: ["ACTIVE", "RESERVED", "SOLD", "EXPIRED"] };
            }
        }

        if (filters?.type && filters.type !== "ALL") {
            where.type = filters.type;
        }

        const search = filters?.search?.trim();
        if (search) {
            where.OR = [
                { title: { contains: search, mode: "insensitive" } },
                { itemName: { contains: search, mode: "insensitive" } },
                { description: { contains: search, mode: "insensitive" } },
            ];
        }

        let orderBy: Prisma.MarketListingOrderByWithRelationInput[] = [{ publishedAt: "desc" }, { createdAt: "desc" }];
        if (filters?.sort === "price_asc") orderBy = [{ priceKamas: "asc" }, { createdAt: "desc" }];
        if (filters?.sort === "price_desc") orderBy = [{ priceKamas: "desc" }, { createdAt: "desc" }];
        if (filters?.sort === "level_desc") orderBy = [{ itemLevel: "desc" }, { createdAt: "desc" }];

        const listings = await db.marketListing.findMany({
            where,
            include: MARKET_INCLUDE,
            orderBy,
            take: MARKET_LIMITS.CATALOG_PAGE_SIZE,
        });

        return { success: true, data: listings };
    } catch (error) {
        logger.error("[getMarketListings] failed", { err: error });
        return { success: false, error: "Erreur interne" };
    }
}

/** Fiche d'une annonce (isolation stricte : appartient à la guilde du contexte). */
export async function getMarketListing(
    guildId: string,
    listingId: string
): Promise<ActionResponse<MarketListingRecord>> {
    try {
        const ctx = await resolveMarketContext(guildId);
        if ("error" in ctx) return { success: false, error: ctx.error };
        const { user, guildConfig } = ctx;

        const parsed = z.string().min(1).safeParse(listingId);
        if (!parsed.success) return { success: false, error: "Annonce introuvable" };

        const listing = await db.marketListing.findFirst({
            where: { id: parsed.data, guildId: guildConfig.id, deletedAt: null },
            include: MARKET_INCLUDE,
        });
        if (!listing) return { success: false, error: "Annonce introuvable" };

        const isOwner = listing.profileId === user.profileId;
        // Brouillons / retirées : visibles uniquement par le vendeur ou un modérateur.
        if ((listing.status === "DRAFT" || listing.status === "WITHDRAWN") && !isOwner && !user.canManageMarket) {
            return { success: false, error: "Annonce introuvable" };
        }

        return { success: true, data: listing };
    } catch (error) {
        logger.error("[getMarketListing] failed", { err: error });
        return { success: false, error: "Erreur interne" };
    }
}

/** « Mes espaces » : mes annonces actives + mes archives. */
export async function getMyMarketData(guildId: string): Promise<ActionResponse<MyMarketData>> {
    try {
        const ctx = await resolveMarketContext(guildId);
        if ("error" in ctx) return { success: false, error: ctx.error };
        const { user, guildConfig } = ctx;
        if (!user.profileId) return { success: false, error: "Profil introuvable" };

        const rows = await db.marketListing.findMany({
            where: { guildId: guildConfig.id, profileId: user.profileId, deletedAt: null },
            include: MARKET_INCLUDE,
            orderBy: [{ updatedAt: "desc" }],
        });

        const active = rows.filter((row) => !MARKET_TERMINAL_STATUSES.includes(row.status));
        const archived = rows.filter((row) => MARKET_TERMINAL_STATUSES.includes(row.status));

        return { success: true, data: { active, archived } };
    } catch (error) {
        logger.error("[getMyMarketData] failed", { err: error });
        return { success: false, error: "Erreur interne" };
    }
}


// ---------------------------------------------------------------------------
// RÉSERVATIONS (S4.2)
// ---------------------------------------------------------------------------

/**
 * Réserve une annonce `ACTIVE` « au prix » (l'acheteur ne peut pas être le
 * vendeur). Le verrou transactionnel de §11.3 et l'unicité de la réservation
 * active vivent dans `reserveMarketListingCore()`, **partagé** avec les
 * interactions Discord : une seule implémentation, deux points d'entrée.
 */
export async function reserveMarketListing(
    guildId: string,
    listingId: string
): Promise<ActionResponse<{ reservationId: string }>> {
    try {
        const ctx = await resolveMarketContext(guildId);
        if ("error" in ctx) return { success: false, error: ctx.error };
        const { user, guildConfig } = ctx;
        if (!user.profileId) return { success: false, error: "Profil introuvable" };

        const parsed = z.string().min(1).max(64).safeParse(listingId);
        if (!parsed.success) return { success: false, error: "Annonce introuvable" };

        const session = await auth();
        const outcome = await reserveMarketListingCore({
            guildConfigId: guildConfig.id,
            listingId: parsed.data,
            buyerProfileId: user.profileId,
            buyerUserId: session?.user?.id ?? user.id ?? "",
            reservationHours: guildConfig.marketReservationHours,
        });
        if (!outcome.ok) return { success: false, error: outcome.error };

        revalidatePath(`/dashboard/${guildId}/marche`);
        return { success: true, data: { reservationId: outcome.reservationId } };
    } catch (error) {
        logger.error("[reserveMarketListing] failed", { err: error });
        return { success: false, error: "Erreur interne" };
    }
}


// ---------------------------------------------------------------------------
// CRÉATION & MISE À JOUR (S1.14, S1.32)
// ---------------------------------------------------------------------------

/** Valide la cohérence métier d'une annonce (item catalogue / contenu du lot). */
function validateListingCoherence(input: z.infer<typeof marketListingBaseSchema>): string | null {
    if (input.type === "EQUIPMENT" && !input.dofusDbItemId) {
        return "Choisis un objet du catalogue pour une annonce d'équipement.";
    }
    if (input.type === "RESOURCE" && input.components.length === 0 && !input.quantity) {
        return "Renseigne au moins une ressource (lot) ou une quantité.";
    }
    if (input.minQuantity && input.quantity && input.minQuantity > input.quantity) {
        return "La quantité minimale ne peut pas dépasser la quantité du lot.";
    }
    return null;
}

/** Crée une annonce en `DRAFT` (la publication est une action distincte, §11.1). */
export async function createMarketListing(
    guildId: string,
    input: MarketListingInput
): Promise<ActionResponse<{ id: string }>> {
    try {
        const ctx = await resolveMarketContext(guildId);
        if ("error" in ctx) return { success: false, error: ctx.error };
        const { user, guildConfig } = ctx;
        if (!user.profileId) return { success: false, error: "Profil introuvable" };

        const parsed = marketListingBaseSchema.safeParse(input);
        if (!parsed.success) {
            return { success: false, error: parsed.error.errors[0]?.message || "Données invalides" };
        }
        const data = parsed.data;

        const coherenceError = validateListingCoherence(data);
        if (coherenceError) return { success: false, error: coherenceError };

        // Plafond d'annonces actives par membre (anti-abus, §8.4).
        const activeCount = await db.marketListing.count({
            where: {
                guildId: guildConfig.id,
                profileId: user.profileId,
                deletedAt: null,
                status: { in: ["ACTIVE", "RESERVED"] },
            },
        });
        if (activeCount >= guildConfig.marketMaxActivePerMember) {
            return {
                success: false,
                error: `Tu as atteint ton plafond de ${guildConfig.marketMaxActivePerMember} annonces actives.`,
            };
        }

        const resolvedStats = await resolveServerStats(data.dofusDbItemId, data.stats);
        const session = await auth();
        const listing = await db.marketListing.create({
            data: {
                guildId: guildConfig.id,
                profileId: user.profileId,
                userId: session?.user?.id ?? "",
                type: data.type,
                status: "DRAFT",
                title: data.title,
                description: sanitizeMarketText(data.description),
                forgedBy: sanitizeMarketText(data.forgedBy),
                priceKamas: data.priceKamas ?? null,
                negotiable: data.negotiable,
                acceptsTrade: data.acceptsTrade,
                dofusDbItemId: data.dofusDbItemId ?? null,
                itemName: data.itemName ?? null,
                itemIconUrl: data.itemIconUrl ?? null,
                itemLevel: data.itemLevel ?? null,
                itemTypeName: data.itemTypeName ?? null,
                quantity: data.quantity ?? null,
                unitLabel: data.unitLabel ?? null,
                minQuantity: data.minQuantity ?? null,
                statsHash: resolvedStats.hash,
                lastActivityAt: new Date(),
                stats:
                    resolvedStats.rows.length > 0
                        ? { create: resolvedStats.rows }
                        : undefined,
                components:
                    data.components.length > 0
                        ? {
                            create: data.components.map((component, index) => ({
                                position: index,
                                dofusDbItemId: component.dofusDbItemId ?? null,
                                name: component.name,
                                iconUrl: component.iconUrl ?? null,
                                quantity: component.quantity,
                                unitLabel: component.unitLabel ?? null,
                            })),
                        }
                        : undefined,
            },
            select: { id: true },
        });

        await writeMarketAuditLog({
            guildId: guildConfig.id,
            listingId: listing.id,
            actorUserId: session?.user?.id ?? null,
            action: MARKET_AUDIT_ACTIONS.LISTING_CREATED,
            nextData: { title: data.title, type: data.type, priceKamas: data.priceKamas ?? null },
        });

        revalidatePath(`/dashboard/${guildId}/marche`);
        return { success: true, data: { id: listing.id } };
    } catch (error) {
        logger.error("[createMarketListing] failed", { err: error });
        return { success: false, error: "Erreur interne" };
    }
}


/**
 * Met à jour une annonce (vendeur uniquement, statuts éditables seulement).
 * Les stats sont **recalculées** intégralement (jamais de `quality` client).
 */
export async function updateMarketListing(
    guildId: string,
    listingId: string,
    input: MarketListingInput
): Promise<ActionResponse> {
    try {
        const ctx = await resolveMarketContext(guildId);
        if ("error" in ctx) return { success: false, error: ctx.error };
        const { user, guildConfig } = ctx;
        if (!user.profileId) return { success: false, error: "Profil introuvable" };

        const existing = await db.marketListing.findFirst({
            where: { id: listingId, guildId: guildConfig.id, deletedAt: null },
            select: { id: true, profileId: true, status: true, title: true, priceKamas: true },
        });
        if (!existing) return { success: false, error: "Annonce introuvable" };
        if (existing.profileId !== user.profileId) {
            return { success: false, error: "Tu n'es pas le vendeur de cette annonce." };
        }
        if (!["DRAFT", "ACTIVE", "EXPIRED"].includes(existing.status)) {
            return { success: false, error: "Cette annonce ne peut plus être modifiée dans son état actuel." };
        }

        const parsed = marketListingBaseSchema.safeParse(input);
        if (!parsed.success) {
            return { success: false, error: parsed.error.errors[0]?.message || "Données invalides" };
        }
        const data = parsed.data;

        const coherenceError = validateListingCoherence(data);
        if (coherenceError) return { success: false, error: coherenceError };

        const resolvedStats = await resolveServerStats(data.dofusDbItemId, data.stats);
        await db.$transaction(async (tx) => {
            await tx.marketListing.update({
                where: { id: existing.id },
                data: {
                    type: data.type,
                    title: data.title,
                    description: sanitizeMarketText(data.description),
                    forgedBy: sanitizeMarketText(data.forgedBy),
                    priceKamas: data.priceKamas ?? null,
                    negotiable: data.negotiable,
                    acceptsTrade: data.acceptsTrade,
                    dofusDbItemId: data.dofusDbItemId ?? null,
                    itemName: data.itemName ?? null,
                    itemIconUrl: data.itemIconUrl ?? null,
                    itemLevel: data.itemLevel ?? null,
                    itemTypeName: data.itemTypeName ?? null,
                    quantity: data.quantity ?? null,
                    unitLabel: data.unitLabel ?? null,
                    minQuantity: data.minQuantity ?? null,
                    statsHash: resolvedStats.hash,
                    lastActivityAt: new Date(),
                },
            });

            await tx.marketListingStat.deleteMany({ where: { listingId: existing.id } });
            if (resolvedStats.rows.length > 0) {
                await tx.marketListingStat.createMany({
                    data: resolvedStats.rows.map((stat) => ({
                        ...stat,
                        listingId: existing.id,
                    })),
                });
            }

            await tx.marketListingComponent.deleteMany({ where: { listingId: existing.id } });
            if (data.components.length > 0) {
                await tx.marketListingComponent.createMany({
                    data: data.components.map((component, index) => ({
                        listingId: existing.id,
                        position: index,
                        dofusDbItemId: component.dofusDbItemId ?? null,
                        name: component.name,
                        iconUrl: component.iconUrl ?? null,
                        quantity: component.quantity,
                        unitLabel: component.unitLabel ?? null,
                    })),
                });
            }
        });

        const session = await auth();
        await writeMarketAuditLog({
            guildId: guildConfig.id,
            listingId: existing.id,
            actorUserId: session?.user?.id ?? null,
            action: MARKET_AUDIT_ACTIONS.LISTING_UPDATED,
            previousData: { title: existing.title, priceKamas: existing.priceKamas },
            nextData: { title: data.title, priceKamas: data.priceKamas ?? null },
        });

        revalidatePath(`/dashboard/${guildId}/marche`);
        return { success: true };
    } catch (error) {
        logger.error("[updateMarketListing] failed", { err: error });
        return { success: false, error: "Erreur interne" };
    }
}


// ---------------------------------------------------------------------------
// CYCLE DE VIE (S1.15, S1.16, S1.30, S1.31)
// ---------------------------------------------------------------------------

/**
 * Publie une annonce `DRAFT` → `ACTIVE`.
 * `expiresAt = publishedAt + marketMaxLifetimeDays` (D18, S1.30).
 */
export async function publishMarketListing(
    guildId: string,
    listingId: string,
    pingRoleIds?: string[]
): Promise<ActionResponse> {
    try {
        const ctx = await resolveMarketContext(guildId);
        if ("error" in ctx) return { success: false, error: ctx.error };
        const { user, guildConfig } = ctx;

        const existing = await db.marketListing.findFirst({
            where: { id: listingId, guildId: guildConfig.id, deletedAt: null },
            select: { id: true, profileId: true, status: true },
        });
        if (!existing) return { success: false, error: "Annonce introuvable" };
        if (existing.profileId !== user.profileId) {
            return { success: false, error: "Tu n'es pas le vendeur de cette annonce." };
        }
        if (existing.status !== "DRAFT") {
            return { success: false, error: "Seul un brouillon peut être publié." };
        }

        const activeCount = await db.marketListing.count({
            where: {
                guildId: guildConfig.id,
                profileId: user.profileId,
                deletedAt: null,
                status: { in: ["ACTIVE", "RESERVED"] },
            },
        });
        if (activeCount >= guildConfig.marketMaxActivePerMember) {
            return {
                success: false,
                error: `Tu as atteint ton plafond de ${guildConfig.marketMaxActivePerMember} annonces actives.`,
            };
        }

        const now = new Date();
        const expiresAt = new Date(now.getTime() + guildConfig.marketMaxLifetimeDays * 24 * 60 * 60 * 1000);

        await db.marketListing.update({
            where: { id: existing.id },
            data: {
                status: "ACTIVE",
                publishedAt: now,
                expiresAt,
                reminderStage: 0,
                lastReminderAt: null,
                lastActivityAt: now,
                withdrawnAt: null,
            },
        });

        const session = await auth();
        await writeMarketAuditLog({
            guildId: guildConfig.id,
            listingId: existing.id,
            actorUserId: session?.user?.id ?? null,
            action: MARKET_AUDIT_ACTIONS.LISTING_PUBLISHED,
            previousData: { status: "DRAFT" },
            nextData: { status: "ACTIVE", expiresAt },
        });

        revalidatePath(`/dashboard/${guildId}/marche`);
        // S3.5 — publication Discord asynchrone : la réponse n'attend jamais Discord.
        void publishListingToDiscord(existing.id, pingRoleIds).catch((err) =>
            logger.warn("[market] publication Discord différée", { listingId: existing.id, err: String(err) })
        );
        return { success: true };
    } catch (error) {
        logger.error("[publishMarketListing] failed", { err: error });
        return { success: false, error: "Erreur interne" };
    }
}

/** Retrait par le vendeur (statut `WITHDRAWN`, motif facultatif). */
export async function withdrawMarketListing(
    guildId: string,
    listingId: string,
    reason?: string | null
): Promise<ActionResponse> {
    try {
        const ctx = await resolveMarketContext(guildId);
        if ("error" in ctx) return { success: false, error: ctx.error };
        const { user, guildConfig } = ctx;

        const existing = await db.marketListing.findFirst({
            where: { id: listingId, guildId: guildConfig.id, deletedAt: null },
            select: { id: true, profileId: true, status: true },
        });
        if (!existing) return { success: false, error: "Annonce introuvable" };
        if (existing.profileId !== user.profileId) {
            return { success: false, error: "Tu n'es pas le vendeur de cette annonce." };
        }
        if (!isMarketTransitionAllowed(existing.status, "WITHDRAWN")) {
            return { success: false, error: "Transition refusée depuis l'état actuel." };
        }

        const now = new Date();
        await db.marketListing.update({
            where: { id: existing.id },
            data: {
                status: "WITHDRAWN",
                withdrawnAt: now,
                moderationNote: sanitizeMarketText(reason),
                lastActivityAt: now,
            },
        });

        const session = await auth();
        await writeMarketAuditLog({
            guildId: guildConfig.id,
            listingId: existing.id,
            actorUserId: session?.user?.id ?? null,
            action: MARKET_AUDIT_ACTIONS.LISTING_WITHDRAWN,
            previousData: { status: existing.status },
            nextData: { status: "WITHDRAWN" },
            reason: reason ?? null,
        });

        revalidatePath(`/dashboard/${guildId}/marche`);
        // S3.9 — réécriture de l'embed (état WITHDRAWN) : jamais bloquante.
        void syncListingMessage(existing.id).catch((err) =>
            logger.warn("[market] synchronisation Discord différée", { listingId: existing.id, err: String(err) })
        );
        return { success: true };
    } catch (error) {
        logger.error("[withdrawMarketListing] failed", { err: error });
        return { success: false, error: "Erreur interne" };
    }
}


/**
 * Renouvelle une annonce `EXPIRED` → `ACTIVE` (remise à J+0).
 * Q10=C : **une seule** prolongation autorisée (plafond absolu 40 j).
 */
export async function renewMarketListing(
    guildId: string,
    listingId: string
): Promise<ActionResponse> {
    try {
        const ctx = await resolveMarketContext(guildId);
        if ("error" in ctx) return { success: false, error: ctx.error };
        const { user, guildConfig } = ctx;

        const existing = await db.marketListing.findFirst({
            where: { id: listingId, guildId: guildConfig.id, deletedAt: null },
            select: { id: true, profileId: true, status: true, renewCount: true },
        });
        if (!existing) return { success: false, error: "Annonce introuvable" };
        if (existing.profileId !== user.profileId) {
            return { success: false, error: "Tu n'es pas le vendeur de cette annonce." };
        }
        if (existing.status !== "EXPIRED") {
            return { success: false, error: "Seule une annonce expirée peut être renouvelée." };
        }
        if (existing.renewCount >= 1) {
            return { success: false, error: "Cette annonce a déjà été renouvelée une fois (maximum atteint)." };
        }

        const now = new Date();
        const expiresAt = new Date(now.getTime() + guildConfig.marketMaxLifetimeDays * 24 * 60 * 60 * 1000);

        await db.marketListing.update({
            where: { id: existing.id },
            data: {
                status: "ACTIVE",
                publishedAt: now,
                expiresAt,
                renewCount: existing.renewCount + 1,
                reminderStage: 0,
                lastReminderAt: null,
                lastActivityAt: now,
            },
        });

        const session = await auth();
        await writeMarketAuditLog({
            guildId: guildConfig.id,
            listingId: existing.id,
            actorUserId: session?.user?.id ?? null,
            action: MARKET_AUDIT_ACTIONS.LISTING_RENEWED,
            previousData: { status: "EXPIRED" },
            nextData: { status: "ACTIVE", expiresAt },
        });

        revalidatePath(`/dashboard/${guildId}/marche`);
        void syncListingMessage(existing.id).catch((err) =>
            logger.warn("[market] synchronisation Discord différée", { listingId: existing.id, err: String(err) })
        );
        return { success: true };
    } catch (error) {
        logger.error("[renewMarketListing] failed", { err: error });
        return { success: false, error: "Erreur interne" };
    }
}

/** Soft-delete par le vendeur (traçabilité conservée, S1.31). */
export async function deleteMarketListing(
    guildId: string,
    listingId: string
): Promise<ActionResponse> {
    try {
        const ctx = await resolveMarketContext(guildId);
        if ("error" in ctx) return { success: false, error: ctx.error };
        const { user, guildConfig } = ctx;

        const existing = await db.marketListing.findFirst({
            where: { id: listingId, guildId: guildConfig.id, deletedAt: null },
            select: { id: true, profileId: true, status: true },
        });
        if (!existing) return { success: false, error: "Annonce introuvable" };
        if (existing.profileId !== user.profileId) {
            return { success: false, error: "Tu n'es pas le vendeur de cette annonce." };
        }

        const now = new Date();
        await db.marketListing.update({
            where: { id: existing.id },
            data: {
                status: "WITHDRAWN",
                deletedAt: now,
                deletedReason: MARKET_DELETE_REASONS.SELLER,
                withdrawnAt: now,
                lastActivityAt: now,
            },
        });

        const session = await auth();
        await writeMarketAuditLog({
            guildId: guildConfig.id,
            listingId: existing.id,
            actorUserId: session?.user?.id ?? null,
            action: MARKET_AUDIT_ACTIONS.LISTING_DELETED,
            previousData: { status: existing.status },
            nextData: { deletedAt: now, deletedReason: MARKET_DELETE_REASONS.SELLER },
        });

        revalidatePath(`/dashboard/${guildId}/marche`);
        void syncListingMessage(existing.id).catch((err) =>
            logger.warn("[market] synchronisation Discord différée", { listingId: existing.id, err: String(err) })
        );
        return { success: true };
    } catch (error) {
        logger.error("[deleteMarketListing] failed", { err: error });
        return { success: false, error: "Erreur interne" };
    }
}

/** Journal d'audit d'une annonce (modération / transparence). */
export async function getMarketAuditTrail(
    guildId: string,
    listingId: string
): Promise<ActionResponse<Prisma.MarketAuditLogGetPayload<object>[]>> {
    try {
        const ctx = await resolveMarketContext(guildId);
        if ("error" in ctx) return { success: false, error: ctx.error };
        const { user, guildConfig } = ctx;
        if (!user.canManageMarket) return { success: false, error: "Accès refusé" };

        const logs = await db.marketAuditLog.findMany({
            where: { guildId: guildConfig.id, listingId },
            orderBy: { createdAt: "desc" },
            take: 100,
        });
        return { success: true, data: logs };
    } catch (error) {
        logger.error("[getMarketAuditTrail] failed", { err: error });
        return { success: false, error: "Erreur interne" };
    }
}


// ---------------------------------------------------------------------------
// S2.18 / S3.14 — Aide à l'UI (prix moyen guilde, contexte de publication)
// ---------------------------------------------------------------------------

export type MarketPriceStats = {
    average: number | null;
    min: number | null;
    max: number | null;
    count: number;
};

/**
 * S2.18 — « Prix moyen guilde » d'un objet : moyenne des prix des annonces de
 * **la guilde du contexte** pour le même `dofusDbItemId`. Aucun appel externe.
 */
export async function getMarketPriceStats(
    guildId: string,
    dofusDbItemId: number
): Promise<ActionResponse<MarketPriceStats>> {
    const empty: MarketPriceStats = { average: null, min: null, max: null, count: 0 };
    try {
        const ctx = await resolveMarketContext(guildId);
        if ("error" in ctx) return { success: false, error: ctx.error };
        if (!Number.isInteger(dofusDbItemId) || dofusDbItemId <= 0) {
            return { success: true, data: empty };
        }

        const rows = await db.marketListing.findMany({
            where: {
                guildId: ctx.guildConfig.id,
                dofusDbItemId,
                deletedAt: null,
                status: { in: ["ACTIVE", "RESERVED", "SOLD"] },
                priceKamas: { not: null },
            },
            select: { priceKamas: true },
        });
        const prices = rows
            .map((row) => row.priceKamas)
            .filter((value): value is number => typeof value === "number" && value > 0);
        if (prices.length === 0) return { success: true, data: empty };

        const total = prices.reduce((sum, value) => sum + value, 0);
        return {
            success: true,
            data: {
                average: Math.round(total / prices.length),
                min: Math.min(...prices),
                max: Math.max(...prices),
                count: prices.length,
            },
        };
    } catch (error) {
        logger.error("[getMarketPriceStats] failed", { err: error });
        return { success: false, error: "Erreur interne", data: empty };
    }
}

export type MarketPublishContext = {
    channelConfigured: boolean;
    channelKind: string | null;
    allowedPingRoleIds: string[];
    notifyRoleId: string | null;
};

/**
 * S3.14 — Contexte de publication Discord pour l'assistant de création
 * (salon configuré OU non, mode texte/forum, rôles « pinguables » autorisés).
 * Lecture seule, aucune donnée sensible.
 */
export async function getMarketPublishContext(
    guildId: string
): Promise<ActionResponse<MarketPublishContext>> {
    try {
        const ctx = await resolveMarketContext(guildId);
        if ("error" in ctx) return { success: false, error: ctx.error };
        const { guildConfig } = ctx;

        const allowedPingRoleIds = Array.isArray(guildConfig.marketAllowedPingRoleIds)
            ? (guildConfig.marketAllowedPingRoleIds as string[])
            : [];

        return {
            success: true,
            data: {
                channelConfigured: !!guildConfig.marketNotifyChannelId,
                channelKind: guildConfig.marketChannelKind,
                allowedPingRoleIds,
                notifyRoleId: guildConfig.marketNotifyRoleId,
            },
        };
    } catch (error) {
        logger.error("[getMarketPublishContext] failed", { err: error });
        return { success: false, error: "Erreur interne" };
    }
}

/**
 * S3.8 — État de synchronisation Discord d'une annonce (bandeau « à
 * resynchroniser »). Accessible au **vendeur** et aux **modérateurs**.
 */
export async function getMarketListingDiscordState(
    guildId: string,
    listingId: string
): Promise<ActionResponse<{ syncStatus: string | null; lastError: string | null; published: boolean }>> {
    try {
        const ctx = await resolveMarketContext(guildId);
        if ("error" in ctx) return { success: false, error: ctx.error };
        const { user, guildConfig } = ctx;

        const listing = await db.marketListing.findFirst({
            where: { id: listingId, guildId: guildConfig.id },
            select: {
                profileId: true,
                discordMessage: { select: { syncStatus: true, lastError: true, discordMessageId: true } },
            },
        });
        if (!listing) return { success: false, error: "Annonce introuvable" };
        const isOwner = listing.profileId === user.profileId;
        if (!isOwner && !user.canManageMarket) return { success: false, error: "Accès refusé" };

        return {
            success: true,
            data: {
                syncStatus: listing.discordMessage?.syncStatus ?? null,
                lastError: listing.discordMessage?.lastError ?? null,
                published: !!listing.discordMessage?.discordMessageId,
            },
        };
    } catch (error) {
        logger.error("[getMarketListingDiscordState] failed", { err: error });
        return { success: false, error: "Erreur interne" };
    }
}

