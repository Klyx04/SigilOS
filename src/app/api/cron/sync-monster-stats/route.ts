import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import { verifyCronSecret } from "@/lib/cron-auth";
import { logger } from "@/lib/logger";
import { createSystemAuditLog } from "@/lib/dofensive-sync";
import { getDungeonsWithAchievements, getMonsterStats } from "@/server/actions/game-data-actions";
import { getBossDofensiveSpells } from "@/server/actions/dofensive-actions";
import { mergeDofensiveSpells } from "@/lib/dofensive-spells";
import { persistMonsterStat } from "@/lib/dofensive-sync";
import { siphonAndCompressImage } from "@/lib/dofus-asset-siphon";

/**
 * 🐉 CRON quotidien : synchronisation locale des fiches et statistiques de monstres (DofusDB + Dofensive).
 * Siphonne et stocke les données enrichies dans PostgreSQL pour éliminer toute dépendance en direct.
 *
 * 🔒 Sécurité : Protégé par verifyCronSecret (x-cron-secret / Authorization Bearer).
 */
export async function GET(req: Request) {
    if (!verifyCronSecret(req)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const dungeonsRes = await getDungeonsWithAchievements();
        if (!dungeonsRes.success || !Array.isArray(dungeonsRes.data)) {
            return NextResponse.json({ error: "Impossible de récupérer les donjons" }, { status: 500 });
        }

        const bosses = dungeonsRes.data
            .filter((d: any) => d && (d.bossName || d.name))
            .map((d: any) => ({ bossName: d.bossName || d.name, dungeonName: d.name }));

        let synced = 0;
        let imagesSiphoned = 0;
        let errors = 0;

        for (const b of bosses) {
            try {
                // forceRefresh = true : le cron DOIT re-synchroniser depuis la source
                // (les getters sont local-first pour les joueurs, pas pour la sync).
                const statsRes = await getMonsterStats(b.bossName, b.dungeonName, true);
                if (statsRes.success && statsRes.data) {
                    let data = statsRes.data;
                    const dRes = await getBossDofensiveSpells(b.bossName, b.dungeonName, undefined, true);
                    if (dRes.success && dRes.data) {
                        data = { ...data, spells: mergeDofensiveSpells(data.spells ?? [], dRes.data) };
                    }
                    await persistMonsterStat({ ...data, dungeonName: b.dungeonName });

                    // Téléchargement et compression WebP locale (idempotent, anti-flag)
                    if (data.id) {
                        const remoteImg = data.img || `https://api.dofusdb.fr/img/monsters/${data.id}.png`;
                        const imgRes = await siphonAndCompressImage(remoteImg, "monsters", data.id);
                        if (imgRes.success) imagesSiphoned++;
                    }
                    synced++;
                }
            } catch (err) {
                errors++;
                logger.warn(`[Cron:SyncMonsterStats] Erreur sur ${b.bossName}:`, { error: String(err) });
            }
        }

        logger.info(`[Cron:SyncMonsterStats] Terminé: ${synced} monstres synchronisés, ${errors} erreurs`);

        // Visibilité dans le Dashboard GOD (Audit Logs & Alertes) — sans session utilisateur.
        await createSystemAuditLog({
            cron: "sync-monster-stats",
            targetId: "sync-monster-stats",
            synced,
            errors,
            totalBosses: bosses.length,
        });

        // Envoi d'une alerte/notification God
        const { notifyGod } = await import("@/server/actions/god-notif-actions");
        await notifyGod({
            title: "Siphon Monstres & Sorts terminé",
            message: `${synced} monstres synchronisés avec succès (${errors} erreurs sur ${bosses.length}).`,
            type: "WORKER_SYNC",
            success: errors === 0,
            metadata: {
                synced,
                errors,
                totalBosses: bosses.length,
            },
        });

        return NextResponse.json({ success: true, synced, errors });
    } catch (error: any) {
        logger.error("[Cron:SyncMonsterStats] Erreur globale:", { error: String(error) });
        return NextResponse.json({ error: "Internal Error" }, { status: 500 });
    }
}
