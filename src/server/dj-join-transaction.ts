/**
 * Transactions **sérialisables** du Dungeon Finder.
 *
 * La place d'un groupe est un **compteur calculé** (`ACCEPTED + créateur` vs
 * `maxMembers`) : deux inscriptions simultanées sur la dernière place lisaient le même
 * compte, puis écrivaient toutes les deux (groupe affiché 5/4). En `Serializable`,
 * PostgreSQL fait avorter l'une des deux (SQLSTATE **40001**, mesuré le 30/10/2026) et le
 * rejeu la fait repasser par la décision — qui voit alors la place prise et envoie le
 * joueur en file d'attente.
 *
 * ⚠️ Les effets de bord (notification, embed Discord, miroir agenda) restent **hors** de
 * la transaction : une transaction rejouée ne doit jamais envoyer deux fois un message.
 */
import { db } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { retryOnWriteConflict, WRITE_CONFLICT_ATTEMPTS } from "@/lib/retry-write-conflict";

/** Tentatives d'une transaction DJ (conflit de sérialisation uniquement). */
export const DJ_TX_ATTEMPTS = WRITE_CONFLICT_ATTEMPTS;

/**
 * Exécute `run` dans une transaction `Serializable`, rejouée sur conflit d'écriture.
 * `tx` est le client transactionnel Prisma (mêmes modèles que `db`).
 */
export async function withDjSerializableTransaction<T>(run: (tx: any) => Promise<T>): Promise<T> {
    return retryOnWriteConflict(
        () =>
            db.$transaction((tx) => run(tx as any), {
                isolationLevel: "Serializable",
                maxWait: 5_000,
                timeout: 10_000,
            }),
        {
            attempts: DJ_TX_ATTEMPTS,
            waitBeforeRetry: async (attempt) => {
                logger.warn("[DJ tx] conflit de sérialisation — nouvelle tentative", { attempt });
                // Laisse la transaction gagnante finir son commit avant de relire.
                await new Promise((resolve) => setTimeout(resolve, attempt * 15));
            },
        }
    );
}
