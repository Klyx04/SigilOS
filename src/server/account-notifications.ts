/**
 * Notifications du **compte** — boîte personnelle, hors guilde (rang 65, lot N1).
 *
 * Le scope est **`userId` + `guildId: null`** : une boîte personnelle, jamais
 * « toutes les guildes ». Ce module ne passe ni par `buildGuildScopeFilter` ni par
 * `createNotification` : ces derniers sont fail-closed sans guilde, et le verrou
 * `notification-guild-isolation` doit rester intact. La boîte compte est une
 * **branche dédiée**, pas un assouplissement du filtre de guilde.
 *
 * Les anciennes lignes `guildId: null` (antérieures au 03/08/2026) sont hors
 * fenêtre : la purge quotidienne existante supprime les lues > 30 j et les non
 * lues > 90 j.
 *
 * Aucune donnée personnelle dans les logs (pas de snowflake, pas de pseudo).
 */

import { NotificationCategory, NotificationType, type Prisma } from "@prisma/client";
import { z } from "zod";
import { logger } from "@/lib/logger";
import { db } from "@/lib/prisma";
import {
    isNotificationImageKind,
    sanitizeNotificationImageUrl,
} from "@/lib/notification-categories";

/** Plafond de lecture : la boîte compte ne rend jamais plus de 50 lignes d'un coup. */
export const ACCOUNT_NOTIFICATION_MAX_TAKE = 50;

/** Plafond de pagination : borne une entrée appelante sans permettre de balayer la table. */
export const ACCOUNT_NOTIFICATION_MAX_SKIP = 5_000;

const accountNotificationInputSchema = z.object({
    userId: z.string().trim().min(1).max(64),
    type: z.nativeEnum(NotificationType),
    category: z.nativeEnum(NotificationCategory).default(NotificationCategory.SYSTEM),
    title: z.string().trim().min(1).max(160),
    message: z.string().trim().min(1).max(1_000),
    // Lien **interne** uniquement : une notification ne doit pas pouvoir pointer
    // vers un domaine tiers (même règle que l'assainissement des images).
    link: z
        .string()
        .trim()
        .max(300)
        .refine((value) => value.startsWith("/") && !value.startsWith("//"), {
            message: "Lien interne requis",
        })
        .nullable()
        .optional(),
    imageUrl: z.string().trim().max(512).nullable().optional(),
    imageKind: z.string().trim().max(40).nullable().optional(),
});

export type CreateAccountNotificationInput = z.input<typeof accountNotificationInputSchema>;

/** Ligne prête à afficher dans l'espace du compte. */
export type AccountNotificationView = {
    id: string;
    title: string;
    message: string;
    type: NotificationType;
    category: NotificationCategory;
    read: boolean;
    link: string | null;
    createdAt: Date;
    /** Avatar Discord du destinataire (`User.image`) — `null` ⇒ picto de catégorie. */
    actorImage: string | null;
    /** Asset de l'objet annoncé — `null` ⇒ picto de catégorie. */
    imageUrl: string | null;
    /** Ce que l'asset représente (`NotificationImageKind`). */
    imageKind: string | null;
};

export type AccountNotificationPage = {
    items: AccountNotificationView[];
    total: number;
    unread: number;
};

export type AccountNotificationListOptions = {
    take?: number;
    skip?: number;
};

type AccountNotificationRow = Prisma.NotificationGetPayload<{
    include: { user: { select: { image: true } } };
}>;

function toAccountNotificationView(row: AccountNotificationRow): AccountNotificationView {
    return {
        id: row.id,
        title: row.title,
        message: row.message,
        type: row.type,
        category: row.category,
        read: row.read,
        link: row.link,
        createdAt: row.createdAt,
        actorImage: row.user?.image ?? null,
        imageUrl: row.imageUrl,
        imageKind: row.imageKind,
    };
}

function emptyPage(): AccountNotificationPage {
    return { items: [], total: 0, unread: 0 };
}

/** Entier borné ; une valeur absente ou non finie retombe sur le défaut. */
function boundedInt(value: number | undefined, fallback: number, min: number, max: number): number {
    if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
    return Math.min(Math.max(Math.trunc(value), min), max);
}

/**
 * Filtre de la boîte **compte** : propriétaire + `guildId: null`.
 *
 * Une seule définition, utilisée par les lectures et par les marquages. Les
 * actions importent cette fonction au lieu de réécrire le littéral : une action
 * `"use server"` ne porte alors aucun `guildId`, ce qui évite de la confondre
 * avec une action cloisonnée par guilde (verrou `guild-actions-rbac`).
 */
export function accountNotificationScope(userId: string) {
    return { userId, guildId: null } as const;
}

