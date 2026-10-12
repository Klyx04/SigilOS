/**
 * Compteur d'accès God (A9) — **core serveur**, hors `"use server"`.
 *
 * A9 (« une seule trace ») : la visite du dashboard God ne crée **plus** une ligne
 * `AuditLog` par visite (elle noyait le journal — mesure du 25/09 : 749 lignes
 * `GOD_DASHBOARD_ACCESS`, soit **72 %** des 1 033 lignes du journal). La trace
 * reste la **session** (`GodSessionLog`, 1 ligne par session ouverte, pas par page
 * vue) — ce module en tire un **compteur agrégé par jour**.
 *
 * 🔒 Fail-closed : la fonction vérifie elle-même `isSuperAdmin()` (défense en
 * profondeur), même si son unique appelant est déjà la page `/god/logs`. Elle
 * n'est **pas** une server action (aucun export client) : la surface d'attaque
 * reste celle de la page.
 */

import { db } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { MS_PER_DAY } from "@/lib/audit-retention-policy";
import { dailyCounts, type DailyCount } from "@/lib/audit-log-view";

/** Fenêtre affichée par défaut (bornée : la rétention God est de 90 j). */
export const GOD_ACCESS_WINDOW_DAYS = 14;

export interface GodAccessStats {
    /** Compteur par jour UTC, du plus ancien au plus récent (jours vides = 0). */
    days: DailyCount[];
    /** Sessions God ouvertes dans la fenêtre. */
    total: number;
    /** Sessions encore actives à l'instant du relevé. */
    active: number;
}

export async function getGodAccessDailyStats({
    days = GOD_ACCESS_WINDOW_DAYS,
    now = new Date(),
}: { days?: number; now?: Date } = {}): Promise<GodAccessStats> {
    const empty: GodAccessStats = { days: [], total: 0, active: 0 };

    try {
        const { isSuperAdmin } = await import("@/server/actions/super-admin-actions");
        if (!(await isSuperAdmin())) return empty;

        const boundedDays = Math.min(Math.max(Math.trunc(days) || 1, 1), 90);
        const since = new Date(now.getTime() - boundedDays * MS_PER_DAY);

        // Lecture bornée : 1 ligne par session (495 en base au 25/09/2026) et par
        // fenêtre — jamais 1 ligne par page vue, c'est justement ce qu'on supprime.
        const sessions = await db.godSessionLog.findMany({
            where: { startedAt: { gte: since } },
            select: { startedAt: true, active: true },
        });

        return {
            days: dailyCounts(
                sessions.map((session) => session.startedAt),
                boundedDays,
                now,
            ),
            total: sessions.length,
            active: sessions.filter((session) => session.active).length,
        };
    } catch (error) {
        logger.error("[getGodAccessDailyStats] Error:", { error });
        return empty;
    }
}
