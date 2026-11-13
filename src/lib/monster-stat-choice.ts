/**
 * Choix de la ligne `MonsterStat` à **servir** pour un nom de monstre.
 *
 * 🐛 Défaut mesuré (30/10/2026) : `getLocalMonsterStatAny` faisait `findFirst` +
 * `orderBy lastSyncedAt desc` **par nom** ⇒ une ligne récente mais **pauvre** (repli
 * Unity, `drops: []`) masquait une ligne complète plus ancienne. Cinq doublons de nom
 * étaient dans ce cas en base locale : `blop indigo royal` (1186 = 31 butins contre
 * 7972 = 0), `bouftou royal` (147 = 37 contre 7835 = 0), `chafer rōnin`, `ondine`,
 * `scarabosse doré`. Conséquence côté joueur : **106 fiches boss sur 146** servaient
 * « aucun butin » alors que la donnée existait en base.
 *
 * 🎯 Règle unique, et une seule : **la plus complète d'abord**, la plus fraîche
 * seulement pour départager deux lignes de même complétude. Module **PUR** (aucune IO) :
 * importé par la couche locale, verrouillé par `tests/unit/monster-stat-choice.test.ts`.
 */

/** Blocs de `stats` utiles au classement (le reste du payload est opaque). */
export interface MonsterStatChoiceStats {
    /** Butins documentés. Un tableau vide = « pas de butin connu », jamais « aucun butin ». */
    drops?: unknown[] | null;
    /** Origine du payload : `"unity"` = repli bestiaire client (jamais de butin). */
    source?: string | null;
    /** DofusDB a répondu et ne documente **aucun** butin pour ce monstre. */
    dropsUnavailable?: boolean;
}

/** Ligne `MonsterStat` vue par le classement (le strict nécessaire). */
export interface MonsterStatChoiceRow {
    monsterId: number;
    monsterName: string;
    lastSyncedAt: Date | string | null;
    stats: MonsterStatChoiceStats | null;
}

/** Horodatage comparable ; `null`/invalide vaut 0 (jamais `NaN` dans une comparaison). */
function timestampOf(value: Date | string | null | undefined): number {
    if (!value) return 0;
    const ms = value instanceof Date ? value.getTime() : new Date(value).getTime();
    return Number.isFinite(ms) ? ms : 0;
}

/**
 * Score de complétude : butins réels **+4** > butins documentés absents **+2** >
 * payload non-Unity **+1**. La fraîcheur ne pèse **pas** ici (elle départage les égalités).
 */
export function monsterStatScore(row: Pick<MonsterStatChoiceRow, "stats"> | null | undefined): number {
    const stats = row?.stats ?? null;
    let score = 0;
    if (Array.isArray(stats?.drops) && stats.drops.length > 0) score += 4;
    if (stats?.dropsUnavailable === true) score += 2;
    if (stats?.source !== "unity") score += 1;
    return score;
}

/**
 * Meilleure ligne à servir : score de complétude le plus haut, puis `lastSyncedAt` le plus
 * récent. `null` si la liste est vide (ou n'en contient aucune ligne exploitable).
 */
export function pickBestMonsterStatRow(
    rows: readonly (MonsterStatChoiceRow | null | undefined)[] | null | undefined
): MonsterStatChoiceRow | null {
    if (!Array.isArray(rows) || rows.length === 0) return null;
    let best: MonsterStatChoiceRow | null = null;
    let bestScore = -Infinity;
    let bestAt = -Infinity;
    for (const row of rows) {
        if (!row) continue;
        const score = monsterStatScore(row);
        const at = timestampOf(row.lastSyncedAt);
        // Strictement meilleur, ou aussi complet mais plus récent (égalité = fraîcheur).
        if (best === null || score > bestScore || (score === bestScore && at > bestAt)) {
            best = row;
            bestScore = score;
            bestAt = at;
        }
    }
    return best;
}
