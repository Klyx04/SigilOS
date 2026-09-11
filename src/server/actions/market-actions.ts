"use server";

import { db } from "@/lib/prisma";
import { auth } from "@/auth";
import { logger } from "@/lib/logger";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma, type MarketOfferStatus } from "@prisma/client";
import { getUserContext, type ActionResponse } from "./user-actions";
import { KAMAS_MAX } from "@/lib/market/kamas";
import { computeStatQuality, computeStatsHash } from "@/lib/market/stat-quality";
import { findNativeRange, toNativeEffects, type DofusItemEffectLike, type MarketNativeEffect } from "@/lib/market/effects";
import { loadMarketReferential } from "@/lib/market/referential";
import { publishListingToDiscord, syncListingMessage } from "@/server/market/discord";
import { writeMarketAuditLog } from "@/server/market/audit";
import { reserveMarketListingCore, cancelMarketReservationCore } from "@/server/market/reservations";
import {
    cancelMarketOfferCore,
    createMarketOfferCore,
    respondToMarketOfferCore,
    type MarketOfferCounterDraft,
    type MarketOfferDecisionInput,
} from "@/server/market/offers";
import { completeMarketSaleCore } from "@/server/market/sales";
import { normalizeMarketOfferDraft } from "@/lib/market/discord-interactions";
import { sanitizeMarketText } from "@/lib/market/text";
import {
    MARKET_AUDIT_ACTIONS,
    MARKET_DELETE_REASONS,
    MARKET_LIMITS,
    MARKET_REPORT_REASONS,
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

/**
 * Offre du **centre de négociation** (S4.10), telle que vue par le membre courant.
 * §13.7 : cet écran est privé — le pseudo de l'autre partie y est légitime, il ne
 * l'est jamais dans le salon Discord (seul le compteur d'offres y est public).
 */
export type MarketNegotiationOffer = {
    id: string;
    listingId: string;
    listingTitle: string;
    status: MarketOfferStatus;
    /** `true` = contre-offre rattachée à une offre précédente (§11.4). */
    isCounter: boolean;
    /** `AUTHOR` = j'ai déposé cette offre · `COUNTERPART` = c'est à moi de répondre. */
    role: "AUTHOR" | "COUNTERPART";
    offeredKamas: number | null;
    tradeDescription: string | null;
    note: string | null;
    createdAt: string;
    expiresAt: string | null;
    /** Pseudo de l'autre partie, quand c'est à moi de répondre. */
    counterpartLabel: string | null;
    /** `true` = accepter / refuser / contre-proposer (§11.4). */
    canRespond: boolean;
    /** `true` = retirer mon offre (§14.1). */
    canCancel: boolean;
};

export type MyMarketData = {
    active: MarketListingRecord[];
    archived: MarketListingRecord[];
    /** S4.10 — offres reçues sur mes annonces, encore `PENDING`. */
    receivedOffers: MarketNegotiationOffer[];
    /** S4.10 — mes offres (en cours **et** tranchées) + contre-offres qui m'attendent. */
    sentOffers: MarketNegotiationOffer[];
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
            marketOfferHours: true,
            marketNegotiationsEnabled: true,
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

/** Sélection commune aux offres du centre de négociation (S4.10). */
const NEGOTIATION_OFFER_SELECT = {
    id: true,
    listingId: true,
    status: true,
    counterOfId: true,
    buyerProfileId: true,
    offeredKamas: true,
    tradeDescription: true,
    note: true,
    createdAt: true,
    expiresAt: true,
    listing: { select: { id: true, title: true } },
} as const;

/** Ligne brute renvoyée par `NEGOTIATION_OFFER_SELECT`. */
type NegotiationOfferRow = {
    id: string;
    listingId: string;
    status: MarketOfferStatus;
    counterOfId: string | null;
    buyerProfileId: string;
    offeredKamas: number | null;
    tradeDescription: string | null;
    note: string | null;
    createdAt: Date;
    expiresAt: Date | null;
    listing: { id: string; title: string };
};

/** Nombre d'offres conservées dans l'historique « mes offres » (S4.10). */
const MARKET_NEGOTIATION_HISTORY_LIMIT = 20;

/**
 * Met une ligne `MarketOffer` en forme pour le centre de négociation (§14.1).
 *
 * Les capacités (`canRespond` / `canCancel`) sont calculées **serveur** : une
 * offre `PENDING` mais déjà **périmée** n'est plus actionnable (l'expiration est
 * écrite par le cron, §15.1 point 5 — le moteur la refuserait de toute façon).
 */
function toNegotiationOffer(
    row: NegotiationOfferRow,
    params: { role: "AUTHOR" | "COUNTERPART"; counterpartLabel: string | null; now: number }
): MarketNegotiationOffer {
    const live = row.status === "PENDING" && !(row.expiresAt && row.expiresAt.getTime() <= params.now);
    return {
        id: row.id,
        listingId: row.listing.id,
        listingTitle: row.listing.title,
        status: row.status,
        isCounter: row.counterOfId !== null,
        role: params.role,
        offeredKamas: row.offeredKamas,
        tradeDescription: row.tradeDescription,
        note: row.note,
        createdAt: row.createdAt.toISOString(),
        expiresAt: row.expiresAt ? row.expiresAt.toISOString() : null,
        counterpartLabel: params.counterpartLabel,
        // Répondre = être **la contrepartie** (§11.4) ; retirer = être l'**auteur**.
        canRespond: live && params.role === "COUNTERPART",
        canCancel: live && params.role === "AUTHOR",
    };
}

/** « Mes espaces » (S1.23 / S1.31) : mes annonces actives, mes archives et, depuis S4.10, mon centre de négociation. */
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

        // S4.10 — centre de négociation. Une seule règle de lecture, deux listes :
        //  • « reçues » : offres `PENDING` déposées par d'autres sur mes annonces ;
        //  • « mes offres » : celles dont je suis l'auteur (en cours **et**
        //    tranchées), **plus** les contre-offres qui me répondent — une
        //    contre-offre est écrite au nom de son auteur, pas du destinataire,
        //    donc c'est `counterOfId` qui dit « c'est à moi de répondre » (§11.4).
        const receivedRows = rows.length
            ? await db.marketOffer.findMany({
                  where: {
                      listingId: { in: rows.map((row) => row.id) },
                      status: "PENDING",
                      buyerProfileId: { not: user.profileId },
                  },
                  select: NEGOTIATION_OFFER_SELECT,
                  orderBy: [{ createdAt: "desc" }],
              })
            : [];

        const myOfferRows = await db.marketOffer.findMany({
            where: {
                buyerProfileId: user.profileId,
                listing: { guildId: guildConfig.id, deletedAt: null },
            },
            select: NEGOTIATION_OFFER_SELECT,
            orderBy: [{ createdAt: "desc" }],
            take: MARKET_NEGOTIATION_HISTORY_LIMIT,
        });

        const incomingRows = myOfferRows.length
            ? await db.marketOffer.findMany({
                  where: { counterOfId: { in: myOfferRows.map((offer) => offer.id) }, status: "PENDING" },
                  select: NEGOTIATION_OFFER_SELECT,
                  orderBy: [{ createdAt: "desc" }],
              })
            : [];

        // Pseudos des contreparties : `MarketOffer.buyerProfileId` n'a pas de
        // relation Prisma, une requête dédiée évite une jointure implicite (§13.7).
        const counterpartIds = Array.from(
            new Set(
                [...receivedRows, ...incomingRows]
                    .map((offer) => offer.buyerProfileId)
                    .filter((profileId) => profileId !== user.profileId)
            )
        );
        const counterpartProfiles = counterpartIds.length
            ? await db.userProfile.findMany({
                  where: { id: { in: counterpartIds } },
                  select: { id: true, pseudoDofus: true, discordNickname: true },
              })
            : [];
        const labelByProfileId = new Map(
            counterpartProfiles.map((profile) => [
                profile.id,
                profile.pseudoDofus?.trim() || profile.discordNickname?.trim() || null,
            ])
        );

        const now = Date.now();
        const receivedOffers = receivedRows.map((row) =>
            toNegotiationOffer(row, {
                role: "COUNTERPART",
                counterpartLabel: labelByProfileId.get(row.buyerProfileId) ?? null,
                now,
            })
        );
        const sentOffers = [
            ...myOfferRows.map((row) =>
                toNegotiationOffer(row, { role: "AUTHOR", counterpartLabel: null, now })
            ),
            ...incomingRows.map((row) =>
                toNegotiationOffer(row, {
                    role: "COUNTERPART",
                    counterpartLabel: labelByProfileId.get(row.buyerProfileId) ?? null,
                    now,
                })
            ),
        ];

        return { success: true, data: { active, archived, receivedOffers, sentOffers } };
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

/**
 * Annule une réservation `ACTIVE` — **acheteur ou vendeur** (§11.2).
 *
 * Le rôle n'est **jamais** transmis par le client : il est déduit des identités
 * résolues par le contexte serveur (§16.2). La garde de statut, la remise en
 * vente de l'annonce et les deux notifications §11.9 vivent dans
 * `cancelMarketReservationCore()`, partagé avec les interactions Discord (§13.4).
 */
export async function cancelMarketReservation(
    guildId: string,
    reservationId: string,
    reason?: string | null
): Promise<ActionResponse<{ cancelledBy: "BUYER" | "SELLER" }>> {
    try {
        const ctx = await resolveMarketContext(guildId);
        if ("error" in ctx) return { success: false, error: ctx.error };
        const { user, guildConfig } = ctx;
        if (!user.profileId) return { success: false, error: "Profil introuvable" };

        const parsed = z.string().min(1).max(64).safeParse(reservationId);
        if (!parsed.success) return { success: false, error: "Réservation introuvable" };

        const session = await auth();
        const outcome = await cancelMarketReservationCore({
            guildConfigId: guildConfig.id,
            reservationId: parsed.data,
            actorProfileId: user.profileId,
            actorUserId: session?.user?.id ?? user.id ?? "",
            reason: sanitizeMarketText(reason),
        });
        if (!outcome.ok) return { success: false, error: outcome.error };

        revalidatePath(`/dashboard/${guildId}/marche`);
        return { success: true, data: { cancelledBy: outcome.cancelledBy } };
    } catch (error) {
        logger.error("[cancelMarketReservation] failed", { err: error });
        return { success: false, error: "Erreur interne" };
    }
}


// ---------------------------------------------------------------------------
// OFFRES (S4.4 — §11.4 / §13.5)
// ---------------------------------------------------------------------------

/** Saisie d'offre du dashboard : kamas tolérants (`"12 500 k"`), 2 textes facultatifs. */
export type MarketOfferInput = {
    /** Montant saisi en texte (`KAMAS_MAX` §11.4) ; vide ⇒ aucun montant offert. */
    offeredKamas?: string | number | null;
    /** Troc proposé (facultatif). */
    tradeDescription?: string | null;
    /** Message au vendeur (facultatif). */
    note?: string | null;
};

/**
 * Crée une offre `PENDING` sur une annonce négociable (§11.4).
 *
 * La **règle métier** (« kamas > 0 **ou** troc non vide », plafond Int32, refus
 * de sa propre annonce, isolation de guilde, statut `ACTIVE`) vit **une seule
 * fois** dans `createMarketOfferCore()` — **partagé** avec la soumission de la
 * modale Discord (S4.4, §13.4). Cette action ne fait donc que : résoudre le
 * contexte serveur (§16.2), **normaliser** la saisie avec la même fonction pure
 * que Discord (`normalizeMarketOfferDraft`) et déléguer.
 */
export async function createMarketOffer(
    guildId: string,
    listingId: string,
    input: MarketOfferInput = {}
): Promise<ActionResponse<{ offerId: string }>> {
    try {
        const ctx = await resolveMarketContext(guildId);
        if ("error" in ctx) return { success: false, error: ctx.error };
        const { user, guildConfig } = ctx;
        if (!user.profileId) return { success: false, error: "Profil introuvable" };

        const parsed = z.string().min(1).max(64).safeParse(listingId);
        if (!parsed.success) return { success: false, error: "Annonce introuvable" };

        const draft = normalizeMarketOfferDraft({
            kamas:
                input.offeredKamas === null || input.offeredKamas === undefined
                    ? ""
                    : String(input.offeredKamas),
            trade: input.tradeDescription ?? "",
            note: input.note ?? "",
        });

        const session = await auth();
        const outcome = await createMarketOfferCore({
            guildConfigId: guildConfig.id,
            listingId: parsed.data,
            buyerProfileId: user.profileId,
            buyerUserId: session?.user?.id ?? user.id ?? "",
            negotiationsEnabled: guildConfig.marketNegotiationsEnabled,
            offerHours: guildConfig.marketOfferHours,
            offeredKamas: draft.offeredKamas,
            tradeDescription: draft.tradeDescription,
            note: draft.note,
            invalid: draft.invalid,
        });
        if (!outcome.ok) return { success: false, error: outcome.error };

        revalidatePath(`/dashboard/${guildId}/marche`);
        return { success: true, data: { offerId: outcome.offerId } };
    } catch (error) {
        logger.error("[createMarketOffer] failed", { err: error });
        return { success: false, error: "Erreur interne" };
    }
}


// ---------------------------------------------------------------------------
// RÉPONSE DU VENDEUR (S4.9 — §11.4 / §14.1)
// ---------------------------------------------------------------------------

/**
 * Répond à une offre reçue : `ACCEPT` (l'annonce passe `RESERVED` au prix de
 * l'offre, une réservation est créée, les autres offres expirent) ou `DECLINE`.
 *
 * Toute la règle — qui a le droit de répondre (le **vendeur** sur une offre
 * d'origine, l'auteur de l'offre référencée sur une contre-offre), offre encore
 * `PENDING`, offre non périmée, conflit de réservation/vente simultanée, journal,
 * embed et notifications (§11.9) — vit **une seule fois** dans
 * `respondToMarketOfferCore()`, partagé avec les interactions Discord (§13.4).
 *
 * S4.10 — `COUNTER` refuse l'offre courante et dépose une **contre-offre**
 * `PENDING` rattachée par `counterOfId` (§11.4). La saisie passe par la **même**
 * normalisation pure que la modale Discord (`normalizeMarketOfferDraft`).
 */
export async function respondToMarketOffer(
    guildId: string,
    offerId: string,
    decision: MarketOfferDecisionInput,
    counter: MarketOfferInput = {}
): Promise<
    ActionResponse<{
        status: "ACCEPTED" | "DECLINED" | "COUNTERED";
        reservationId?: string;
        expiresAt?: string;
        counterOfferId?: string;
    }>
> {
    try {
        const ctx = await resolveMarketContext(guildId);
        if ("error" in ctx) return { success: false, error: ctx.error };
        const { user, guildConfig } = ctx;
        if (!user.profileId) return { success: false, error: "Profil introuvable" };

        const parsed = z.string().min(1).max(64).safeParse(offerId);
        if (!parsed.success) return { success: false, error: "Offre introuvable" };
        const parsedDecision = z.enum(["ACCEPT", "DECLINE", "COUNTER"]).safeParse(decision);
        if (!parsedDecision.success) return { success: false, error: "Décision invalide" };

        // Le nettoyage de la contre-offre est fait **ici** (kamas tolérants
        // « 12 500 k », textes bornés) puis vérifié par le moteur : une saisie
        // illisible est refusée en clair, jamais ramenée en silence (§0.1).
        let counterDraft: MarketOfferCounterDraft | undefined;
        if (parsedDecision.data === "COUNTER") {
            const draft = normalizeMarketOfferDraft({
                kamas:
                    counter.offeredKamas === null || counter.offeredKamas === undefined
                        ? ""
                        : String(counter.offeredKamas),
                trade: counter.tradeDescription ?? "",
                note: counter.note ?? "",
            });
            counterDraft = {
                offeredKamas: draft.offeredKamas,
                tradeDescription: draft.tradeDescription,
                note: draft.note,
                invalid: draft.invalid,
            };
        }

        const session = await auth();
        const outcome = await respondToMarketOfferCore({
            guildConfigId: guildConfig.id,
            offerId: parsed.data,
            responderUserId: session?.user?.id ?? user.id ?? "",
            responderProfileId: user.profileId,
            decision: parsedDecision.data,
            reservationHours: guildConfig.marketReservationHours,
            offerHours: guildConfig.marketOfferHours,
            counter: counterDraft,
        });
        if (!outcome.ok) return { success: false, error: outcome.error };

        revalidatePath(`/dashboard/${guildId}/marche`);
        return {
            success: true,
            data: {
                status: outcome.status,
                reservationId: outcome.reservationId,
                expiresAt: outcome.expiresAt?.toISOString(),
                counterOfferId: outcome.counterOfferId,
            },
        };
    } catch (error) {
        logger.error("[respondToMarketOffer] failed", { err: error });
        return { success: false, error: "Erreur interne" };
    }
}

/**
 * Retire une offre que **j'ai déposée** (S4.10, §14.1) tant qu'elle est `PENDING`.
 *
 * Aucune notification n'est émise : §11.9 ne prévoit rien pour un retrait
 * volontaire et D30 interdit tout message privé. Le compteur public « N offre(s)
 * en cours » (S4.7) est réécrit après coup, sans jamais bloquer le membre.
 */
export async function cancelMarketOffer(
    guildId: string,
    offerId: string
): Promise<ActionResponse<{ offerId: string }>> {
    try {
        const ctx = await resolveMarketContext(guildId);
        if ("error" in ctx) return { success: false, error: ctx.error };
        const { user, guildConfig } = ctx;
        if (!user.profileId) return { success: false, error: "Profil introuvable" };

        const parsed = z.string().min(1).max(64).safeParse(offerId);
        if (!parsed.success) return { success: false, error: "Offre introuvable" };

        const session = await auth();
        const outcome = await cancelMarketOfferCore({
            guildConfigId: guildConfig.id,
            offerId: parsed.data,
            actorUserId: session?.user?.id ?? user.id ?? "",
        });
        if (!outcome.ok) return { success: false, error: outcome.error };

        revalidatePath(`/dashboard/${guildId}/marche`);
        return { success: true, data: { offerId: outcome.offerId } };
    } catch (error) {
        logger.error("[cancelMarketOffer] failed", { err: error });
        return { success: false, error: "Erreur interne" };
    }
}

// ---------------------------------------------------------------------------
// SIGNALEMENT (S4.11 — §6.9)
// ---------------------------------------------------------------------------

/** Motif de signalement validé (liste unique `MARKET_REPORT_REASONS`). */
export type MarketReportReasonInput = (typeof MARKET_REPORT_REASONS)[number];

/**
 * Signale une annonce (§6.9) : ouvre un **dossier de modération** avec l'état
 * de l'annonce **figé** (`snapshot`) et journalise `LISTING_REPORTED`.
 *
 * Un signalement ne sanctionne **jamais** automatiquement : il donne au
 * modérateur le contexte et l'accès au journal d'audit de l'annonce. Un membre
 * signale une seule fois par annonce, et **jamais la sienne** (§8.2).
 */
export async function reportMarketListing(
    guildId: string,
    listingId: string,
    reason: MarketReportReasonInput,
    details?: string | null
): Promise<ActionResponse<{ reportId: string }>> {
    try {
        const ctx = await resolveMarketContext(guildId);
        if ("error" in ctx) return { success: false, error: ctx.error };
        const { user, guildConfig } = ctx;
        if (!user.profileId) return { success: false, error: "Profil introuvable" };

        const parsed = z.string().min(1).max(64).safeParse(listingId);
        if (!parsed.success) return { success: false, error: "Annonce introuvable" };
        const parsedReason = z.enum(MARKET_REPORT_REASONS).safeParse(reason);
        if (!parsedReason.success) return { success: false, error: "Motif invalide" };

        const listing = await db.marketListing.findFirst({
            where: { id: parsed.data, guildId: guildConfig.id, deletedAt: null },
            select: {
                id: true,
                profileId: true,
                status: true,
                type: true,
                title: true,
                priceKamas: true,
                negotiable: true,
                renewCount: true,
                publishedAt: true,
                expiresAt: true,
            },
        });
        if (!listing) return { success: false, error: "Annonce introuvable" };
        if (listing.profileId === user.profileId) {
            return { success: false, error: "Tu ne peux pas signaler ta propre annonce." };
        }
        // Un brouillon n'est pas public : rien à signaler (§11.1).
        if (listing.status === "DRAFT") {
            return { success: false, error: "Cette annonce n'est pas encore publiée." };
        }

        const existing = await db.marketReport.findFirst({
            where: { listingId: listing.id, reporterProfileId: user.profileId },
            select: { status: true },
        });
        if (existing) {
            return {
                success: false,
                error:
                    existing.status === "CLOSED"
                        ? "Tu as déjà signalé cette annonce : le dossier est clos."
                        : "Tu as déjà signalé cette annonce — le dossier est ouvert.",
            };
        }

        const session = await auth();
        const actorUserId = session?.user?.id ?? user.id ?? "";
        const report = await db.marketReport.create({
            data: {
                listingId: listing.id,
                reporterUserId: actorUserId,
                reporterProfileId: user.profileId,
                reason: parsedReason.data,
                details: sanitizeMarketText(details),
                // Contexte **figé** : le modérateur juge l'état au moment des faits,
                // même si le vendeur modifie l'annonce entre-temps (§6.9).
                snapshot: {
                    title: listing.title,
                    type: listing.type,
                    status: listing.status,
                    priceKamas: listing.priceKamas,
                    negotiable: listing.negotiable,
                    renewCount: listing.renewCount,
                    publishedAt: listing.publishedAt,
                    expiresAt: listing.expiresAt,
                    sellerProfileId: listing.profileId,
                    capturedAt: new Date().toISOString(),
                },
            },
            select: { id: true },
        });

        await writeMarketAuditLog({
            guildId: guildConfig.id,
            listingId: listing.id,
            actorUserId,
            action: MARKET_AUDIT_ACTIONS.LISTING_REPORTED,
            nextData: { reportId: report.id, reason: parsedReason.data },
        });

        revalidatePath(`/dashboard/${guildId}/marche`);
        return { success: true, data: { reportId: report.id } };
    } catch (error) {
        logger.error("[reportMarketListing] failed", { err: error });
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


// ---------------------------------------------------------------------------
// CLÔTURE DE VENTE (S4.9 — §11.5)
// ---------------------------------------------------------------------------

/**
 * Confirme la vente d'une annonce `RESERVED` (§11.5) : **le vendeur seul**,
 * après confirmation explicite que l'échange a eu lieu en jeu.
 *
 * Effets (une transaction, gardes de statut dans le `WHERE` §11.3) : annonce
 * `SOLD`, réservation `COMPLETED`, offres restantes `EXPIRED`, journal
 * `LISTING_SOLD`, embed réécrit, acheteur notifié `MARKET_SOLD` (§11.9). Toute
 * la règle vit dans `completeMarketSaleCore()` (§13.4).
 */
export async function markMarketListingSold(
    guildId: string,
    listingId: string,
    confirmed: boolean
): Promise<ActionResponse<{ expiredOffers: number }>> {
    try {
        const ctx = await resolveMarketContext(guildId);
        if ("error" in ctx) return { success: false, error: ctx.error };
        const { user, guildConfig } = ctx;

        const parsed = z.string().min(1).max(64).safeParse(listingId);
        if (!parsed.success) return { success: false, error: "Annonce introuvable" };

        const session = await auth();
        const outcome = await completeMarketSaleCore({
            guildConfigId: guildConfig.id,
            listingId: parsed.data,
            sellerUserId: session?.user?.id ?? user.id ?? "",
            confirmed,
        });
        if (!outcome.ok) return { success: false, error: outcome.error };

        revalidatePath(`/dashboard/${guildId}/marche`);
        return { success: true, data: { expiredOffers: outcome.expiredOffers } };
    } catch (error) {
        logger.error("[markMarketListingSold] failed", { err: error });
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

