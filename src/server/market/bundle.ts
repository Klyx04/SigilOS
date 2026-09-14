/**
 * 🧺 Marché — moteur **lot multiple** (côté serveur, décision user 14/09/2026).
 *
 * ⚠️ Toute la **logique métier pure** vit dans `src/lib/market/bundle.ts`
 * (bornes, prix par objet, avancement, dérivation du statut) : ce fichier ne
 * contient que les transitions **atomiques** en base.
 *
 * Règle d'or de la réservation : le contrôle de disponibilité est porté par le
 * **`WHERE`** de l'`updateMany` (`status = 'AVAILABLE'`), jamais par un
 * « lire puis écrire ». Deux clics simultanés ⇒ un seul passe (`count === 1`),
 * l'autre reçoit `ALREADY_RESERVED` (S4.10 : testé avec 2 comptes).
 *
 * Isolation §16.2 : `guildId` = **id interne** de `GuildConfig` (jamais le
 * snowflake), et chaque `where` porte l'id **lu**, pas la valeur reçue du client.
 */

import { db } from "@/lib/prisma";
import {
    deriveBundleListingStatus,
    type BundleItemInput,
    bundleItemsSchema,
    computeBundleTotal,
} from "@/lib/market/bundle";
import { writeMarketAuditLog } from "@/server/market/audit";

/** Motifs typés d'un refus de moteur (miroir des moteurs existants). */
export type BundleCoreReason =
    | "NOT_FOUND"
    | "OWN_LISTING"
    | "NOT_AVAILABLE"
    | "ALREADY_RESERVED"
    | "SOLD"
    | "CONFLICT"
    | "INVALID"
    | "ERROR";

export type BundleCoreResult<T> =
    | { success: true; data: T }
    | { success: false; reason: BundleCoreReason; error: string };

/** Durée d'une réservation (le cron `market-expire` libère ensuite, §15.1). */
function reservationExpiry(hours: number): Date {
    return new Date(Date.now() + Math.max(1, hours) * 3_600_000);
}








/**
 * Crée une annonce **`BUNDLE`** et ses objets (2 à 5, prix **par objet**).
 *
 * Aucun prix n'est écrit sur l'annonce : `priceKamas` de la ligne
 * `MarketListing` reste `NULL` (le total du lot est la **somme** des objets,
 * recalculée côté serveur via `computeBundleTotal`, jamais reçue du client).
 */
export async function createBundleListingCore(params: {
    guildId: string;
    profileId: string;
    userId: string;
    title: string;
    description?: string | null;
    items: BundleItemInput[];
    publish?: boolean;
    expiresAt?: Date | null;
}): Promise<BundleCoreResult<{ listingId: string; componentIds: string[]; totalKamas: number }>> {
    const parsed = bundleItemsSchema.safeParse(params.items);
    if (!parsed.success) {
        return { success: false, reason: "INVALID", error: parsed.error.issues[0]?.message ?? "Lot invalide" };
    }

    const title = params.title.trim();
    if (title.length === 0) {
        return { success: false, reason: "INVALID", error: "Le titre du lot est obligatoire." };
    }

    const items = parsed.data;
    const totalKamas = computeBundleTotal(items);

    try {
        const listing = await db.marketListing.create({
            data: {
                guildId: params.guildId,
                profileId: params.profileId,
                userId: params.userId,
                type: "BUNDLE",
                status: params.publish ? "ACTIVE" : "DRAFT",
                title,
                description: params.description?.trim() || null,
                // Un lot ne porte ni prix global ni quantité globale : tout vit sur les objets.
                priceKamas: null,
                quantity: null,
                negotiable: true,
                acceptsTrade: false,
                publishedAt: params.publish ? new Date() : null,
                expiresAt: params.expiresAt ?? null,
            },
            select: { id: true },
        });

        await db.marketListingComponent.createMany({
            data: items.map((item, index) => ({
                listingId: listing.id,
                position: index,
                dofusDbItemId: item.dofusDbItemId ?? null,
                name: item.name,
                iconUrl: item.iconUrl ?? null,
                quantity: item.quantity,
                unitLabel: item.unitLabel ?? null,
                priceKamas: item.priceKamas,
                status: "AVAILABLE",
            })),
        });

        const components = await db.marketListingComponent.findMany({
            where: { listingId: listing.id },
            orderBy: { position: "asc" },
            select: { id: true },
        });

        await writeMarketAuditLog({
            guildId: params.guildId,
            listingId: listing.id,
            actorUserId: params.userId,
            action: "BUNDLE_CREATED",
            nextData: { itemCount: items.length, totalKamas },
            reason: "Création d'un lot multiple",
        });

        return {
            success: true,
            data: { listingId: listing.id, componentIds: components.map((c) => c.id), totalKamas },
        };
    } catch (error) {
        return {
            success: false,
            reason: "ERROR",
            error: error instanceof Error ? error.message : "Création du lot impossible",
        };
    }
}

