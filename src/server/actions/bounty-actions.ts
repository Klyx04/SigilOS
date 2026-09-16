"use server";

/**
 * Lectures LOCALES de la fiche « Avis de recherche » (chantier Lot 2).
 *
 * Règle de la maison : **aucun appel réseau dans un chemin de lecture**. Tout vient du siphon :
 * `Bounty` (ligne d'avis, upsert par `dofusdbId`) + `MonsterStat` (stats/sorts/butin, résolu
 * **par ID** — indispensable pour les homonymes « Ronce ») + `DofensiveMap` (carte de la
 * simulation, repli déclaré). Une donnée **périmée** est servie (Lot 1 « stale-while-offline »),
 * jamais transformée en absence ; seule l'absence totale renvoie `null`.
 */
import { logger } from "@/lib/logger";
import { db } from "@/lib/prisma";
import { DB_READABLE, getLocalDofensiveMapAny, getLocalMonsterStatByIdAny } from "@/lib/dofensive-sync";
import { BOUNTY_FALLBACK_MAP } from "@/lib/bounty";
import {
    buildBountyPublicDungeon,
    buildBountyPublicMeta,
    type BountyPublicDungeon,
    type BountyPublicMeta,
    type BountyRowInput,
} from "@/lib/bounty-fiche";
import type { DofensiveDungeonInfo } from "@/server/actions/dofensive-actions";

type ActionResponse<T = void> = { success: boolean; error?: string; data?: T };

/** Sélection `Bounty` d'un avis (colonnes lues par la fiche). */
const BOUNTY_SELECT = {
    id: true,
    name: true,
    level: true,
    zoneName: true,
    imageUrl: true,
    position: true,
    milice: true,
    doplons: true,
    rewardType: true,
    rewards: true,
    mechanics: true,
    dpnlUrl: true,
    dofusdbId: true,
    slug: true,
    raceId: true,
    raceName: true,
    battleMapId: true,
    battleMapSource: true,
    dofusdbSyncedAt: true,
} as const;

export interface BountyFichePayload {
    dungeon: BountyPublicDungeon;
    meta: BountyPublicMeta;
    /** Fiche `MonsterStat` (stats/sorts/butin) — `null` si jamais siphonnée. */
    monsterStats: any | null;
    /** Carte de la simulation (grille locale) — `null` si indisponible. */
    dungeonMaps: DofensiveDungeonInfo | null;
    /** Vrai si la fiche servie est **périmée** (> TTL) : l'UI peut afficher son âge. */
    stale: boolean;
}

/** Résout un avis par **id** (fiche publique) ou par **slug** (URL partageable). */
export async function findBountyRow(idOrSlug: string): Promise<BountyRowInput | null> {
    if (!DB_READABLE) return null;
    const key = String(idOrSlug ?? "").trim();
    if (!key) return null;
    try {
        const row = await db.bounty.findFirst({
            where: {
                isBountyMonster: true,
                OR: [{ id: key }, { slug: key }],
            },
            select: BOUNTY_SELECT,
        });
        return (row as unknown as BountyRowInput) ?? null;
    } catch (error) {
        logger.warn("[bounty-actions] findBountyRow échec:", { error: String(error) });
        return null;
    }
}

/**
 * Carte de combat d'un avis : grille locale si siphonnée, sinon libellé du **repli déclaré**
 * (map générique). Aucune requête réseau — la grille est lue dans `DofensiveMap`.
 */
export async function getBountyBattleMap(
    battleMapId: number | null | undefined,
    label: string
): Promise<ActionResponse<DofensiveDungeonInfo> & { isFallback?: boolean }> {
    const mapId = Math.floor(Number(battleMapId) || 0);
    if (mapId <= 0) return { success: false, error: "Carte de combat inconnue" };
    try {
        const hit = await getLocalDofensiveMapAny(mapId);
        const name = hit?.data?.name || label;
        return {
            success: true,
            isFallback: !hit || !hit.data,
            data: {
                dungeonId: -mapId,
                dungeonName: name,
                maps: [{ id: mapId, name, isBoss: true }],
                monsters: [],
                bossMonsterId: null,
            },
        };
    } catch (error) {
        logger.warn("[bounty-actions] getBountyBattleMap échec:", { error: String(error) });
        return { success: false, error: "Carte de combat indisponible" };
    }
}

/**
 * Fiche complète d'un avis (lecture **100 % locale**) : ligne `Bounty` + fiche `MonsterStat`
 * (résolue **par ID**) + carte de la simulation (grille locale ou repli déclaré) + métadonnées.
 */
export async function getBountyFiche(idOrSlug: string): Promise<ActionResponse<BountyFichePayload>> {
    const bounty = await findBountyRow(idOrSlug);
    if (!bounty) return { success: false, error: "Avis de recherche introuvable" };

    const statsHit = bounty.dofusdbId ? await getLocalMonsterStatByIdAny(bounty.dofusdbId) : null;
    const stats = statsHit?.data ?? null;
    const meta = buildBountyPublicMeta(bounty, stats);

    const mapRes = await getBountyBattleMap(
        meta.battleMapId,
        meta.battleMapFallbackLabel ?? BOUNTY_FALLBACK_MAP.name
    );

    return {
        success: true,
        data: {
            dungeon: buildBountyPublicDungeon(bounty),
            meta,
            monsterStats: stats,
            dungeonMaps: mapRes.success ? mapRes.data ?? null : null,
            /* Périmé (ou jamais synchronisé) ⇒ l'UI affiche l'information, jamais un spinner. */
            stale: !!statsHit?.stale || !meta.syncedAt,
        },
    };
}
