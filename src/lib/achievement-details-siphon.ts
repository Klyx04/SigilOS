/**
 * Succès / challenges — **la vraie explication, souveraine** (DofusDB) et de quoi alimenter l'icône
 * réelle du succès.
 *
 * 🐛 Demande user du 11/10/2026 : « on affiche une explication générique pour tous les succès
 * “special” des boss : “Vaincre tel boss dans son donjon en validant le challenge dédié.” — DofusDB
 * affiche la vraie explication, différent selon le boss […] c'est siphonnable ? ».
 *
 * ✅ Mesures (`curl` du 11/10/2026, jamais supposées) :
 *  - `GET api.dofusdb.fr/challenges?name.fr=Passer l'éponge` → `{ id: 979, iconId: 977 }` : **le nom
 *    du challenge suffit** à retrouver la ligne DofusDB (aucune jointure à deviner) ;
 *  - `GET api.dofusdb.fr/challenges/979?lang=fr` → `description.fr` = « À partir du tour 2, Mob
 *    l'éponge doit être poussé ou attiré au moins une fois à chaque tour global. » (le texte du
 *    survol), `activationCriterion` = `GM>0,928,1&Gm=d`, `completionCriterion` = `Ma=1`.
 *
 * 🔒 Doctrine : **garde d'identité** (le nom normalisé doit correspondre — jamais « le premier
 * résultat »), **budget partagé** (`dofusDbFetch`), **conditions lues** telles quelles (jamais
 * traduites en phrases inventées), icône servie par le **proxy interne**.
 * Module **injectable** (`db`, `fetchImpl`) : testable sans réseau ni base.
 */
import { DOFUSDB_PAGE_MAX, dofusDbFetch } from "@/lib/dofusdb-limiter";
import { resolveDofusAssetImageUrl } from "@/lib/dofus-image-url";
// 🚦 Le refus **local** du budget partagé n'est pas une panne : on attend la fenêtre, on rejoue, et
// seulement si le budget reste fermé on le **dit** (jamais « introuvable chez DofusDB » — mesure du
// 10/12/2026 : 82 succès sur 123 déclarés « introuvables » alors que `Batofu (Spécial)`,
// `Tournesol Affamé (Spécial)`, `Minotot (Spécial)`, `Kardorim (Spécial)`… répondent `total: 1`).
import {
    DOFUSDB_THROTTLE_MAX_REPLAYS,
    LocalThrottleDeferredError,
    isLocalThrottle,
    isLocalThrottleDeferred,
    throttleWaitMs,
} from "@/lib/dofusdb-throttle";

/** Pause (bornée) avant de rejouer une requête refusée par notre budget partagé. */
function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Appel JSON vers DofusDB, **honnête sur l'origine d'un échec** :
 *  - notre budget partagé refuse → on attend la fenêtre et on rejoue (`DOFUSDB_THROTTLE_MAX_REPLAYS`),
 *    puis on **lève** `LocalThrottleDeferredError` (la passe s'arrête proprement, rien n'est maquillé
 *    en « introuvable ») ;
 *  - DofusDB répond vraiment (`404`/`500`) → `null` (« rien trouvé pour ce nom ») ;
 *  - succès → le JSON.
 */
async function dofusDbJson<T>(
    input: string,
    fetchImpl: (input: string, init?: RequestInit) => Promise<Response>
): Promise<T | null> {
    let res = await fetchImpl(input);
    for (let replay = 0; replay < DOFUSDB_THROTTLE_MAX_REPLAYS && isLocalThrottle(res); replay++) {
        await sleep(throttleWaitMs(res));
        res = await fetchImpl(input);
    }
    if (isLocalThrottle(res)) throw new LocalThrottleDeferredError(throttleWaitMs(res));
    if (!res.ok) return null;
    return (await res.json()) as T;
}


/** Charge utile écrite en base pour un challenge (aucune phrase fabriquée). */
export interface ChallengeDetailPatch {
    description: string;
    iconUrl: string;
    conditions: Record<string, string | null>;
}

/** Ligne de `Challenge` vue par le siphon (le strict nécessaire). */
export interface ChallengeRow {
    id: string;
    name: string;
    description: string | null;
    iconUrl: string | null;
    /** Connu de la ligne Prisma complète (le siphon s'en sert pour écarter le placeholder). */
    slug?: string | null;
}

