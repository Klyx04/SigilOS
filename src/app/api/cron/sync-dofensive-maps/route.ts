import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import { verifyCronSecret } from "@/lib/cron-auth";
import { logger } from "@/lib/logger";
import { createSystemAuditLog, syncDofensiveMaps } from "@/lib/dofensive-sync";

/**
 * 🗺️ CRON quotidien : synchronisation locale des maps et donjons Dofensive.
 * Siphonne et met à jour les données dans PostgreSQL pour permettre un fonctionnement
 * local-first sans requêter Dofensive en direct.
 *
 * 🔒 Sécurité : Protégé par verifyCronSecret (x-cron-secret / Authorization Bearer).
 */
export async function GET(req: Request) {
    if (!verifyCronSecret(req)) {
        // 🔎 Télémétrie du refus (throttlée Redis 1×/10 min, sans secret) : le panneau
        // God « Tâches CRON » affichait « Inconnu — Aucune exécution récente » alors que
        // la tâche était déclenchée mais rejetée en 401 (secret de crontab absent/erroné
        // ou URL d'un autre environnement). Le panneau montre désormais « Refusé (401) »,
        // comme `market-expire` — plus de faux « jamais exécuté ».
        const { recordCronRefusal } = await import("@/lib/cron-telemetry");
        await recordCronRefusal("sync_dofensive_maps");
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const startedAt = Date.now();

    try {
        const result = await syncDofensiveMaps();
        logger.info("[Cron:SyncDofensiveMaps] Synchronisation terminée:", result);

        // Visibilité dans le Dashboard GOD (Audit Logs & Alertes) — sans session utilisateur.
        await createSystemAuditLog({
            cron: "sync-dofensive-maps",
            targetId: "sync-dofensive-maps",
            synced: result.synced,
            unchanged: result.unchanged,
            skippedFresh: result.skippedFresh,
            errorsCount: result.errors.length,
            errors: result.errors.slice(0, 5),
        });

        // Envoi d'une alerte/notification God
        const { notifyGod } = await import("@/server/actions/god-notif-actions");
        await notifyGod({
            title: "Siphon Maps Dofensive terminé",
            message: `${result.synced} maps synchronisées, ${result.unchanged} inchangées (${result.errors.length} erreurs).`,
            type: "WORKER_SYNC",
            success: result.errors.length === 0,
            metadata: {
                synced: result.synced,
                unchanged: result.unchanged,
                skippedFresh: result.skippedFresh,
                errorsCount: result.errors.length,
            },
        });

        // Télémétrie panel God « Tâches CRON »
        const { recordCronExecution } = await import("@/lib/cron-telemetry");
        await recordCronExecution("sync_dofensive_maps", {
            success: result.errors.length === 0,
            durationMs: Date.now() - startedAt,
            summary: `${result.synced} maps synchronisées, ${result.unchanged} inchangées (${result.errors.length} erreur(s))`,
            details: { synced: result.synced, unchanged: result.unchanged, skippedFresh: result.skippedFresh, errors: result.errors.slice(0, 5) },
        });

        return NextResponse.json({ success: true, result });
    } catch (error: any) {
        logger.error("[Cron:SyncDofensiveMaps] Erreur:", { error: String(error) });
        const { recordCronExecution } = await import("@/lib/cron-telemetry");
        await recordCronExecution("sync_dofensive_maps", {
            success: false,
            durationMs: Date.now() - startedAt,
            summary: `Erreur: ${String(error)}`,
        });
        return NextResponse.json({ error: "Internal Error" }, { status: 500 });
    }
}
