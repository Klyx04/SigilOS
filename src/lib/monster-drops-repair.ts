/**
 * Réparation **bornée** des fiches monstres sans butin.
 *
 * 🐛 Mesure du 30/10/2026 : **106 fiches boss sur 146** servies par beta avaient
 * `monsterStats.drops: []`, alors que DofusDB documente ces butins et que la base locale
 * portait la donnée pour certains ids (`L'Éternel Conflit` 6792 : 21 butins en base, `[]`
 * servi). La cause n'est pas un siphon manquant mais une **dégradation à l'écriture**
 * (repli Unity persisté en succès) : `@/lib/data-health` traite désormais ce cas comme un
 * trou `incomplète`, et cette passe le **répare**.
 *
 * 🎯 Règles :
 *  - on re-fetch **par nom, sans id** : le nom exact retrouve l'id DofusDB réel (1186 pour
 *    `Blop Indigo Royal`, 147 pour `Bouftou Royal`, 6792 pour `L'Éternel Conflit`) — l'id
 *    local d'un doublon vide ne sert à rien ;
 *  - une seule tentative par **nom** (les doublons vides se réparent d'un coup) ;
 *  - un repli Unity (`source: "unity"`) n'est **jamais** persisté : budget DofusDB fermé ;
 *  - `limit` compte les **monstres traités** (une requête DofusDB chacun), pas les lignes ;
 *  - la fonction **ne jette jamais** : un échec unitaire n'arrête pas la passe. Le seul
 *    arrêt anticipé est le budget DofusDB **partagé** épuisé (`deferred`), qui n'est pas
 *    une panne.
 *
 * Module **injectable** (`db`, `fetchStats`, `persist`) : testable sans réseau ni base.
 */
import { isCompleteMonsterPayload } from "@/lib/data-health";
import { isLocalThrottleDeferred } from "@/lib/dofusdb-throttle";

/** Nombre de monstres réparés par passage quand l'appelant n'impose pas de borne. */
export const MONSTER_DROPS_REPAIR_DEFAULT_LIMIT = 25;

/** Nombre de noms d'échec détaillés dans le rapport (jamais 106 lignes de log). */
const MAX_FAILED_DETAILS = 5;

/** Ligne `MonsterStat` vue par la passe (le strict nécessaire). */
export interface RepairMonsterRow {
    monsterId: number;
    monsterName: string;
    dungeonName?: string | null;
    lastSyncedAt?: Date | string | null;
    stats: unknown;
}

export interface RepairMonsterDropsOptions {
    db: { monsterStat: { findMany(args: unknown): Promise<RepairMonsterRow[]> } };
    /** `getMonsterStats`, **sans id** : la résolution par nom retrouve l'id DofusDB réel. */
    fetchStats: (name: string, dungeonName?: string) => Promise<{ success: boolean; data?: any; error?: string }>;
    /** `persistMonsterStat` (ou un espion en test). */
    persist: (data: any) => Promise<void>;
    limit?: number;
    /**
     * Cible **des noms précis** (comparaison insensible à la casse et aux espaces) : réparer une
     * fiche **visible** sans consommer le budget DofusDB sur toute la file. Sans cette option, la
     * passe suit son ordre habituel (`lastSyncedAt asc`).
     */
    onlyNames?: string[];
}

export interface RepairMonsterDropsReport {
    /** Monstres effectivement interrogés (bornés par `limit`). */
    scanned: number;
    repaired: number;
    /** Replis Unity : rien persisté, la source n'a rien de mieux à offrir. */
    skippedUnity: number;
    failed: number;
    /** `true` = budget DofusDB **partagé** épuisé (passe arrêtée, à rejouer). */
    deferred: boolean;
    details: string[];
}


/**
 * Répare les fiches dont le payload n'est pas exploitable (`drops: []` non marqué).
 * Idempotent : une fiche complète n'est ni lue ni comptée.
 */