/** Client minimal attendu (Prisma, ou faux client de test). */
export interface ChallengeSiphonDb {
    challenge: {
        findMany(args?: unknown): Promise<ChallengeRow[]>;
        update(args: { where: { id: string }; data: Partial<ChallengeDetailPatch> }): Promise<unknown>;
    };
}

export interface ChallengeSiphonReport {
    scanned: number;
    updated: number;
    alreadyOk: number;
    missing: number;
    errors: number;
    written: number;
    /** Le budget DofusDB **partagé** a fermé la fenêtre : passe arrêtée, à rejouer (jamais « introuvable »). */
    deferred: boolean;
    retryAfterMs: number;
    details: string[];
}

/** Clé de comparaison d'un nom de challenge (accents / casse / ponctuation ignorés). */
export function challengeNameKey(value: unknown): string {
    return String(value ?? "")
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "");
}

/**
 * Gabarit **de seed** (« Vaincre tel boss dans son donjon … ») : ce n'est **pas** une
 * description réelle — DofusDB la remplacera par la vraie mécanique.
 *
 * 🐛 Mesure du 12/10/2026 (les 6 gabarits de `prisma/seed-data/game-data.json`) : `chrono`,
 * `compagnon`, `mystique`, `quatuor`, `sp-cial` et `trio` commencent **tous** par
 * « Vaincre tel boss » (casse comprise : « Vaincre Tel Boss » pour `compagnon`). La règle
 * précédente ne testait que « le texte est non vide » : dès que l'icône passait par le proxy,
 * la ligne était déclarée **complète** et n'était **plus jamais** re-siphonnée ⇒ 4 challenges
 * gardaient l'explication générique **pour toujours** (constat user : « le succès spécial garde
 * le texte générique »).
 */
export function isPlaceholderChallengeDescription(value: unknown): boolean {
    return /^vaincre tel boss\b/i.test(String(value ?? "").trim());
}

/** Déjà conforme ? (vraie description **et** icône déjà servie par le proxy) : idempotent. */
export function isChallengeDetailComplete(row: ChallengeRow): boolean {
    const text = (row.description ?? "").trim();
    const hasRealDescription = text.length > 0 && !isPlaceholderChallengeDescription(text);
    return hasRealDescription && !!row.iconUrl?.startsWith("/api/assets-dofus/");
}

/** Construit la charge utile depuis un objet DofusDB (pure : aucune IO, aucun texte inventé). */
export function buildChallengePatch(raw: any): ChallengeDetailPatch | null {
    const description = String(raw?.description?.fr ?? "").trim();
    if (!description) return null;
    const iconId = Math.floor(Number(raw?.iconId) || 0);
    const iconUrl = iconId > 0 ? resolveDofusAssetImageUrl("challenges", iconId) : null;
    if (!iconUrl) return null;
    return {
        description,
        iconUrl,
        conditions: {
            activationCriterion: raw?.activationCriterion ?? null,
            completionCriterion: raw?.completionCriterion ?? null,
        },
    };
}

/**
 * Résout le détail DofusDB d'un challenge **par son nom** (garde d'identité incluse).
 * @returns le patch, ou `null` si rien ne correspond vraiment (jamais « le premier résultat »).
 */
export async function fetchChallengeDetail(
    name: string,
    fetchImpl: (input: string, init?: RequestInit) => Promise<Response> = dofusDbFetch
): Promise<ChallengeDetailPatch | null> {
    const key = challengeNameKey(name);
    if (!key) return null;
    const payload = await dofusDbJson<any>(
        `https://api.dofusdb.fr/challenges?name.fr=${encodeURIComponent(name)}&lang=fr&$limit=5`,
        fetchImpl
    );
    const rows: any[] = Array.isArray(payload?.data) ? payload.data : [];
    const match = rows.find((row) => challengeNameKey(row?.name?.fr) === key);
    return match ? buildChallengePatch(match) : null;
}

/**
 * Passe idempotente : complète `description` / `iconUrl` / `conditions` des challenges.
 * `apply = false` ⇒ **aucune écriture** (simulation) : on dit exactement ce qui serait écrit.
 */