/**
 * Réserve **un objet** d'un lot, au prix de **cet objet**.
 *
 * Disponibilité portée par le `WHERE` de l'`updateMany` (`status: "AVAILABLE"`)
 * ⇒ deux clics simultanés : un seul obtient `count === 1`, l'autre reçoit
 * `ALREADY_RESERVED`. Si la création de la réservation échoue, l'objet est
 * **libéré en compensation** (jamais d'objet verrouillé sans réservation).
 */
export async function reserveBundleComponentCore(params: {
    guildId: string;
    listingId: string;
    componentId: string;
    buyerProfileId: string;
    buyerUserId: string;
    reservationHours: number;
    now?: Date;
}): Promise<BundleCoreResult<{ reservationId: string; priceKamas: number; expiresAt: Date }>> {
    const now = params.now ?? new Date();

    const component = await db.marketListingComponent.findFirst({
        where: { id: params.componentId, listingId: params.listingId },
        select: {
            id: true,
            priceKamas: true,
            status: true,
            listing: { select: { guildId: true, profileId: true, status: true } },
        },
    });
    if (!component || component.listing.guildId !== params.guildId) {
        return { success: false, reason: "NOT_FOUND", error: "Objet introuvable." };
    }
    if (component.listing.profileId === params.buyerProfileId) {
        return { success: false, reason: "OWN_LISTING", error: "Impossible de réserver son propre lot." };
    }
    if (component.listing.status !== "ACTIVE" && component.listing.status !== "RESERVED") {
        return { success: false, reason: "NOT_AVAILABLE", error: "Ce lot n'est plus disponible." };
    }

    // ⚠️ Garde atomique : `status = 'AVAILABLE'` DANS le where (jamais lire-puis-écrire).
    const claim = await db.marketListingComponent.updateMany({
        where: { id: component.id, listingId: params.listingId, status: "AVAILABLE" },
        data: { status: "RESERVED", reservedAt: now },
    });
    if (claim.count === 0) {
        const current = await db.marketListingComponent.findFirst({
            where: { id: component.id },
            select: { status: true },
        });
        const sold = current?.status === "SOLD";
        return {
            success: false,
            reason: sold ? "SOLD" : "ALREADY_RESERVED",
            error: sold ? "Cet objet a déjà été vendu." : "Cet objet vient d'être réservé.",
        };
    }

    const expiresAt = reservationExpiry(params.reservationHours);
    try {
        const reservation = await db.marketReservation.create({
            data: {
                listingId: params.listingId,
                componentId: component.id,
                buyerProfileId: params.buyerProfileId,
                buyerUserId: params.buyerUserId,
                status: "ACTIVE",
                expiresAt,
            },
            select: { id: true },
        });

        await db.marketListing.updateMany({
            where: { id: params.listingId, status: "ACTIVE" },
            data: { status: "RESERVED", lastActivityAt: now },
        });

        await writeMarketAuditLog({
            guildId: params.guildId,
            listingId: params.listingId,
            actorUserId: params.buyerUserId,
            action: "BUNDLE_COMPONENT_RESERVED",
            nextData: { componentId: component.id, priceKamas: component.priceKamas ?? 0 },
            reason: "Objet d'un lot réservé",
        });

        return {
            success: true,
            data: { reservationId: reservation.id, priceKamas: component.priceKamas ?? 0, expiresAt },
        };
    } catch (error) {
        await db.marketListingComponent.updateMany({
            where: { id: component.id, status: "RESERVED" },
            data: { status: "AVAILABLE", reservedAt: null },
        });
        return {
            success: false,
            reason: "ERROR",
            error: error instanceof Error ? error.message : "Réservation impossible",
        };
    }
}

