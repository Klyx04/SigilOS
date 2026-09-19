/**
 * Fiche publique d'un **avis de recherche** — module **PUR** (aucun import serveur/prisma/auth).
 *
 * Un avis n'est ni un donjon ni un titan : pas de salle, pas de carte Dofensive, mais une
 * **zone de traque**, une **prime** (récompenses curées dans l'onglet God) et des **critères de
 * quête** (siphonnés — texte réel de Dofensive). Ce module construit l'entrée consommée par la
 * fiche publique (`/boss/<id>`), à partir de la ligne `Bounty` (siphon) + de la fiche
 * `MonsterStat` (stats/sorts/butin) : aucune donnée n'est inventée ici, tout vient de la base.
 */
import {
    BOUNTY_MAP_EMPTY_LABEL,
    bountyDofensiveUrl,
    bountyDofusDbUrl,
    bountyRaceName,
} from "@/lib/bounty";

/** Ligne `Bounty` minimale utilisée par la fiche (sous-ensemble du modèle Prisma). */
export interface BountyRowInput {
    id: string;
    name: string;
    level: number;
    zoneName?: string | null;
    imageUrl?: string | null;
    position?: string | null;
    milice?: string | null;
    doplons?: number | null;
    rewardType?: string | null;
    rewards?: unknown;
    mechanics?: string | null;
    dpnlUrl?: string | null;
    dofusdbId?: number | null;
    slug?: string | null;
    raceId?: number | null;
    raceName?: string | null;
    battleMapId?: number | null;
    battleMapSource?: string | null;
    dofusdbSyncedAt?: Date | string | null;
}

/** Une ligne de prime (« Aliton », « Kama de glace »… + montant), telle que saisie dans God. */
export interface BountyRewardLine {
    type: string;
    amount: number;
}

/** Métadonnées d'affichage spécifiques à un avis (entête + encarts de la fiche). */
export interface BountyPublicMeta {
    raceName: string;
    raceId: number | null;
    zone: string | null;
    position: string | null;
    /** Commande de trajet in-game, `null` si la position n'est pas renseignée. */
    travelCommand: string | null;
    milice: string | null;
    rewards: BountyRewardLine[];
    doplons: number;
    rewardType: string;
    /** Critères de quête RÉELS (siphonnés) — jamais reformulés. */
    criteria: string[];
    /** Carte de simulation : `null` quand une grille réelle est disponible, sinon « Map vide ». */
    battleMapLabel: string | null;
    battleMapId: number | null;
    dofusdbId: number | null;
    dofusdbUrl: string | null;
    dofensiveUrl: string | null;
    dpnlUrl: string | null;
    slug: string | null;
    /** Date de la dernière synchronisation de la fiche (ISO), `null` si jamais synchronisée. */
    syncedAt: string | null;
}

/** Entrée `dungeon` (forme attendue par `PublicBossDetailClient`) d'un avis de recherche. */
export interface BountyPublicDungeon {
    id: string;
    /** Slug d'URL publique (`/boss/<slug>`) — repli sur `id` s'il est absent. */
    slug: string | null;
    name: string;
    bossName: string;
    level: number;
    imageUrl: string | null;
    dofensiveUrl: string | null;
    dofuspourlesnoobsUrl: string | null;
    dofensiveMonsterName: string | null;
    dofensiveDungeonName: string | null;
    kind: "bounty";
}

/** Normalise `Bounty.rewards` (Json libre saisi dans God) en lignes exploitables. */
export function bountyRewardLines(rewards: unknown): BountyRewardLine[] {
    const out: BountyRewardLine[] = [];
    for (const item of Array.isArray(rewards) ? rewards : []) {
        const type = String((item as any)?.type ?? "").trim();
        const amount = Math.floor(Number((item as any)?.amount) || 0);
        if (!type && amount <= 0) continue;
        out.push({ type: type || "Prime", amount });
    }
    return out;
}

/** Critères de quête siphonnés (dans la fiche `MonsterStat.stats.bounty.criteria`). */
export function bountyCriteriaFromStat(stats: unknown): string[] {
    const raw = (stats as any)?.bounty?.criteria;
    return (Array.isArray(raw) ? raw : []).map((c: unknown) => String(c ?? "").trim()).filter(Boolean);
}

/**
 * Carte de simulation d'un avis : `null` si une grille **réelle** est disponible (source
 * `dofensive`), sinon le libellé « Map vide » (aucun avis n'a de carte exposée par la source).
 */