export async function siphonChallengeDetails(options: {
    db: ChallengeSiphonDb;
    apply?: boolean;
    limit?: number;
    fetchImpl?: typeof fetch;
    onProgress?: (message: string) => void;
}): Promise<ChallengeSiphonReport> {
    const { db, apply = false, limit, fetchImpl, onProgress } = options;
    const rows = await db.challenge.findMany({ orderBy: { name: "asc" } });
    const report: ChallengeSiphonReport = {
        scanned: 0,
        updated: 0,
        alreadyOk: 0,
        missing: 0,
        errors: 0,
        written: 0,
        deferred: false,
        retryAfterMs: 0,
        details: [],
    };

    for (const row of rows) {
        if (limit != null && report.scanned >= limit) break;
        report.scanned++;
        // Le challenge **placeholder** « Spécial » n'existe pas chez DofusDB (aucun challenge de
        // ce nom ⇒ une requête perdue à chaque passe) : c'est la passe « succès spéciaux » qui le
        // remplace, par achievement et id extrait du critère.
        if (GENERIC_SPECIAL_CHALLENGE_SLUGS.includes(row.slug ?? "")) {
            report.alreadyOk++;
            continue;
        }
        if (isChallengeDetailComplete(row)) {
            report.alreadyOk++;
            continue;
        }
        try {
            const patch = await fetchChallengeDetail(row.name, fetchImpl);
            if (!patch) {
                report.missing++;
                report.details.push(`#${row.id} « ${row.name} » : introuvable chez DofusDB (aucune écriture)`);
                continue;
            }
            report.updated++;
            if (apply) {
                await db.challenge.update({ where: { id: row.id }, data: patch });
                report.written++;
            }
            onProgress?.(`${apply ? "écrit" : "à écrire"} « ${row.name} » → ${patch.iconUrl}`);
        } catch (error) {
            if (isLocalThrottleDeferred(error)) {
                report.deferred = true;
                report.retryAfterMs = error.retryAfterMs;
                report.details.push(`budget DofusDB partagé épuisé — passe arrêtée à « ${row.name} », à rejouer.`);
                break;
            }
            report.errors++;
            report.details.push(`#${row.id} : ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    return report;
}

// ─────────────────────────────────────────────────────────────────────────────
// Succès « Spéciaux » **par donjon** (Lot E, 12/10/2026).
//
// 🐛 Le succès « Spécial » d'un donjon est **un seul succès partagé** : le seed crée une ligne
// `DungeonAchievement` par donjon, toutes rattachées au MÊME `Challenge` (« Spécial », slug
// `sp-cial`) — `Challenge.name`/`.slug` sont `@unique`, donc « Spécial » ne peut pas être dupliqué.
// Or c'est **la mécanique** qui dépend du boss. Mesure DofusDB (11-12/10/2026, `curl`) :
//   `achievements?name.fr=Mob l'Éponge (Spécial)` → `id 6150`, `iconId 10`,
//   `objectives[].criterion = (EH>979,0)` (**id du challenge réel**) ;
//   `challenges/979?lang=fr` → description réelle (« À partir du tour 2, Mob l'éponge… »).
// ⚠️ La recherche `name.fr=` de DofusDB est un **match exact** : `Meulou (Spécial)` répond,
//   `Meulou y es-tu` non (et `Batofu (Spécial)` répond ⇒ un `missing` massif trahit un refus de
//   NOTRE budget partagé, pas une absence — cf. `dofusDbJson`).
//
// La passe écrit donc, **sur la ligne du succès** : `description` (la mécanique du boss, colonne
// dédiée) + `imageUrl` (l'icône du succès), et **ramène** la ligne sur le challenge partagé
// « Spécial » ⇒ le nom affiché reste « Spécial », partout, sans toucher une seule vue. Les lignes
// qu'une passe antérieure avait re-pointées vers le challenge réel (détectées par `imageUrl`) sont
// récupérées au passage. Injectable (`db`, `fetchImpl`), **dry-run par défaut**.
// ─────────────────────────────────────────────────────────────────────────────

/** Slugs du challenge placeholder « Spécial » (seed : `sp-cial` ; normalisé : `special`). */
export const GENERIC_SPECIAL_CHALLENGE_SLUGS = ["sp-cial", "special"];

/** Extrait l'id du challenge réel depuis un critère d'objectif DofusDB `(EH>979,0)`. */
export function challengeIdFromCriterion(criterion: unknown): number | null {
    const match = /EH\s*>\s*(\d+)/i.exec(String(criterion ?? ""));
    return match ? Number(match[1]) : null;
}

/** Charge utile d'un succès « spécial » résolu : la **mécanique** du boss + l'icône du succès. */
export interface SpecialChallengePatch {
    /** La mécanique réelle (« À partir du tour 2, Mob l'éponge doit être poussé… »). */
    description: string;
    /** Icône du SUCCÈS lui-même (`img/achievements/{iconId}.png`) servie par le proxy. */
    achievementImageUrl: string | null;
}

/**
 * Construit le patch d'un succès « spécial » (pure : aucune IO). `null` si l'identité du challenge
 * n'est pas complète (nom + explication + icône réels) — jamais d'invention. Le **nom** sert de
 * garde d'identité (il vient d'être résolu par critère d'objectif) ; l'affichage reste « Spécial ».
 */
export function buildSpecialChallengePatch(achievementRaw: any, challengeRaw: any): SpecialChallengePatch | null {
    const challengeName = String(challengeRaw?.name?.fr ?? "").trim();
    const description = String(challengeRaw?.description?.fr ?? "").trim();
    const challengeIconId = Math.floor(Number(challengeRaw?.iconId) || 0);
    if (!challengeName || !description || challengeIconId <= 0) return null;
    const achievementIconId = Math.floor(Number(achievementRaw?.iconId) || 0);
    const achievementImageUrl =
        achievementIconId > 0 ? resolveDofusAssetImageUrl("achievements", achievementIconId) : null;
    return { description, achievementImageUrl };
}

/** Suffixe DofusDB d'un succès « spécial » (« Tynrils (Spécial) », « Mob l'Éponge (Spécial) »). */
export const SPECIAL_ACHIEVEMENT_SUFFIX = "(Spécial)";

/** Bornes du chargement groupé (141 succès « (Spécial) » au 10/12/2026 → 3 pages de 50). */
const SPECIAL_ACHIEVEMENT_MAX_PAGES = 6;

/**
 * Libellé d'un succès « spécial » **sans son suffixe**, normalisé (accents / casse / ponctuation).
 * `« Tynrils (Spécial) »` → `tynrils` · `« Mob l'Éponge (Spécial) »` → `mobleponge`.
 */
export function specialAchievementKey(name: unknown): string {
    return challengeNameKey(String(name ?? "").replace(/\(\s*sp[ée]cial\s*\)/i, " "));
}

/**
 * Charge **tous** les succès « … (Spécial) » de DofusDB et les indexe par libellé normalisé.
 *
 * 🐛 Mesure du 10/12/2026 (constat user : « ton scraping est forcément mauvais pour les boss succès
 * spéciaux ») : chercher par **nom exact** (`« {boss} (Spécial) »`) rate tous les libellés qui
 * diffèrent du nom du boss — `Tynril` → **« Tynrils (Spécial) »** (id 6204, critère `(EH>1039,0)`
 * → challenge « Prendre racine »). **141** succès « (Spécial) » existent, `name.fr[$regex]` les
 * rend ; on les prend **en entier** ⇒ ~3 requêtes pour **toute** la passe, au lieu de 2 par donjon
 * (le budget partagé de 30 req/min n'est plus jamais épuisé, donc plus de faux « introuvable »).
 * Le challenge visé — **avec sa description** — voyage **imbriqué** dans
 * `objectives[].readableCriterion` (mesuré sur 6204) ⇒ aucune requête par boss.
 */
export async function fetchSpecialAchievementIndex(
    fetchImpl: (input: string, init?: RequestInit) => Promise<Response> = dofusDbFetch
): Promise<Map<string, any>> {
    const index = new Map<string, any>();
    for (let skip = 0; skip < SPECIAL_ACHIEVEMENT_MAX_PAGES * DOFUSDB_PAGE_MAX; skip += DOFUSDB_PAGE_MAX) {
        const payload = await dofusDbJson<any>(
            `https://api.dofusdb.fr/achievements?name.fr%5B%24regex%5D=${encodeURIComponent(SPECIAL_ACHIEVEMENT_SUFFIX)}`
                + `&lang=fr&$limit=${DOFUSDB_PAGE_MAX}&$skip=${skip}`,
            fetchImpl
        );
        const rows: any[] = Array.isArray(payload?.data) ? payload.data : [];
        for (const row of rows) {
            const key = specialAchievementKey(row?.name?.fr);
            if (key) index.set(key, row);
        }
        // Une page courte ne signifie pas la fin (cf. `hasMorePages`) : on s'arrête sur page vide.
        if (rows.length === 0) break;
    }
    return index;
}

/**
 * Associe un nom de boss au succès « (Spécial) » de l'index : correspondance **exacte** d'abord,
 * puis le **seul** candidat dont le libellé prolonge le nom du boss (ou l'inverse) — `Tynril` →
 * `Tynrils`. Plusieurs candidats ⇒ **aucun** (on ne devine jamais « le premier venu »).
 */
export function findSpecialAchievement(index: Map<string, any>, bossName: string): any | null {
    const boss = challengeNameKey(bossName);
    if (!boss) return null;
    const exact = index.get(boss);
    if (exact) return exact;
    const candidates: any[] = [];
    for (const [key, value] of index) {
        if (key.startsWith(boss) || boss.startsWith(key)) candidates.push(value);
    }
    return candidates.length === 1 ? candidates[0] : null;
}

/**
 * Le challenge **imbriqué** dans le critère d'objectif (`readableCriterion`) du succès : il porte
 * la vraie description ⇒ aucune requête `challenges/{id}` n'est nécessaire (mesuré sur 6204).
 */
export function nestedChallengeOf(achievement: any): any | null {
    const objectives: any[] = Array.isArray(achievement?.objectives) ? achievement.objectives : [];
    for (const objective of objectives) {
        if (challengeIdFromCriterion(objective?.criterion) === null) continue;
        const flat: any[] = Array.isArray(objective?.readableCriterion)
            ? objective.readableCriterion.flat(2)
            : [];
        const challenge = flat.find(
            (entry) => entry && typeof entry === "object" && entry.className === "ChallengeData" && entry?.description?.fr
        );
        if (challenge) return challenge;
    }
    return null;
}

/** Ligne de `DungeonAchievement` vue par la passe « succès spéciaux » (le strict nécessaire). */
export interface SpecialAchievementRow {
    id: string;
    description: string | null;
    imageUrl: string | null;
    dungeon: { bossName: string | null; name: string };
    challenge: { id: string; name: string; slug: string | null };
}

/** Client minimal attendu par la passe (Prisma, ou faux client de test). */
export interface SpecialSiphonDb {
    dungeonAchievement: {
        findMany(args?: unknown): Promise<SpecialAchievementRow[]>;
        update(args: {
            where: { id: string };
            data: { challengeId: string; description: string; imageUrl: string | null };
        }): Promise<unknown>;
    };
    challenge: {
        findFirst(args?: unknown): Promise<{ id: string; name: string; slug: string | null } | null>;
    };
}

export interface SpecialSiphonReport {
    scanned: number;
    updated: number;
    alreadyOk: number;
    missing: number;
    errors: number;
    written: number;
    /** Le budget DofusDB **partagé** a fermé la fenêtre : passe arrêtée, à rejouer (jamais « introuvable »). */
    deferred: boolean;
    retryAfterMs: number;
    details: string[];
}

/**
 * Cette ligne `DungeonAchievement` porte-t-elle le succès **« Spécial »** du donjon ?
 *  - `sp-cial`/`special` : jamais touchée (cas nominal du seed) ;
 *  - `imageUrl` renseignée : la ligne a été écrite par une passe **antérieure** (le seed la laisse
 *    `null`), qui la re-pointait vers le challenge réel du boss ⇒ on la récupère pour la ramener
 *    sur le challenge partagé « Spécial » et lui écrire la mécanique du donjon.
 * ⚠️ L'`imageUrl` d'un succès n'est écrite **que** par cette passe (cf. `DungeonAchievement`, seed
 * `imageUrl: null`) : c'est le seul marqueur disponible, `Challenge.name` étant `@unique`.
 */
export function isSpecialAchievementRow(row: Pick<SpecialAchievementRow, "imageUrl" | "challenge">): boolean {
    return GENERIC_SPECIAL_CHALLENGE_SLUGS.includes(row.challenge?.slug ?? "") || row.imageUrl != null;
}

/**
 * Passe des succès « spéciaux » : écrit **le texte du donjon** sur la ligne du succès
 * (`DungeonAchievement.description`, lue chez DofusDB) + son icône (`imageUrl`), et **ramène** la
 * ligne sur le challenge partagé « Spécial » (nom affiché unique, inchangé partout).
 * Idempotente : une ligne déjà complète (`Spécial` + texte + icône) ne consomme ni budget ni requête.
 * `apply = false` ⇒ **aucune écriture** (simulation).
 */
export async function siphonSpecialAchievements(options: {
    db: SpecialSiphonDb;
    apply?: boolean;
    limit?: number;
    fetchImpl?: typeof fetch;
}): Promise<SpecialSiphonReport> {
    const { db, apply = false, limit, fetchImpl } = options;
    const report: SpecialSiphonReport = {
        scanned: 0,
        updated: 0,
        alreadyOk: 0,
        missing: 0,
        errors: 0,
        written: 0,
        deferred: false,
        retryAfterMs: 0,
        details: [],
    };

    // Le challenge **partagé** « Spécial » : c'est lui qui porte le nom affiché partout (unique en
    // base). Sans lui, rien à faire (le seed le crée ; on n'en invente jamais un).
    const generic = await db.challenge.findFirst({
        where: { slug: { in: GENERIC_SPECIAL_CHALLENGE_SLUGS } },
    });
    if (!generic) {
        report.details.push(
            `challenge « Spécial » absent (${GENERIC_SPECIAL_CHALLENGE_SLUGS.join(" / ")}) : rien à faire.`
        );
        return report;
    }

    const rows = await db.dungeonAchievement.findMany({
        include: {
            dungeon: { select: { bossName: true, name: true } },
            challenge: { select: { id: true, name: true, slug: true } },
        },
    });

    // Chargé **paresseusement**, une seule fois pour toute la passe (0 requête si tout est déjà OK).
    let index: Map<string, any> | null = null;

    for (const row of rows) {
        if (!isSpecialAchievementRow(row)) continue;
        // Déjà complet (nom « Spécial » + texte du donjon + icône) : ni requête ni budget consommés.
        if (row.challenge?.id === generic.id && row.description != null && row.imageUrl != null) {
            report.alreadyOk++;
            continue;
        }
        if (limit != null && report.scanned >= limit) break;
        report.scanned++;
        const bossName = String(row.dungeon?.bossName || row.dungeon?.name || "").trim();
        if (!bossName) {
            report.missing++;
            continue;
        }
        try {
            // Un seul chargement pour TOUTE la passe (141 succès « (Spécial) » = 3 requêtes) : plus de
            // 2 requêtes par donjon ⇒ plus de budget épuisé, donc plus de faux « introuvable ».
            index ??= await fetchSpecialAchievementIndex(fetchImpl as never);
            const achievement = findSpecialAchievement(index, bossName);
            if (!achievement) {
                report.missing++;
                report.details.push(`« ${bossName} » : aucun succès « (Spécial) » chez DofusDB (aucune écriture)`);
                continue;
            }
            // Le challenge (et sa description) voyage **imbriqué** dans le critère d'objectif.
            const challengeRaw = nestedChallengeOf(achievement);
            const patch = challengeRaw ? buildSpecialChallengePatch(achievement, challengeRaw) : null;
            if (!patch) {
                report.missing++;
                report.details.push(`« ${bossName} » : succès « (Spécial) » sans mécanique lisible (aucune écriture)`);
                continue;
            }
            report.updated++;
            if (apply) {
                await db.dungeonAchievement.update({
                    where: { id: row.id },
                    data: {
                        challengeId: generic.id,
                        description: patch.description,
                        imageUrl: patch.achievementImageUrl,
                    },
                });
                report.written++;
            }
            report.details.push(`« ${bossName} » : « Spécial » ← ${patch.description.slice(0, 70)}…`);
        } catch (error) {
            if (isLocalThrottleDeferred(error)) {
                report.deferred = true;
                report.retryAfterMs = error.retryAfterMs;
                report.details.push(`budget DofusDB partagé épuisé — passe arrêtée à « ${bossName} », à rejouer.`);
                break;
            }
            report.errors++;
            report.details.push(`« ${bossName} » : ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    return report;
}

