/**
 * Helpers PURS « État des données » (Phase 2 siphon).
 *
 * Module SANS 'use server' : importable par les Server Actions, les
 * composants client (types) et les tests unitaires (fixtures).
 * Aucun I/O ici — les lignes BDD sont injectées par l'appelant.
 */

export interface DataHealthRow {
    id: string;
    dataset: string;
    source: string;
    cible: string;
    fraicheur: string | null;
    couverture: string;
    couverturePct: number | null; // 0-100 ou null si non applicable
    dernierRun: string | null;
    goTab: string;
    goLabel: string;
}

export interface BossFicheGap {
    bossName: string;
    dungeonName: string;
    level: number | null;
    reason: 'manquante' | 'périmée';
    lastSyncedAt: string | null;
}

export const DATA_HEALTH_FRESH_MS = 24 * 60 * 60 * 1000;

function normKey(s: string | null | undefined): string {
    const k = (s || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .trim();
    if (k.includes('reine nyee')) return 'reine nyee';
    if (k.includes('dernier espoir') || k.includes('eliocalypse')) return 'servitude';
    return k;
}

/**
 * Clé de matching fiche ↔ donjon (mêmes règles que l'inventaire + dry-run).
 * Exportée car partagée entre l'inventaire siphon, le dry-run et les tests.
 * (Module pur : interdit de la laisser dans un module 'use server' — Next 16.)
 */
export function bossMatchKey(s: string | null | undefined): string {
    const k = (s || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .trim();
    if (k.includes('reine nyee')) return 'reine nyee';
    if (k.includes('dernier espoir') || k.includes('eliocalypse')) return 'servitude';
    return k;
}

/**
 * Dry-run pur (testable) : donjons sans fiche fraîche (< 24 h).
 * Aucun I/O — les lignes BDD sont injectées.
 */
/**
 * Diff pur (testable) : IDs locaux absents du distant. Sert au flag
 * `isDeprecated` (items disparus → flag, jamais supprimés).
 * (Module pur : interdit dans un module 'use server' — Next 16.)
 */
export function diffVanishedIds(localIds: number[], remoteIds: number[]): number[] {
    const remote = new Set(remoteIds.filter((n) => Number.isInteger(n) && n > 0));
    return localIds.filter((n) => Number.isInteger(n) && n > 0 && !remote.has(n));
}

export function buildBossFicheGaps(
    dungeons: { bossName: string; name: string; level: number | null }[],
    statsRows: { monsterName: string; lastSyncedAt: Date | string | null }[],
    nowMs: number = Date.now()
): BossFicheGap[] {
    const statsByKey = new Map<string, { monsterName: string; lastSyncedAt: Date | string | null }>();
    for (const r of statsRows) {
        const k = normKey(r.monsterName);
        if (k && !statsByKey.has(k)) statsByKey.set(k, r);
    }
    const gaps: BossFicheGap[] = [];
    for (const d of dungeons) {
        const key = normKey(d.bossName || d.name);
        const row = statsByKey.get(key);
        const lastMs = row?.lastSyncedAt ? new Date(row.lastSyncedAt).getTime() : NaN;
        if (!row || !Number.isFinite(lastMs)) {
            gaps.push({ bossName: d.bossName || d.name, dungeonName: d.name, level: d.level ?? null, reason: 'manquante', lastSyncedAt: null });
        } else if (nowMs - lastMs > DATA_HEALTH_FRESH_MS) {
            gaps.push({
                bossName: d.bossName || d.name,
                dungeonName: d.name,
                level: d.level ?? null,
                reason: 'périmée',
                lastSyncedAt: new Date(lastMs).toISOString(),
            });
        }
    }
    return gaps;
}
