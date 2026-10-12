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

        // Envoi d'une alerte/notification God avec embed Discord structuré et lisible
        const { notifyGod } = await import("@/server/actions/god-notif-actions");
        const embedFields: { name: string; value: string; inline?: boolean }[] = [
            {
                name: "📊 Bilan synchronisation",
                value: `**${result.synced}** mise(s) à jour • **${result.unchanged}** inchangée(s) • **${result.skippedFresh}** fraîche(s)`,
                inline: false,
            },
        ];

        if (result.syncedMaps && result.syncedMaps.length > 0) {
            const mapLines = result.syncedMaps.slice(0, 10).map((m) =>
                `• **${m.dungeonName}** : ${m.name} (\`#${m.mapId}\`)${m.isBoss ? " 👑 *Boss*" : ""}`
            );
            if (result.syncedMaps.length > 10) {
                mapLines.push(`*... et ${result.syncedMaps.length - 10} autre(s) carte(s)*`);
            }
            embedFields.push({
                name: `🗺️ Cartes mises à jour (${result.syncedMaps.length})`,
                value: mapLines.join("\n").slice(0, 1024),
                inline: false,
            });
        } else {
            embedFields.push({
                name: "🗺️ Donjons vérifiés",
                value: `${result.dungeonsCount ?? "Tous"} donjons vérifiés. Toutes les cartes sont déjà à jour.`,
                inline: false,
            });
        }

        if (result.errors.length > 0) {
            embedFields.push({
                name: `⚠️ Erreurs (${result.errors.length})`,
                value: result.errors.slice(0, 5).map((e) => `• ${e}`).join("\n").slice(0, 1024),
                inline: false,
            });
        }

        await notifyGod({
            title: "Siphon Maps Dofensive terminé",
            message: `${result.synced} map(s) synchronisée(s), ${result.unchanged} inchangée(s)${result.errors.length > 0 ? ` (${result.errors.length} erreur(s))` : ""}.`,
            type: "WORKER_SYNC",
            success: result.errors.length === 0,
            fields: embedFields,
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
