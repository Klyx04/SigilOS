/**
 * Dernière activité **authentifiée** (D-A, décision du 02/11/2026).
 *
 * 📌 Pourquoi : les sessions sont en **JWT** (`src/auth.ts`), donc aucune date de dernière
 * connexion n'existait en base. La rétention des comptes ne mesurait que l'**âge du compte**
 * (`createdAt`) et pouvait effacer quelqu'un qui s'était connecté la veille.
 *
 * 🚦 **Throttle Redis** (`SET NX EX 3600`) : une écriture en base **au plus une fois par heure**
 * et par personne, même si `getUserContext` est appelé à chaque page. Un échec d'écriture libère
 * la clé pour ne pas perdre une heure de mesure.
 *
 * Best-effort assumé : cette fonction **ne jette jamais** et ne bloque jamais une requête.
 */
import { db } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { redis } from "@/lib/redis";

const THROTTLE_SECONDS = 60 * 60;

function throttleKey(userId: string): string {
    return `last-seen:${userId}`;
}

/** Écrit `User.lastSeenAt` si l'heure n'a pas déjà été marquée. Retourne `true` si écrit. */
export async function touchLastSeen(userId: string, now: Date = new Date()): Promise<boolean> {
    if (!userId) return false;

    try {
        const claimed = await redis.set(throttleKey(userId), "1", "EX", THROTTLE_SECONDS, "NX");
        if (claimed !== "OK") return false;
    } catch (error) {
        logger.warn("[last-seen] throttle Redis indisponible", {
            err: error instanceof Error ? error.message : String(error),
        });
        return false;
    }

    try {
        await db.user.updateMany({ where: { id: userId }, data: { lastSeenAt: now } });
        return true;
    } catch (error) {
        // On rend la clé : la prochaine requête réessaiera au lieu d'attendre une heure.
        await redis.del(throttleKey(userId)).catch(() => undefined);
        logger.warn("[last-seen] écriture ignorée", {
            err: error instanceof Error ? error.message : String(error),
        });
        return false;
    }
}
