/**
 * Fan-out des notifications de **compte** à la publication d'un changelog
 * (rang 65, lot N2).
 *
 * Une publication God crée **une seule** notification par compte, jamais une par
 * guilde : le scope est `userId` + `guildId: null` (`accountNotificationScope`).
 * Les lots sont bornés pour ne pas charger toute la table `User` en mémoire et
 * pour laisser la main au reste du serveur.
 *
 * Ne lève jamais : l'appelant (action God) déclenche ce fan-out en `after()` et
 * une panne d'écriture ne doit pas transformer une publication réussie en échec.
 */

import { NotificationCategory, NotificationType } from "@prisma/client";
import { logger } from "@/lib/logger";
import { db } from "@/lib/prisma";
import { accountNotificationScope } from "@/server/account-notifications";

/** Comptes traités par `createMany` — borne mémoire et durée d'un lot. */
export const CHANGELOG_FANOUT_BATCH_SIZE = 500;

/** Borne de sécurité : 200 lots = 100 000 comptes par publication. */
export const CHANGELOG_FANOUT_MAX_BATCHES = 200;

/** Destination d'une notification de changelog : la boîte du compte (N3). */
export const CHANGELOG_NOTIFICATION_LINK = "/espace-visiteur/notifications";

export type ChangelogPublishedInput = {
    id: string;
    version: string;
    title: string;
    summary: string | null;
};

export type ChangelogFanoutResult = {
    success: boolean;
    sent: number;
};

/** Retire le balisage de l'éditeur riche : une notification est du texte brut. */
function toPlainText(html: string | null): string {
    if (!html) return "";
    return html
        .replace(/<[^>]*>/g, " ")
        .replace(/&nbsp;/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

/** Titre et message bornés aux limites de la boîte compte (160 / 1 000). */
function buildCopy(entry: ChangelogPublishedInput): { title: string; message: string } {
    const title = `Nouveauté SigilOS — ${entry.version}`.slice(0, 160);
    const summary = toPlainText(entry.summary).slice(0, 280);
    const message = `${entry.title}${summary ? `\n\n${summary}` : ""}`.slice(0, 1_000);
    return { title, message };
}

/**
 * Émet une notification de compte pour chaque `User`, par lots de 500.
 * Retourne `sent` pour la traçabilité ; une panne au lot N laisse les lots
 * précédents écrits (best-effort assumé).
 */
export async function notifyChangelogPublished(
    entry: ChangelogPublishedInput
): Promise<ChangelogFanoutResult> {
    const { title, message } = buildCopy(entry);
    let cursor: string | undefined;
    let sent = 0;

    try {
        for (let pass = 0; pass < CHANGELOG_FANOUT_MAX_BATCHES; pass += 1) {
            const users = await db.user.findMany({
                select: { id: true },
                orderBy: { id: "asc" },
                take: CHANGELOG_FANOUT_BATCH_SIZE,
                ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
            });

            if (users.length === 0) break;

            await db.notification.createMany({
                data: users.map((user) => ({
                    ...accountNotificationScope(user.id),
                    type: NotificationType.CHANGELOG_PUBLISHED,
                    category: NotificationCategory.SYSTEM,
                    title,
                    message,
                    link: CHANGELOG_NOTIFICATION_LINK,
                })),
            });

            sent += users.length;
            cursor = users[users.length - 1].id;

            if (users.length < CHANGELOG_FANOUT_BATCH_SIZE) break;
        }

        if (sent >= CHANGELOG_FANOUT_MAX_BATCHES * CHANGELOG_FANOUT_BATCH_SIZE) {
            logger.warn("[Changelog] fan-out tronqué à la borne de sécurité", {
                entryId: entry.id,
                sent,
            });
        }

        logger.info("[Changelog] notifications de compte émises", {
            entryId: entry.id,
            sent,
        });
        return { success: true, sent };
    } catch (error) {
        logger.error("[Changelog] fan-out des notifications impossible", {
            entryId: entry.id,
            sent,
            error: (error as Error).message,
        });
        return { success: false, sent };
    }
}
