"use server";

/**
 * Actions de la boîte **compte** (rang 65, lot N1).
 *
 * Le scope est résolu côté serveur : `userId` de session **+ `guildId: null`**.
 * Aucun identifiant de guilde n'entre dans ces actions, et le marquage ne peut
 * toucher que les notifications du propriétaire (la condition est dans le
 * `WHERE`, pas dans un contrôle après lecture).
 */

import { z } from "zod";
import { db } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { rateLimit } from "@/lib/ratelimit";
import { getPublicSession } from "@/server/public-account";
import { accountNotificationScope } from "@/server/account-notifications";
import { revalidatePath } from "next/cache";

const notificationIdSchema = z.string().trim().min(1).max(64);

/** Marquage unitaire : geste d'interface fréquent, plafond large. */
const READ_RATE_LIMIT = 60;
/** Tout marquer comme lu : mutation plus lourde, plafond resserré. */
const READ_ALL_RATE_LIMIT = 10;
/** Enregistrement de la préférence d'opt-out : geste rare. */
const PREFERENCE_RATE_LIMIT = 10;
const RATE_WINDOW_MS = 60_000;

export type AccountNotificationActionResult = {
    success: boolean;
    error?: string;
    count?: number;
};

/**
 * Marque **une** notification de compte comme lue.
 *
 * Sécurité : session visiteur (bannissement compris) → rate limit Redis →
 * `updateMany` avec `userId` de session et `guildId: null`. Une notification
 * d'une autre personne ou d'une guilde ne peut donc pas être marquée.
 */
export async function markAccountNotificationRead(
    notificationId: string
): Promise<AccountNotificationActionResult> {
    const parsed = notificationIdSchema.safeParse(notificationId);
    if (!parsed.success) {
        logger.warn("[Notification compte] identifiant invalide");
        return { success: false, error: "Notification invalide" };
    }

    const visitor = await getPublicSession();
    if (!visitor) {
        logger.warn("[Notification compte] marquage refusé : session absente");
        return { success: false, error: "Authentification requise" };
    }

    const limited = await rateLimit(
        `account-notifications:read:${visitor.userId}`,
        READ_RATE_LIMIT,
        RATE_WINDOW_MS
    );
    if (!limited.success) {
        logger.warn("[Notification compte] marquage refusé : rate limit");
        return { success: false, error: "Trop de requêtes. Réessaie dans une minute." };
    }

    try {
        const result = await db.notification.updateMany({
            where: {
                id: parsed.data,
                ...accountNotificationScope(visitor.userId),
            },
            data: { read: true },
        });

        if (result.count === 0) {
            return { success: false, error: "Notification introuvable" };
        }

        // La pastille vit dans la coque de l'espace visiteur.
        revalidatePath("/espace-visiteur", "layout");
        return { success: true };
    } catch (error) {
        logger.error("[Notification compte] marquage impossible", {
            error: (error as Error).message,
        });
        return { success: false, error: "Mise à jour impossible" };
    }
}

/**
 * Marque **toutes** les notifications de compte comme lues.
 * Idempotent : `count: 0` reste un succès.
 */
export async function markAllAccountNotificationsRead(): Promise<AccountNotificationActionResult> {
    const visitor = await getPublicSession();
    if (!visitor) {
        logger.warn("[Notification compte] marquage global refusé : session absente");
        return { success: false, error: "Authentification requise" };
    }

    const limited = await rateLimit(
        `account-notifications:read-all:${visitor.userId}`,
        READ_ALL_RATE_LIMIT,
        RATE_WINDOW_MS
    );
    if (!limited.success) {
        logger.warn("[Notification compte] marquage global refusé : rate limit");
        return { success: false, error: "Trop de requêtes. Réessaie dans une minute." };
    }

    try {
        const result = await db.notification.updateMany({
            where: {
                ...accountNotificationScope(visitor.userId),
                read: false,
            },
            data: { read: true },
        });

        revalidatePath("/espace-visiteur", "layout");
        return { success: true, count: result.count };
    } catch (error) {
        logger.error("[Notification compte] marquage global impossible", {
            error: (error as Error).message,
        });
        return { success: false, error: "Mise à jour impossible" };
    }
}

/**
 * Active ou coupe les notifications de **compte** (N2-bis).
 *
 * La préférence vit sur `User.accountNotificationsEnabled` ; elle est lue par
 * `createAccountNotification` et par le fan-out changelog. Désactiver ne
 * supprime pas les notifications déjà reçues.
 */
export async function setAccountNotificationsEnabled(
    enabled: boolean
): Promise<AccountNotificationActionResult> {
    const parsed = z.boolean().safeParse(enabled);
    if (!parsed.success) {
        return { success: false, error: "Valeur invalide" };
    }

    const visitor = await getPublicSession();
    if (!visitor) {
        logger.warn("[Notification compte] préférence refusée : session absente");
        return { success: false, error: "Authentification requise" };
    }

    const limited = await rateLimit(
        `account-notifications:prefs:${visitor.userId}`,
        PREFERENCE_RATE_LIMIT,
        RATE_WINDOW_MS
    );
    if (!limited.success) {
        logger.warn("[Notification compte] préférence refusée : rate limit");
        return { success: false, error: "Trop de requêtes. Réessaie dans une minute." };
    }

    try {
        await db.user.update({
            where: { id: visitor.userId },
            data: { accountNotificationsEnabled: parsed.data },
        });

        revalidatePath("/espace-visiteur", "layout");
        return { success: true };
    } catch (error) {
        logger.error("[Notification compte] préférence impossible à enregistrer", {
            error: (error as Error).message,
        });
        return { success: false, error: "Mise à jour impossible" };
    }
}