export async function repairMonsterDrops(options: RepairMonsterDropsOptions): Promise<RepairMonsterDropsReport> {
    const { db, fetchStats, persist } = options;
    const rawLimit = Number(options.limit);
    const limit = Number.isFinite(rawLimit) && rawLimit > 0
        ? Math.floor(rawLimit)
        : MONSTER_DROPS_REPAIR_DEFAULT_LIMIT;

    const report: RepairMonsterDropsReport = {
        scanned: 0,
        repaired: 0,
        skippedUnity: 0,
        failed: 0,
        deferred: false,
        details: [],
    };

    let rows: RepairMonsterRow[] = [];
    try {
        rows = await db.monsterStat.findMany({
            select: {
                monsterId: true,
                monsterName: true,
                dungeonName: true,
                lastSyncedAt: true,
                stats: true,
            },
            orderBy: { lastSyncedAt: "asc" },
        });
    } catch (error) {
        report.details.push(`lecture des fiches impossible : ${error instanceof Error ? error.message : String(error)}`);
        return report;
    }

    // Une seule tentative par NOM : deux lignes vides du même monstre (7972 / 1186) se
    // réparent avec la même requête, et on ne paie pas deux fois le budget DofusDB.
    const seen = new Set<string>();
    // Ciblage optionnel (`--nom=…`) : on ne garde que les noms demandés, pour réparer
    // une fiche visible tout de suite sans balayer la file entière.
    const onlyNames = new Set(
        (options.onlyNames ?? []).map((n) => String(n ?? "").trim().toLowerCase()).filter(Boolean),
    );
    const targets: RepairMonsterRow[] = [];
    for (const row of rows ?? []) {
        if (!row || typeof row.monsterName !== "string") continue;
        if (isCompleteMonsterPayload(row.stats)) continue;
        const key = row.monsterName.trim().toLowerCase();
        if (!key || seen.has(key)) continue;
        if (onlyNames.size > 0 && !onlyNames.has(key)) continue;
        seen.add(key);
        targets.push(row);
    }

    for (const row of targets) {
        if (report.scanned >= limit) break;
        report.scanned++;
        try {
            const res = await fetchStats(row.monsterName, row.dungeonName ?? undefined);
            const data = res?.success ? res.data : null;
            if (!data) {
                report.failed++;
                if (report.details.length < MAX_FAILED_DETAILS) {
                    report.details.push(`« ${row.monsterName} » : ${res?.error ?? "aucune fiche renvoyée"}`);
                }
                continue;
            }
            // Repli bestiaire client : aucun butin par construction, on ne l'écrit pas.
            if (data.source === "unity") {
                if (data.degraded === "quota") {
                    // Budget DofusDB **partagé** épuisé : continuer ne produirait que des faux
                    // « sans source » (mesure du 31/10/2026 : 66 sur 83). On s'arrête, on rejouera.
                    report.deferred = true;
                    if (report.details.length < MAX_FAILED_DETAILS) {
                        report.details.push("budget DofusDB épuisé — passe interrompue, à rejouer");
                    }
                    break;
                }
                report.skippedUnity++;
                continue;
            }
            if (!isCompleteMonsterPayload(data)) {
                report.failed++;
                if (report.details.length < MAX_FAILED_DETAILS) {
                    report.details.push(`« ${row.monsterName} » : source sans butin documenté`);
                }
                continue;
            }
            await persist({ ...data, dungeonName: row.dungeonName ?? data.dungeonName });
            report.repaired++;
        } catch (error) {
            if (isLocalThrottleDeferred(error)) {
                report.deferred = true;
                report.details.push(
                    `budget DofusDB partagé épuisé — passe arrêtée à « ${row.monsterName} », à rejouer.`
                );
                break;
            }
            report.failed++;
            if (report.details.length < MAX_FAILED_DETAILS) {
                report.details.push(`« ${row.monsterName} » : ${error instanceof Error ? error.message : String(error)}`);
            }
        }
    }

    return report;
}