/**
 * Dépose une notification dans la boîte **compte** (`guildId: null`).
 *
 * Ne lève jamais : une émission de changelog ou une réponse God ne doit pas
 * échouer parce que la notification n'a pas pu être écrite (best-effort).
 */
export async function createAccountNotification(
    input: CreateAccountNotificationInput
): Promise<{ success: boolean; id?: string; skipped?: boolean }> {
    const parsed = accountNotificationInputSchema.safeParse(input);
    if (!parsed.success) {
        logger.warn("[Notification compte] entrée invalide", {
            issues: parsed.error.issues.length,
        });
        return { success: false };
    }

    const data = parsed.data;

    // Opt-out (N2-bis) : le compte peut couper **toutes** les notifications de
    // compte. Une préférence illisible annule l'envoi (fail-closed) : on ne veut
    // pas écrire une notification à quelqu'un qui l'a peut-être désactivée.
    let enabled: boolean;
    try {
        const user = await db.user.findUnique({
            where: { id: data.userId },
            select: { accountNotificationsEnabled: true },
        });
        enabled = user?.accountNotificationsEnabled ?? true;
    } catch (error) {
        logger.error("[Notification compte] préférence illisible — envoi annulé", {
            error: (error as Error).message,
        });
        return { success: false };
    }

    if (!enabled) return { success: true, skipped: true };

    try {
        const row = await db.notification.create({
            data: {
                userId: data.userId,
                // Scope **compte** : `guildId` nul est le marqueur explicite de la
                // boîte personnelle. Aucun `guildId` client n'entre ici.
                guildId: null,
                type: data.type,
                category: data.category,
                title: data.title,
                message: data.message,
                link: data.link ?? null,
                imageUrl: sanitizeNotificationImageUrl(data.imageUrl),
                imageKind: isNotificationImageKind(data.imageKind) ? data.imageKind : null,
            },
            select: { id: true },
        });
        return { success: true, id: row.id };
    } catch (error) {
        logger.error("[Notification compte] écriture impossible", {
            error: (error as Error).message,
        });
        return { success: false };
    }
}

/**
 * Liste la boîte compte d'une personne : `userId` **de session** + `guildId: null`.
 * Aucune autre guilde n'entre dans ce `where`.
 */
export async function listAccountNotifications(
    userId: string,
    options: AccountNotificationListOptions = {}
): Promise<AccountNotificationPage> {
    const owner = userId?.trim();
    if (!owner || owner.length > 64) return emptyPage();

    const take = boundedInt(
        options.take,
        ACCOUNT_NOTIFICATION_MAX_TAKE,
        1,
        ACCOUNT_NOTIFICATION_MAX_TAKE
    );
    const skip = boundedInt(options.skip, 0, 0, ACCOUNT_NOTIFICATION_MAX_SKIP);

    try {
        const [rows, total, unread] = await Promise.all([
            db.notification.findMany({
                where: accountNotificationScope(owner),
                orderBy: { createdAt: "desc" },
                take,
                skip,
                include: { user: { select: { image: true } } },
            }),
            db.notification.count({ where: accountNotificationScope(owner) }),
            countUnreadAccountNotifications(owner),
        ]);

        return {
            items: rows.map(toAccountNotificationView),
            total,
            unread,
        };
    } catch (error) {
        logger.error("[Notification compte] lecture impossible", {
            error: (error as Error).message,
        });
        return emptyPage();
    }
}

/** Nombre de notifications non lues dans la boîte compte, ou `0` en cas de panne. */
export async function countUnreadAccountNotifications(userId: string): Promise<number> {
    const owner = userId?.trim();
    if (!owner || owner.length > 64) return 0;

    try {
        return await db.notification.count({
            where: { ...accountNotificationScope(owner), read: false },
        });
    } catch (error) {
        logger.error("[Notification compte] comptage impossible", {
            error: (error as Error).message,
        });
        return 0;
    }
}

/**
 * Préférence d'opt-out du compte (N2-bis).
 *
 * Utilisée par la page Réglages. En cas de panne de lecture, on rend `true`
 * (défaut de la colonne) : l'écran ne doit pas afficher un opt-out qui n'existe
 * pas. Le chemin d'**écriture** reste fail-closed (`createAccountNotification`).
 */
export async function getAccountNotificationsEnabled(userId: string): Promise<boolean> {
    const owner = userId?.trim();
    if (!owner || owner.length > 64) return true;

    try {
        const user = await db.user.findUnique({
            where: { id: owner },
            select: { accountNotificationsEnabled: true },
        });
        return user?.accountNotificationsEnabled ?? true;
    } catch (error) {
        logger.error("[Notification compte] lecture de la préférence impossible", {
            error: (error as Error).message,
        });
        return true;
    }
}
