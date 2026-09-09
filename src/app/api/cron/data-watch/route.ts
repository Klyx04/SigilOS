import { NextResponse } from 'next/server';
import { verifyCronSecret } from "@/lib/cron-auth";
import { db } from "@/lib/prisma";
import { logger } from "@/lib/logger";

export const dynamic = 'force-dynamic';

const DOFUSDB_API = "https://api.dofusdb.fr";

async function remoteTotal(endpoint: string): Promise<number | null> {
    try {
        const res = await fetch(`${DOFUSDB_API}/${endpoint}?$limit=1`, {
            headers: { Accept: "application/json", "User-Agent": "SigilOS/1.0 (+https://sigilos.fr)" },
            signal: AbortSignal.timeout(10_000),
        });
        if (!res.ok) return null;
        const json = await res.json();
        return typeof json?.total === "number" ? json.total : null;
    } catch {
        return null;
    }
}

/**
 * 🔭 CRON hebdo (dimanches) : guette les NOUVEAUTÉS DofusDB — dry-run uniquement.
 * Compare les totaux distants (items, quêtes, donjons) aux stocks locaux et
 * réutilise le diff quêtes existant. ZÉRO écriture : en cas d'écart, simple
 * alerte God avec les chiffres (un God synchronise ensuite via les onglets).
 * Télémétrie enregistrée dans tous les cas (même "rien à signaler").
 *
 * 🔒 Protégé par verifyCronSecret (x-cron-secret).
 */
export async function GET(req: Request) {
    if (!verifyCronSecret(req)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const startedAt = Date.now();

    try {
        const [remoteItems, remoteQuests, remoteDungeons] = await Promise.all([
            remoteTotal("items"),
            remoteTotal("quests"),
            remoteTotal("dungeons"),
        ]);

        const [localItems, localDungeons] = await Promise.all([
            (db as any).gameItem.count({ where: { isDeprecated: false } }).catch(() => null),
            (db as any).dungeon.count().catch(() => null),
        ]);

        // Diff quêtes détaillé (NEW/MODIFIED) via le comparateur existant (lecture seule).
        let questNew = 0;
        let questModified = 0;
        try {
            const { computeQuestDeltas } = await import("@/server/actions/game-quest-sync-actions");
            const deltasRes = await computeQuestDeltas();
            if (deltasRes.success && deltasRes.data) {
                const deltas = deltasRes.data.deltas as { type: string }[];
                questNew = deltas.filter((d) => d.type === "NEW").length;
                questModified = deltas.filter((d) => d.type === "MODIFIED").length;
            }
        } catch (e) {
            logger.warn("[Cron:DataWatch] Diff quêtes impossible:", { error: String(e) });
        }

        const parts: string[] = [];
        if (remoteItems !== null && localItems !== null && remoteItems !== localItems) {
            parts.push(`${Math.abs(remoteItems - localItems)} items (distant ${remoteItems} vs local ${localItems})`);
        }
        if (questNew > 0) parts.push(`${questNew} nouvelle(s) quête(s)`);
        if (questModified > 0) parts.push(`${questModified} quête(s) modifiée(s)`);
        if (remoteDungeons !== null && localDungeons !== null && remoteDungeons !== localDungeons) {
            parts.push(`${Math.abs(remoteDungeons - localDungeons)} donjons (distant ${remoteDungeons} vs local ${localDungeons})`);
        }

        const hasNews = parts.length > 0;
        const summary = hasNews
            ? `Nouveautés détectées : ${parts.join(" · ")}`
            : "Rien à signaler (stocks alignés)";

        if (hasNews) {
            const { notifyGod } = await import("@/server/actions/god-notif-actions");
            await notifyGod({
                title: "🆕 Nouveautés DofusDB détectées",
                message: `${summary}. Dry-run hebdo — rien n'a été synchronisé automatiquement : voir onglets Items/Quêtes/Siphon.`,
                type: "SYSTEM",
                success: true,
                metadata: { remoteItems, localItems, questNew, questModified, remoteDungeons, localDungeons },
            });
        }

        const { recordCronExecution } = await import("@/lib/cron-telemetry");
        await recordCronExecution("data_watch", {
            success: true,
            durationMs: Date.now() - startedAt,
            summary,
            details: { remoteItems, localItems, questNew, questModified, remoteDungeons, localDungeons },
        });

        return NextResponse.json({ success: true, hasNews, summary });
    } catch (e: any) {
        logger.error("[Cron:DataWatch] Erreur:", e);
        const { recordCronExecution } = await import("@/lib/cron-telemetry");
        await recordCronExecution("data_watch", {
            success: false,
            durationMs: Date.now() - startedAt,
            summary: `Erreur: ${e.message}`,
        });
        return NextResponse.json({ error: e.message || "Internal Error" }, { status: 500 });
    }
}
