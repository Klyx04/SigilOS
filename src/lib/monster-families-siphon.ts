/**
 * 🦎 CŒUR du siphon « Familles de monstres » (DofusDB `/monster-races` puis `/monsters`).
 *
 * Descendu de `src/server/actions/game-data-actions.ts` (22/09/2026) pour être
 * exécutable **sans session Next** : file BullMQ + worker ⇒ survit à la fermeture de
 * l'onglet et reprend en cas d'échec (avant : boucle dans le navigateur).
 *
 * Invariants (inchangés) : les familles sont **upsert par nom** avec `update: {}`
 * (les données manuelles ne sont JAMAIS écrasées), les monstres sont rattachés à leur
 * famille via la carte raceId→famille, et la première image/le premier niveau rencontrés
 * servent de visuel de famille (jamais de remplacement d'un visuel déjà présent).
 */
import { db } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { dofusDbFetch } from "@/lib/dofusdb-limiter";
import { isIgnoredFamily } from "@/lib/game-data-ignores";
import { diffFields, recordGameDataChanges, type GameDataChangeEntry } from "@/lib/game-data-changelog";

export interface MonsterFamiliesSyncResult {
    synced: number;
    total: number;
    monstersSynced: number;
}

function frenchName(raw: unknown): string {
    const item = raw as { name?: string | { fr?: string; en?: string } } | null;
    const name = typeof item?.name === "string" ? item.name : item?.name?.fr || item?.name?.en || "";
    return name.trim();
}

export async function syncMonsterFamiliesCore(
    onProgress?: (patch: { done: number; total: number }) => void | Promise<void>,
): Promise<MonsterFamiliesSyncResult> {
    let skip = 0;
    let total = 1;
    let synced = 0;
    const familyRaceIdMap = new Map<number, string>(); // raceId (DofusDB) -> MonsterFamily.id
    // 🔍 Journal : familles **déjà** en base (une seule lecture) — une famille créée est un
    // changement, les mises à jour de famille sont des no-op (`update: {}`) donc jamais journalisées.
    const knownFamilies = new Set(
        (await db.monsterFamily.findMany({ select: { name: true } })).map((f) => f.name),
    );
    const changes: GameDataChangeEntry[] = [];

    // 1. Familles / Races
    while (skip < total) {
        const res = await dofusDbFetch(`https://api.dofusdb.fr/monster-races?$limit=50&$skip=${skip}`, {
            headers: { Accept: "application/json" },
            signal: AbortSignal.timeout(15000),
        });
        if (!res.ok) break;
        const json = (await res.json()) as { total?: number; data?: unknown[] };
        total = json.total || 0;
        const items = json.data || [];
        if (items.length === 0) break;

        for (const raw of items) {
            const nameFr = frenchName(raw);
            if (!nameFr) continue;
            if (isIgnoredFamily(nameFr)) continue;

            const family = await db.monsterFamily.upsert({
                where: { name: nameFr },
                update: {}, // préserve les données manuelles existantes
                create: { name: nameFr, level: null },
            });
            if (!knownFamilies.has(nameFr)) {
                changes.push({
                    entityType: "family",
                    entityId: family.id,
                    entityName: nameFr,
                    changeType: "NEW",
                });
                knownFamilies.add(nameFr);
            }
            const raceId = (raw as { id?: unknown }).id;
            if (typeof raceId === "number") familyRaceIdMap.set(raceId, family.id);
            synced++;
        }
        skip += items.length;
        await onProgress?.({ done: synced, total: total || skip });
    }

    // 2. Monstres individuels (rattachés à leur famille)
    let monsterSkip = 0;
    let monsterTotal = 1;
    let monstersSynced = 0;

    while (monsterSkip < monsterTotal) {
        const res = await dofusDbFetch(`https://api.dofusdb.fr/monsters?$limit=50&$skip=${monsterSkip}`, {
            headers: { Accept: "application/json" },
            signal: AbortSignal.timeout(15000),
        });
        if (!res.ok) break;
        const json = (await res.json()) as { total?: number; data?: unknown[] };
        monsterTotal = json.total || 0;
        const items = json.data || [];
        if (items.length === 0) break;

        for (const raw of items) {
            const m = raw as {
                name?: string | { fr?: string; en?: string };
                race?: { id?: number } | number;
                raceId?: number;
                grades?: Array<{ level?: number; grade?: number }>;
                level?: number;
                img?: string;
                id?: number;
            };
            const mName = frenchName(raw);
            if (!mName) continue;

            const raceId = m.race && typeof m.race === "object" ? m.race.id : (m.raceId ?? (typeof m.race === "number" ? m.race : undefined));
            const familyId = raceId !== undefined ? familyRaceIdMap.get(raceId) : undefined;
            if (!familyId) continue;

            const level = Array.isArray(m.grades) && m.grades.length > 0
                ? m.grades[0].level || m.grades[0].grade || null
                : (typeof m.level === "number" ? m.level : null);

            const imgUrl = m.img || (m.id ? `https://api.dofusdb.fr/img/monsters/${m.id}.png` : null);

            const existing = await db.monster.findFirst({ where: { name: mName, familyId } });
            if (existing) {
                // 🔍 Journal : « niveau » et « image » d'un monstre changent-ils vraiment ?
                const fields = diffFields(
                    { name: existing.name, level: existing.level, imageUrl: existing.imageUrl },
                    { name: mName, level: level || existing.level, imageUrl: imgUrl || existing.imageUrl },
                    ["name", "level", "imageUrl"],
                );
                await db.monster.update({
                    where: { id: existing.id },
                    data: {
                        imageUrl: imgUrl || existing.imageUrl,
                        level: level || existing.level,
                    },
                });
                if (fields) {
                    changes.push({
                        entityType: "monster",
                        entityId: existing.id,
                        entityName: mName,
                        changeType: "MODIFIED",
                        fields,
                    });
                }
            } else {
                await db.monster.create({
                    data: { name: mName, familyId, imageUrl: imgUrl, level },
                });
                changes.push({
                    entityType: "monster",
                    entityId: `${familyId}:${mName}`,
                    entityName: mName,
                    changeType: "NEW",
                });
            }

            // Visuel/niveau de famille : seulement s'ils manquent (jamais d'écrasement).
            await db.monsterFamily.updateMany({
                where: { id: familyId, imageUrl: null },
                data: { imageUrl: imgUrl, level: level || undefined },
            });

            monstersSynced++;
        }
        monsterSkip += items.length;
        await onProgress?.({ done: monstersSynced, total: monsterTotal });
    }

    logger.info(`[monster-families-siphon] ${synced} famille(s) · ${monstersSynced} monstre(s)`);

    // 🔍 Journal des changements (borné : 500 entrées / dataset, purge à l'écriture).
    await recordGameDataChanges("FAMILIES", changes);

    return { synced, total, monstersSynced };
}