export function bountyBattleMapLabel(bounty: BountyRowInput): string | null {
    return String(bounty.battleMapSource ?? "") === "dofensive" ? null : BOUNTY_MAP_EMPTY_LABEL;
}
/** Date de synchronisation exploitable (ISO) — jamais de date inventée. */
function syncedAtIso(value: Date | string | null | undefined): string | null {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/**
 * Construit les métadonnées publiques d'un avis. `stats` (fiche `MonsterStat`) sert uniquement
 * aux **critères de quête** siphonnés ; tout le reste vient de la ligne `Bounty`.
 */
export function buildBountyPublicMeta(bounty: BountyRowInput, stats?: unknown): BountyPublicMeta {
    const rewards = bountyRewardLines(bounty.rewards);
    const doplons = Math.floor(Number(bounty.doplons) || 0);
    const rewardType = String(bounty.rewardType ?? "Doplon");
    // Prime de repli : la ligne « curée » d'origine (montant + type) quand `rewards` est vide.
    if (rewards.length === 0 && (doplons > 0 || rewardType)) {
        rewards.push({ type: rewardType, amount: doplons });
    }
    const position = String(bounty.position ?? "").trim() || null;
    return {
        raceName: bountyRaceName(bounty.raceId, bounty.raceName),
        raceId: Number.isFinite(Number(bounty.raceId)) ? Math.floor(Number(bounty.raceId)) : null,
        zone: String(bounty.zoneName ?? "").trim() || null,
        position,
        travelCommand: position ? `/travel ${position}` : null,
        milice: String(bounty.milice ?? "").trim() || null,
        rewards,
        doplons,
        rewardType,
        criteria: bountyCriteriaFromStat(stats),
        battleMapLabel: bountyBattleMapLabel(bounty),
        battleMapId: Number(bounty.battleMapId) > 0 ? Math.floor(Number(bounty.battleMapId)) : null,
        dofusdbId: Number.isFinite(Number(bounty.dofusdbId)) ? Math.floor(Number(bounty.dofusdbId)) : null,
        dofusdbUrl: bountyDofusDbUrl(bounty.dofusdbId),
        dofensiveUrl: bountyDofensiveUrl(bounty.dofusdbId),
        dpnlUrl: String(bounty.dpnlUrl ?? "").trim() || null,
        slug: String(bounty.slug ?? "").trim() || null,
        syncedAt: syncedAtIso(bounty.dofusdbSyncedAt),
    };
}

/**
 * Entrée de **catalogue** (Bestiaire / `/boss`) d'un avis — même forme que les entrées boss /
 * titans / monstres, avec `type: "bounty"`. `name` = zone de traque (repli : nom de l'avis).
 */
export function buildBountyBestiaireEntry(bounty: BountyRowInput) {
    const zone = String(bounty.zoneName ?? "").trim();
    return {
        id: bounty.id,
        // Slug d'URL publique de l'avis (`/boss/<slug>`) — repli sur l'id côté liens.
        slug: String(bounty.slug ?? "").trim() || null,
        name: zone || bounty.name,
        bossName: bounty.name,
        level: Math.floor(Number(bounty.level) || 0),
        imageUrl: String(bounty.imageUrl ?? "").trim() || null,
        dofensiveUrl: bountyDofensiveUrl(bounty.dofusdbId),
        dpnlUrl: String(bounty.dpnlUrl ?? "").trim() || null,
        dofusdbId: Number.isFinite(Number(bounty.dofusdbId)) ? Math.floor(Number(bounty.dofusdbId)) : null,
        dofensiveMonsterName: bounty.name,
        dofensiveDungeonName: null,
        isOcreQuest: false,
        type: "bounty" as const,
    };
}

/**
 * Entrée `dungeon` de la fiche d'un avis : `name` = **zone de traque** (comme un donjon sert
 * d'emplacement) et `bossName` = le nom de l'avis (l'entité recherchée).
 */
export function buildBountyPublicDungeon(bounty: BountyRowInput): BountyPublicDungeon {
    const zone = String(bounty.zoneName ?? "").trim();
    return {
        id: bounty.id,
        slug: String(bounty.slug ?? "").trim() || null,
        name: zone || bounty.name,
        bossName: bounty.name,
        level: Math.floor(Number(bounty.level) || 0),
        imageUrl: String(bounty.imageUrl ?? "").trim() || null,
        dofensiveUrl: bountyDofensiveUrl(bounty.dofusdbId),
        dofuspourlesnoobsUrl: String(bounty.dpnlUrl ?? "").trim() || null,
        dofensiveMonsterName: bounty.name,
        dofensiveDungeonName: null,
        kind: "bounty",
    };
}
