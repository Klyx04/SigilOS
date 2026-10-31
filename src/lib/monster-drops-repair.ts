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
 * Idempotent : une fiche complète n'est ni lue ni comptée — et un nom **déjà servi** par une fiche
 * complète ne l'est pas davantage, même si une ligne morte dort à côté (même nom, autre id).
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

    // 🔎 Un nom déjà **servi** par une fiche complète n'est pas un trou : la ligne morte qui dort
    // à côté (même nom, autre id) ne doit être ni lue, ni comptée, ni re-fetchée. Sans ce pré-tri,
    // le rapport radotait (« N fiche(s) analysée(s) » à chaque passe alors que la fiche affichée
    // était juste) et le budget DofusDB (30 req/min) partait sur une ligne que personne ne lit.
    // `buildBossFicheGaps` applique déjà cette préférence côté affichage : même règle ici.
    const completeNames = new Set<string>();
    for (const row of rows ?? []) {
        if (!row || typeof row.monsterName !== "string") continue;
        if (!isCompleteMonsterPayload(row.stats)) continue;
        const key = row.monsterName.trim().toLowerCase();
        if (key) completeNames.add(key);
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
        // Frère complet du même nom ⇒ la fiche servie est saine : on ne lit pas, on ne compte pas.
        if (completeNames.has(key)) continue;
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

/**
 * Nettoie les **doublons vides** : un même nom peut exister sous deux ids (DofusDB `1186` et un
 * ancien repli `7972`). Quand **une** ligne du nom porte un butin et qu'une autre est vide, la vide
 * est **morte** — elle faisait radoter la passe de réparation (« 60 réparées » à chaque exécution,
 * mesure du 31/10/2026) sans jamais converger.
 *
 * Règles : jamais la dernière ligne d'un nom, jamais une ligne complète. Aucune exception ;
 * `dryRun` compte sans supprimer.
 */
export interface CleanupDuplicateOptions {
    db: {
        monsterStat: {
            findMany(args: unknown): Promise<RepairMonsterRow[]>;
            deleteMany(args: unknown): Promise<{ count: number }>;
        };
    };
    dryRun?: boolean;
}

export interface CleanupDuplicateReport {
    /** Noms pour lesquels au moins un doublon vide existe. */
    names: number;
    /** Lignes vides supprimées (en `dryRun` : celles qui le seraient). */
    removed: number;
    details: string[];
}

export async function removeEmptyDuplicateRows(
    options: CleanupDuplicateOptions,
): Promise<CleanupDuplicateReport> {
    const report: CleanupDuplicateReport = { names: 0, removed: 0, details: [] };

    let rows: RepairMonsterRow[] = [];
    try {
        rows = await options.db.monsterStat.findMany({
            select: { monsterId: true, monsterName: true, stats: true },
        });
    } catch (error) {
        report.details.push(`lecture des fiches impossible : ${error instanceof Error ? error.message : String(error)}`);
        return report;
    }

    const groups = new Map<string, { complete: number[]; empty: number[] }>();
    for (const row of rows ?? []) {
        if (!row || typeof row.monsterName !== "string") continue;
        const key = row.monsterName.trim().toLowerCase();
        if (!key) continue;
        const bucket = groups.get(key) ?? { complete: [], empty: [] };
        if (isCompleteMonsterPayload(row.stats)) bucket.complete.push(row.monsterId);
        else bucket.empty.push(row.monsterId);
        groups.set(key, bucket);
    }

    for (const [, bucket] of groups) {
        if (bucket.complete.length === 0 || bucket.empty.length === 0) continue;
        report.names++;
        if (report.details.length < MAX_FAILED_DETAILS) {
            report.details.push(`doublon vide ${bucket.empty.join(", ")} — fiche saine ${bucket.complete.join(", ")}`);
        }
        if (options.dryRun) {
            report.removed += bucket.empty.length;
            continue;
        }
        try {
            const res = await options.db.monsterStat.deleteMany({ where: { monsterId: { in: bucket.empty } } });
            report.removed += res?.count ?? 0;
        } catch (error) {
            report.details.push(`suppression impossible : ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    return report;
}


/**
 * **Découverte** : crée la fiche des monstres **jamais siphonnés** (tout le bestiaire public
 * `/bestiaire/<slug>`), par **lots reprenables** (`afterId`) et dans le même budget.
 *
 * Mesure du 31/10/2026 : 4 728 monstres au catalogue, **4 469** sans fiche complète — à ~30
 * requêtes/minute c'est un travail de plusieurs passes, jamais un blocage du site.
 */
export interface DiscoverMonsterFichesOptions {
    db: { monster: { findMany(args: unknown): Promise<{ id: string; name: string }[]> } };
    /** `getMonsterStats` par nom (sans id : c'est l'id DofusDB qui fait foi). */
    fetchStats: (name: string) => Promise<{ success: boolean; data?: any; error?: string }>;
    persist: (data: any) => Promise<void>;
    /** Noms **déjà servis** par une fiche complète (chargés une fois par l'appelant). */
    knownNames: ReadonlySet<string>;
    limit?: number;
    /**
     * Curseur de reprise = dernier `Monster.id` traité. ⚠️ `Monster.id` est un **`String`**
     * (cuid, ordonnable) : un curseur numérique faisait échouer la lecture Prisma (mesure du
     * 31/10/2026 : « 0 monstre interrogé », erreur avalée).
     */
    afterCursor?: string;
}

export interface DiscoverMonsterFichesReport {
    scanned: number;
    created: number;
    skippedKnown: number;
    skippedUnity: number;
    failed: number;
    deferred: boolean;
    /** Curseur à repasser en `afterCursor` : dernier id **traité avec succès** ("" = fin). */
    lastCursor: string;
    details: string[];
}

/** Monstres examinés par passage quand l'appelant n'impose pas de borne. */
export const DISCOVER_FICHES_DEFAULT_LIMIT = 200;

export async function discoverMonsterFiches(
    options: DiscoverMonsterFichesOptions,
): Promise<DiscoverMonsterFichesReport> {
    const rawLimit = Number(options.limit);
    const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.floor(rawLimit) : DISCOVER_FICHES_DEFAULT_LIMIT;
    const afterCursor = typeof options.afterCursor === "string" ? options.afterCursor.trim() : "";

    const report: DiscoverMonsterFichesReport = {
        scanned: 0,
        created: 0,
        skippedKnown: 0,
        skippedUnity: 0,
        failed: 0,
        deferred: false,
        lastCursor: afterCursor,
        details: [],
    };

    let rows: { id: string; name: string }[] = [];
    try {
        rows = await options.db.monster.findMany({
            where: afterCursor ? { id: { gt: afterCursor } } : {},
            orderBy: { id: "asc" },
            take: limit,
            select: { id: true, name: true },
        });
    } catch (error) {
        report.details.push(`lecture du catalogue impossible : ${error instanceof Error ? error.message : String(error)}`);
        return report;
    }

    // Le curseur n'avance **qu'après** un monstre traité (sinon une reprise sauterait le fautif).
    let cursor = afterCursor;
    for (const row of rows ?? []) {
        if (!row || typeof row.name !== "string" || !row.name.trim()) {
            cursor = row?.id ?? cursor;
            continue;
        }
        if (options.knownNames.has(row.name.trim().toLowerCase())) {
            report.skippedKnown++;
            cursor = row.id;
            continue;
        }
        report.scanned++;
        try {
            const res = await options.fetchStats(row.name);
            const data = res?.success ? res.data : null;
            if (!data) {
                report.failed++;
                if (report.details.length < MAX_FAILED_DETAILS) {
                    report.details.push(`« ${row.name} » : ${res?.error ?? "aucune fiche renvoyée"}`);
                }
                cursor = row.id;
                continue;
            }
            if (data.source === "unity") {
                if (data.degraded === "quota") {
                    report.deferred = true;
                    break;
                }
                report.skippedUnity++;
                cursor = row.id;
                continue;
            }
            if (!isCompleteMonsterPayload(data)) {
                report.failed++;
                if (report.details.length < MAX_FAILED_DETAILS) {
                    report.details.push(`« ${row.name} » : source sans butin documenté`);
                }
                cursor = row.id;
                continue;
            }
            await options.persist(data);
            report.created++;
            cursor = row.id;
        } catch (error) {
            if (isLocalThrottleDeferred(error)) {
                report.deferred = true;
                break;
            }
            report.failed++;
            if (report.details.length < MAX_FAILED_DETAILS) {
                report.details.push(`« ${row.name} » : ${error instanceof Error ? error.message : String(error)}`);
            }
            cursor = row.id;
        }
    }

    report.lastCursor = cursor;
    return report;
}