/** Libère un objet (§15.1) : objet `AVAILABLE` + réservation clôturée (motif fourni). */
export async function releaseBundleComponentCore(params: {
    guildId: string;
    listingId: string;
    componentId: string;
    reservationStatus: "CANCELLED_BY_BUYER" | "CANCELLED_BY_SELLER" | "EXPIRED";
    actorUserId?: string | null;
    reason?: string | null;
    now?: Date;
}): Promise<BundleCoreResult<{ released: number }>> {
    const now = params.now ?? new Date();
    const listing = await db.marketListing.findFirst({
        where: { id: params.listingId, guildId: params.guildId },
        select: { id: true },
    });
    if (!listing) return { success: false, reason: "NOT_FOUND", error: "Lot introuvable." };

    const released = await db.marketListingComponent.updateMany({
        where: { id: params.componentId, listingId: params.listingId, status: "RESERVED" },
        data: { status: "AVAILABLE", reservedAt: null },
    });
    await db.marketReservation.updateMany({
        where: { componentId: params.componentId, status: "ACTIVE" },
        data: {
            status: params.reservationStatus,
            cancelledAt: params.reservationStatus === "EXPIRED" ? null : now,
            cancelledByUserId: params.actorUserId ?? null,
            cancellationReason: params.reason ?? null,
        },
    });
    if (released.count > 0) {
        await refreshBundleListingStatusCore({
            listingId: params.listingId,
            guildId: params.guildId,
            now,
        });
    }
    await writeMarketAuditLog({
        guildId: params.guildId,
        listingId: params.listingId,
        actorUserId: params.actorUserId ?? null,
        action: "BUNDLE_COMPONENT_RELEASED",
        nextData: { componentId: params.componentId, released: released.count },
        reason: params.reason ?? params.reservationStatus,
    });
    return { success: true, data: { released: released.count } };
}

/** Redérive le statut de l'annonce depuis ses objets ⇒ `true` si tout est vendu. */
export async function refreshBundleListingStatusCore(params: {
    guildId: string;
    listingId: string;
    now?: Date;
}): Promise<boolean> {
    const components = await db.marketListingComponent.findMany({
        where: { listingId: params.listingId },
        select: { status: true },
    });
    const derived = deriveBundleListingStatus(components);
    const at = params.now ?? new Date();
    await db.marketListing.updateMany({
        where: { id: params.listingId, guildId: params.guildId, status: { in: ["ACTIVE", "RESERVED"] } },
        data: { status: derived, lastActivityAt: at, ...(derived === "SOLD" ? { soldAt: at } : {}) },
    });
    return derived === "SOLD";
}

/**
 * Cron `market-expire` (§15.1) : libère les objets dont la réservation a expiré.
 * Bornée (`take`) et idempotente (`status: "ACTIVE"` uniquement).
 */
export async function expireBundleComponentsCore(params: {
    limit?: number;
    guildId?: string;
    now?: Date;
}): Promise<{ expired: number; listingIds: string[] }> {
    const now = params.now ?? new Date();
    const limit = Math.min(Math.max(params.limit ?? 100, 1), 500);
    const stale = await db.marketReservation.findMany({
        where: {
            status: "ACTIVE",
            expiresAt: { lt: now },
            componentId: { not: null },
            ...(params.guildId ? { listing: { guildId: params.guildId } } : {}),
        },
        select: { componentId: true, listingId: true, listing: { select: { guildId: true } } },
        orderBy: { expiresAt: "asc" },
        take: limit,
    });

    let expired = 0;
    const listingIds = new Set<string>();
    for (const reservation of stale) {
        if (!reservation.componentId) continue;
        const result = await releaseBundleComponentCore({
            guildId: reservation.listing.guildId,
            listingId: reservation.listingId,
            componentId: reservation.componentId,
            reservationStatus: "EXPIRED",
            reason: "Réservation expirée",
            now,
        });
        if (result.success && result.data.released > 0) {
            expired += 1;
            listingIds.add(reservation.listingId);
        }
    }
    return { expired, listingIds: [...listingIds] };
}
export async function settleBundleComponentCore(params: {
    guildId: string;
    listingId: string;
    componentId: string;
    actorUserId?: string | null;
    now?: Date;
}): Promise<BundleCoreResult<{ listingSold: boolean }>> {
    const now = params.now ?? new Date();
    const listing = await db.marketListing.findFirst({
        where: { id: params.listingId, guildId: params.guildId },
        select: { id: true },
    });
    if (!listing) return { success: false, reason: "NOT_FOUND", error: "Lot introuvable." };

    const settled = await db.marketListingComponent.updateMany({
        where: { id: params.componentId, listingId: params.listingId, status: "RESERVED" },
        data: { status: "SOLD", soldAt: now },
    });
    if (settled.count === 0) {
        return {
            success: false,
            reason: "NOT_AVAILABLE",
            error: "Cet objet n'est pas en cours de réservation.",
        };
    }
    await db.marketReservation.updateMany({
        where: { componentId: params.componentId, status: "ACTIVE" },
        data: { status: "COMPLETED", completedAt: now },
    });
    const listingSold = await refreshBundleListingStatusCore({
        listingId: params.listingId,
        guildId: params.guildId,
        now,
    });
    await writeMarketAuditLog({
        guildId: params.guildId,
        listingId: params.listingId,
        actorUserId: params.actorUserId ?? null,
        action: "BUNDLE_COMPONENT_SOLD",
        nextData: { componentId: params.componentId, listingSold },
        reason: "Objet d'un lot vendu",
    });
    return { success: true, data: { listingSold } };
}
