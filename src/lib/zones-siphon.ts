/**
 * 🗺️ CŒUR du siphon « Zones & Sous-zones » (DofusDB `/subareas` + `/areas`).
 *
 * Descendu de `src/server/actions/game-data-actions.ts` (22/09/2026) pour être
 * exécutable **sans session Next** : la file BullMQ + le worker peuvent donc le
 * lancer, il survit à la fermeture de l'onglet et BullMQ rejoue en cas d'échec
 * réseau (avant, la boucle vivait dans le navigateur : fermer l'onglet perdait tout).
 *
 * Invariants (inchangés) : upsert **par nom** (jamais de doublon), les zones custom
 * et les réglages existants sont **préservés** (`update: {}` pour les régions),
 * les noms des listes d'exclusion ne sont jamais réécrits.
 */
import { db } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { dofusDbFetch } from "@/lib/dofusdb-limiter";
import { isIgnoredZone } from "@/lib/game-data-ignores";
import { diffFields, recordGameDataChanges, type GameDataChangeEntry } from "@/lib/game-data-changelog";

export interface ZonesSyncResult {
    synced: number;
    total: number;
}

function frenchName(raw: unknown): string {
    const item = raw as { name?: string | { fr?: string; en?: string } } | null;
    const name = typeof item?.name === "string" ? item.name : item?.name?.fr || item?.name?.en || "";
    return name.trim();
}

export async function syncZonesFromDofusDbCore(
    onProgress?: (patch: { done: number; total: number }) => void | Promise<void>,
): Promise<ZonesSyncResult> {
    let synced = 0;
    let totalProcessed = 0;
    // 🔍 Journal : image **avant** (une seule lecture) — « zone créée » ou « niveau changé ».
    const existingZones = new Map(
        (await db.zone.findMany({ select: { name: true, level: true } })).map((z) => [z.name, z.level]),
    );
    const changes: GameDataChangeEntry[] = [];

    /**
     * 🔍 Compare avant d'écrire : une zone **créée** ou dont le **niveau** change entre au
     * journal (les autres écritures sont des no-op, on ne journalise pas du vide).
     */
    const journalZone = (name: string, level: number) => {
        const before = existingZones.get(name);
        if (before === undefined) {
            changes.push({ entityType: "zone", entityId: name, entityName: name, changeType: "NEW" });
            existingZones.set(name, level);
            return;
        }
        const fields = diffFields({ level: before }, { level }, ["level"]);
        if (fields) {
            changes.push({
                entityType: "zone",
                entityId: name,
                entityName: name,
                changeType: "MODIFIED",
                fields,
            });
            existingZones.set(name, level);
        }
    };

    // 1. Sous-zones (lieux réels de présence : Montagne des Craqueleurs, Port de Madrestam…)
    let subSkip = 0;
    let subTotal = 1;

    while (subSkip < subTotal) {
        const res = await dofusDbFetch(`https://api.dofusdb.fr/subareas?$limit=50&$skip=${subSkip}`, {
            headers: { Accept: "application/json" },
            signal: AbortSignal.timeout(15000),
        });
        if (!res.ok) break;
        const json = (await res.json()) as { total?: number; data?: unknown[] };
        subTotal = json.total || 0;
        const items = json.data || [];
        if (items.length === 0) break;

        for (const item of items) {
            const nameFr = frenchName(item);
            if (!nameFr) continue;
            if (isIgnoredZone(nameFr)) continue;

            const level = typeof (item as { level?: number }).level === "number" && (item as { level: number }).level > 0
                ? (item as { level: number }).level
                : 200;

            await db.zone.upsert({
                where: { name: nameFr },
                update: { level }, // niveau officiel si présent
                create: { name: nameFr, level },
            });
            journalZone(nameFr, level);
            synced++;
        }
        subSkip += items.length;
        totalProcessed = subTotal;
        await onProgress?.({ done: synced, total: subTotal });
    }

    // 2. Grandes régions (Amakna, Cania, Frigost…)
    let areaSkip = 0;
    let areaTotal = 1;

    while (areaSkip < areaTotal) {
        const res = await dofusDbFetch(`https://api.dofusdb.fr/areas?$limit=50&$skip=${areaSkip}`, {
            headers: { Accept: "application/json" },
            signal: AbortSignal.timeout(15000),
        });
        if (!res.ok) break;
        const json = (await res.json()) as { total?: number; data?: unknown[] };
        areaTotal = json.total || 0;
        const items = json.data || [];
        if (items.length === 0) break;

        for (const item of items) {
            const nameFr = frenchName(item);
            if (!nameFr) continue;
            if (isIgnoredZone(nameFr)) continue;

            await db.zone.upsert({
                where: { name: nameFr },
                update: {}, // préserve les réglages existants
                create: { name: nameFr, level: 200 },
            });
            journalZone(nameFr, 200);
            synced++;
        }
        areaSkip += items.length;
    }

    logger.info(`[zones-siphon] ${synced} zone(s) synchronisée(s)`);

    // 🔍 Journal des changements (borné : 500 entrées / dataset, purge à l'écriture).
    await recordGameDataChanges("ZONES", changes);

    return { synced, total: totalProcessed + areaTotal };
}
