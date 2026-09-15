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
import { db } from "@/lib/prisma";

/**
 * 🐉 CRON quotidien : synchronisation locale des fiches et statistiques de monstres (DofusDB + Dofensive).
 * Siphonne et stocke les données enrichies dans PostgreSQL pour éliminer toute dépendance en direct.
 *
 * 🔒 Sécurité : Protégé par verifyCronSecret (x-cron-secret / Authorization Bearer).
 */
export async function GET(req: Request) {
    if (!verifyCronSecret(req)) {
        // 🔎 Télémétrie du refus (throttlée Redis 1×/10 min, sans secret) : le panneau
        // God « Tâches CRON » affichait « Inconnu — Aucune exécution récente » alors que
        // la tâche était déclenchée mais rejetée en 401 (secret de crontab absent/erroné
        // ou URL d'un autre environnement) — donc AUCUNE donnée siphonnée, donc des
        // **salles de donjon manquantes** dans la simulation. Le panneau montre
        // désormais « Refusé (401) », comme `market-expire`.
        const { recordCronRefusal } = await import("@/lib/cron-telemetry");
        await recordCronRefusal("sync_monster_stats");
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const startedAt = Date.now();

    try {
        // 1. Mise à jour automatique du catalogue Donjons & Familles (100% local-first)
        try {
            const { siphonDungeonMonstersDataset } = await import("@/lib/dungeon-monsters-siphon");
            await siphonDungeonMonstersDataset();
        } catch (e) {
            logger.warn("[Cron:SyncMonsterStats] Échec de la mise à jour du dataset donjons:", { error: String(e) });
        }

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
        let skippedFresh = 0;

        // Phase 5.1 — le forceRefresh ne touche pas au frais < 24 h : seules
        // les fiches manquantes/périmées sont re-fetchées (dry-run BDD pur,
        // même matching que l'onglet État des données). Le bouton God par
        // ligne garde son vrai force (chemin triggerBatch, inchangé).
        const { buildBossFicheGaps } = await import("@/lib/data-health");
        const existingStats = await db.monsterStat.findMany({
            select: { monsterName: true, lastSyncedAt: true },
        });
        const gaps = buildBossFicheGaps(
            bosses.map((b) => ({ bossName: b.bossName, name: b.dungeonName, level: null })),
            existingStats.map((r) => ({ monsterName: r.monsterName, lastSyncedAt: r.lastSyncedAt })),
            Date.now()
        );
        const gapKeys = new Set(gaps.map((g) => `${g.bossName}::${g.dungeonName}`));
        const toSync = bosses.filter((b) => gapKeys.has(`${b.bossName}::${b.dungeonName}`));
        skippedFresh = bosses.length - toSync.length;
        if (skippedFresh > 0) {
            logger.info(`[Cron:SyncMonsterStats] ${skippedFresh} fiche(s) fraîche(s) < 24 h ignorée(s).`);
        }

        for (const b of toSync) {
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

                    // Téléchargement et compression WebP locale (idempotent, anti-flag).
                    // L'objet enrichi porte `imageUrl` (pas `img`) : le lire en
                    // premier, sinon on retombe toujours sur le pattern deviné
                    // (ID logique ≠ ID image, ex. Cadob 3220 → img 499).
                    if (data.id) {
                        const remoteImg = (data as { img?: string; imageUrl?: string }).img
                            ?? (data as { imageUrl?: string }).imageUrl
                            ?? `https://api.dofusdb.fr/img/monsters/${data.id}.png`;
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

        // 2. Titans (Événements Krosmiques) — même synchro DofusDB/Dofensive (sorts, stats, image).
        // Local-first : monsterStat est keyé par monsterId (Ankama), ex. 8062 pour Gargandyas.
        // Même règle fraîcheur que les boss (Phase 5.1).
        try {
            const titans = await db.titan.findMany({
                select: { id: true, name: true, dofusdbId: true, mapName: true },
            });
            const titanGaps = buildBossFicheGaps(
                titans.map((t) => ({ bossName: t.name, name: t.mapName || t.name, level: null })),
                existingStats.map((r) => ({ monsterName: r.monsterName, lastSyncedAt: r.lastSyncedAt })),
                Date.now()
            );
            const titanGapKeys = new Set(titanGaps.map((g) => g.bossName));
            for (const t of titans) {
                try {
                    if (t.dofusdbId) {
                        if (!titanGapKeys.has(t.name)) {
                            skippedFresh++;
                            continue;
                        }
                        // Pre-fetch simple par nom pour résoudre l'ID Ankama (8062) puis la fiche.
                        const statsRes = await getMonsterStats(t.name, t.mapName || undefined, true);
                        if (statsRes.success && statsRes.data) {
                            let data = statsRes.data;
                            const dRes = await getBossDofensiveSpells(t.name, undefined, undefined, true);
                            if (dRes.success && dRes.data) {
                                data = { ...data, spells: mergeDofensiveSpells(data.spells ?? [], dRes.data) };
                            }
                            await persistMonsterStat({ ...data, dungeonName: t.mapName || undefined });
                            if (data.id) {
                                const remoteImg = (data as { img?: string; imageUrl?: string }).img
                                    ?? (data as { imageUrl?: string }).imageUrl
                                    ?? `https://api.dofusdb.fr/img/monsters/${data.id}.png`;
                                const imgRes = await siphonAndCompressImage(remoteImg, "monsters", data.id);
                                if (imgRes.success) imagesSiphoned++;
                            }
                            synced++;
                        }
                    }
                } catch (err) {
                    errors++;
                    logger.warn(`[Cron:SyncMonsterStats] Erreur titan ${t.name}:`, { error: String(err) });
                }
            }
        } catch (err) {
            logger.warn("[Cron:SyncMonsterStats] Erreur chargement des titans:", { error: String(err) });
        }

        logger.info(`[Cron:SyncMonsterStats] Terminé: ${synced} monstres synchronisés, ${imagesSiphoned} images siphonnées, ${errors} erreurs, ${skippedFresh} frais ignorés`);

        // Visibilité dans le Dashboard GOD (Audit Logs & Alertes) — sans session utilisateur.
        await createSystemAuditLog({
            cron: "sync-monster-stats",
            targetId: "sync-monster-stats",
            synced,
            errors,
            images: imagesSiphoned,
            totalBosses: bosses.length,
        });

        // Envoi d'une alerte/notification God
        const { notifyGod } = await import("@/server/actions/god-notif-actions");
        await notifyGod({
            title: "Siphon Monstres & Sorts terminé",
            message: `${synced} monstres synchronisés avec succès (${errors} erreurs sur ${bosses.length}, ${imagesSiphoned} images siphonnées, ${skippedFresh} frais < 24 h ignorés).`,
            type: "WORKER_SYNC",
            success: errors === 0,
            metadata: {
                synced,
                errors,
                totalBosses: bosses.length,
                skippedFresh,
            },
        });

        // Télémétrie panel God « Tâches CRON »
        const { recordCronExecution } = await import("@/lib/cron-telemetry");
        await recordCronExecution("sync_monster_stats", {
            success: errors === 0,
            durationMs: Date.now() - startedAt,
            summary: `${synced} monstres synchronisés, ${errors} erreur(s) sur ${bosses.length} (${skippedFresh} frais ignorés)`,
            details: { synced, errors, images: imagesSiphoned, totalBosses: bosses.length, skippedFresh },
        });

        return NextResponse.json({ success: true, synced, errors, skippedFresh });
    } catch (error: any) {
        logger.error("[Cron:SyncMonsterStats] Erreur globale:", { error: String(error) });
        const { recordCronExecution } = await import("@/lib/cron-telemetry");
        await recordCronExecution("sync_monster_stats", {
            success: false,
            durationMs: Date.now() - startedAt,
            summary: `Erreur: ${String(error)}`,
        });
        return NextResponse.json({ error: "Internal Error" }, { status: 500 });
    }
}
