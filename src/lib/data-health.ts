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
    /**
     * Remplace « Jamais » quand la ligne **n'a pas de passe** à afficher : « script local »
     * (fichier produit hors ligne — dataset `SCRIPT`) ou « — » (compteurs disque/BDD).
     * Sans ça, une ligne qui n'a jamais eu de run prétendait que quelque chose aurait dû tourner
     * et n'a jamais tourné (constat user du 10/10/2026).
     */
    dernierRunNote?: string | null;
    goTab: string;
    goLabel: string;
}

export interface BossFicheGap {
    bossName: string;
    dungeonName: string;
    level: number | null;
    /**
     * `manquante` = aucune ligne locale ; `incomplète` = la meilleure ligne existe mais son
     * payload n'exploite rien (butins vides **sans** `dropsUnavailable`) ; `périmée` = la
     * meilleure ligne est complète mais date de plus de 24 h.
     */
    reason: 'manquante' | 'périmée' | 'incomplète';
    lastSyncedAt: string | null;
    /** Id Ankama de la ligne retenue (`null` si aucune) — permet un repli par id côté cron. */
    monsterId: number | null;
}

/** Ligne `MonsterStat` vue par le dry-run (le strict nécessaire). */
export interface BossFicheStatRow {
    monsterName: string;
    monsterId?: number | null;
    lastSyncedAt: Date | string | null;
    /**
     * `true` = payload exploitable (butins réels **ou** aucun butin documenté chez DofusDB).
     * `false` = ligne présente mais vide (repli Unity, `drops: []`).
     * `undefined` = non renseigné (appelant historique) ⇒ jamais déclarée incomplète.
     */
    complete?: boolean;
}

export const DATA_HEALTH_FRESH_MS = 24 * 60 * 60 * 1000;

/**
 * Un payload monstre est **exploitable** quand il porte un butin réel, ou quand la source a
 * répondu qu'il n'y a **aucun** butin documenté (`dropsUnavailable`). Un `drops: []` non marqué
 * est un trou (repli Unity, 429 DofusDB) — jamais une vérité : 106 fiches beta sur 146
 * servaient « aucun butin » à cause de ça (mesure du 30/10/2026).
 */
export function isCompleteMonsterPayload(stats: unknown): boolean {
    const s = stats as { drops?: unknown[]; dropsUnavailable?: boolean } | null | undefined;
    if (s?.dropsUnavailable === true) return true;
    return Array.isArray(s?.drops) && s.drops.length > 0;
}


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
    statsRows: BossFicheStatRow[],
    nowMs: number = Date.now()
): BossFicheGap[] {
    // 🔎 Une seule ligne retenue par nom : la **complète** passe devant une ligne vide, la
    // fraîcheur ne départageant que les égalités (même règle que la ligne servie, cf.
    // `@/lib/monster-stat-choice`). Sans ça, un doublon vide récent masquait le frère complet
    // et la fiche était déclarée « fraîche » alors qu'elle n'affichait aucun butin.
    type Best = { row: BossFicheStatRow; at: number; complete: boolean };
    const statsByKey = new Map<string, Best>();
    for (const r of statsRows) {
        const k = normKey(r.monsterName);
        if (!k) continue;
        const raw = r.lastSyncedAt ? new Date(r.lastSyncedAt).getTime() : NaN;
        const candidate: Best = {
            row: r,
            at: Number.isFinite(raw) ? raw : NaN,
            complete: r.complete !== false,
        };
        const current = statsByKey.get(k);
        if (!current) {
            statsByKey.set(k, candidate);
            continue;
        }
        if (candidate.complete !== current.complete) {
            if (candidate.complete) statsByKey.set(k, candidate);
            continue;
        }
        const curAt = Number.isFinite(current.at) ? current.at : -Infinity;
        const candAt = Number.isFinite(candidate.at) ? candidate.at : -Infinity;
        if (candAt > curAt) statsByKey.set(k, candidate);
    }

    const gaps: BossFicheGap[] = [];
    for (const d of dungeons) {
        const key = normKey(d.bossName || d.name);
        const hit = statsByKey.get(key);
        const best = hit && Number.isFinite(hit.at) ? hit : null;
        const monsterId = hit && Number.isFinite(Number(hit.row.monsterId)) ? Number(hit.row.monsterId) : null;
        const base = {
            bossName: d.bossName || d.name,
            dungeonName: d.name,
            level: d.level ?? null,
            monsterId,
        };
        if (!best) {
            gaps.push({ ...base, reason: 'manquante', lastSyncedAt: null });
        } else if (!best.complete) {
            // Présente et fraîche ne veut pas dire **servable** : un repli Unity est un trou.
            gaps.push({ ...base, reason: 'incomplète', lastSyncedAt: new Date(best.at).toISOString() });
        } else if (nowMs - best.at > DATA_HEALTH_FRESH_MS) {
            gaps.push({ ...base, reason: 'périmée', lastSyncedAt: new Date(best.at).toISOString() });
        }
    }
    return gaps;
}
