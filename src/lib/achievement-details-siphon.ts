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
import { dofusDbFetch } from "@/lib/dofusdb-limiter";
import { resolveDofusAssetImageUrl } from "@/lib/dofus-image-url";
import { slugifyBossName } from "@/lib/boss-slug";

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
    const res = await fetchImpl(
        `https://api.dofusdb.fr/challenges?name.fr=${encodeURIComponent(name)}&lang=fr&$limit=5`
    );
    if (!res.ok) return null;
    const payload: any = await res.json();
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
            report.errors++;
            report.details.push(`#${row.id} : ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    return report;
}

// ─────────────────────────────────────────────────────────────────────────────
// Succès « Spéciaux » **par donjon** (Lot E, 12/10/2026).
//
// 🐛 Le succès « Spécial » d'un boss est un challenge **générique seedé** (nom « Spécial »,
// slug `sp-cial`, icône `spécial.png`) **partagé par tous les donjons** ⇒ il ne peut pas porter
// le vrai intitulé par boss. Mesure DofusDB (12/10/2026, `curl`, jamais supposée) :
//   `achievements?name.fr=Mob l'Éponge (Spécial)` → `id 6150`, `iconId 10`,
//   `objectives[].criterion = (EH>979,0)` (**id du challenge réel**) ;
//   `challenges/979?lang=fr` → nom « Passer l'éponge », description réelle, `iconId 977`.
//
// La passe **re-pointe** chaque `DungeonAchievement` « Spécial » vers un challenge **réel**
// (créé/réutilisé par slug) et renseigne `imageUrl` (icône du succès). **Aucune migration** :
// `Challenge` porte déjà `name`/`description`/`iconUrl`/`conditions` ; `DungeonAchievement.imageUrl`
// existe. Injectable (`db`, `fetchImpl`), **dry-run par défaut**.
// ─────────────────────────────────────────────────────────────────────────────

/** Slugs du challenge placeholder « Spécial » (seed : `sp-cial` ; normalisé : `special`). */
export const GENERIC_SPECIAL_CHALLENGE_SLUGS = ["sp-cial", "special"];

/** Extrait l'id du challenge réel depuis un critère d'objectif DofusDB `(EH>979,0)`. */
export function challengeIdFromCriterion(criterion: unknown): number | null {
    const match = /EH\s*>\s*(\d+)/i.exec(String(criterion ?? ""));
    return match ? Number(match[1]) : null;
}

/** Nom DofusDB attendu du succès « spécial » d'un boss : « Mob l'Éponge (Spécial) ». */
export function specialAchievementName(bossName: string): string {
    return `${String(bossName ?? "").trim()} (Spécial)`;
}

/** Charge utile d'un succès « spécial » résolu (challenge réel + icône du succès). */
export interface SpecialChallengePatch {
    /** Nom réel du challenge (« Passer l'éponge ») — devient l'intitulé affiché. */
    challengeName: string;
    /** Icône du challenge (proxy interne `challenges`, jamais un hotlink). */
    iconUrl: string;
    description: string;
    conditions: Record<string, string | null>;
    /** Icône du SUCCÈS lui-même (`img/achievements/{iconId}.png`) servie par le proxy. */
    achievementImageUrl: string | null;
}

/**
 * Construit le patch d'un succès « spécial » (pure : aucune IO). `null` si l'identité n'est pas
 * complète (nom + description + icône du challenge réels) — jamais d'invention.
 */
export function buildSpecialChallengePatch(achievementRaw: any, challengeRaw: any): SpecialChallengePatch | null {
    const challengeName = String(challengeRaw?.name?.fr ?? "").trim();
    const description = String(challengeRaw?.description?.fr ?? "").trim();
    const challengeIconId = Math.floor(Number(challengeRaw?.iconId) || 0);
    if (!challengeName || !description || challengeIconId <= 0) return null;
    const iconUrl = resolveDofusAssetImageUrl("challenges", challengeIconId);
    if (!iconUrl) return null;
    const achievementIconId = Math.floor(Number(achievementRaw?.iconId) || 0);
    const achievementImageUrl =
        achievementIconId > 0 ? resolveDofusAssetImageUrl("achievements", achievementIconId) : null;
    return {
        challengeName,
        iconUrl,
        description,
        conditions: {
            activationCriterion: challengeRaw?.activationCriterion ?? null,
            completionCriterion: challengeRaw?.completionCriterion ?? null,
        },
        achievementImageUrl,
    };
}

/**
 * Résout le succès « spécial » d'un boss chez DofusDB : recherche l'achievement par son nom
 * (garde d'identité), lit l'id du challenge réel dans le critère d'objectif, puis le challenge.
 * @returns le patch, ou `null` si rien ne correspond (jamais « le premier résultat »).
 */
export async function fetchSpecialChallengeForBoss(
    bossName: string,
    fetchImpl: (input: string, init?: RequestInit) => Promise<Response> = dofusDbFetch
): Promise<SpecialChallengePatch | null> {
    const wanted = specialAchievementName(bossName);
    const key = challengeNameKey(wanted);
    // Un nom vide donnerait « (Spécial) » : rien à chercher.
    if (!key || key === challengeNameKey("(Spécial)")) return null;

    const searchRes = await fetchImpl(
        `https://api.dofusdb.fr/achievements?name.fr=${encodeURIComponent(wanted)}&lang=fr&$limit=5`
    );
    if (!searchRes.ok) return null;
    const searchPayload: any = await searchRes.json();
    const rows: any[] = Array.isArray(searchPayload?.data) ? searchPayload.data : [];
    const achievement = rows.find((row) => challengeNameKey(row?.name?.fr) === key);
    if (!achievement) return null;

    const objectives: any[] = Array.isArray(achievement?.objectives) ? achievement.objectives : [];
    const criterion = objectives.map((o) => o?.criterion).find((c) => challengeIdFromCriterion(c) !== null);
    const challengeId = challengeIdFromCriterion(criterion);
    if (!challengeId) return null;

    const challengeRes = await fetchImpl(`https://api.dofusdb.fr/challenges/${challengeId}?lang=fr`);
    if (!challengeRes.ok) return null;
    const challengeRaw: any = await challengeRes.json();
    return buildSpecialChallengePatch(achievement, challengeRaw);
}

/** Client minimal attendu par la passe (Prisma, ou faux client de test). */
export interface SpecialSiphonDb {
    dungeonAchievement: {
        findMany(args?: unknown): Promise<
            Array<{
                id: string;
                imageUrl: string | null;
                dungeon: { bossName: string | null; name: string };
                challenge: { id: string; name: string; slug: string | null };
            }>
        >;
        update(args: { where: { id: string }; data: { challengeId: string; imageUrl: string | null } }): Promise<unknown>;
    };
    challenge: {
        findFirst(args?: unknown): Promise<{ id: string } | null>;
        create(args: { data: Record<string, unknown> }): Promise<{ id: string }>;
        update(args: { where: { id: string }; data: Record<string, unknown> }): Promise<unknown>;
    };
}

export interface SpecialSiphonReport {
    scanned: number;
    updated: number;
    alreadyOk: number;
    missing: number;
    errors: number;
    written: number;
    details: string[];
}

/**
 * Passe des succès « spéciaux » : re-pointe chaque `DungeonAchievement` du challenge placeholder
 * vers le **challenge réel** du donjon (nom/description/icône réels) + renseigne l'icône du succès.
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
        details: [],
    };

    const rows = await db.dungeonAchievement.findMany({
        where: { challenge: { slug: { in: GENERIC_SPECIAL_CHALLENGE_SLUGS } } },
        include: {
            dungeon: { select: { bossName: true, name: true } },
            challenge: { select: { id: true, name: true, slug: true } },
        },
    });

    for (const row of rows) {
        if (limit != null && report.scanned >= limit) break;
        report.scanned++;
        const bossName = String(row.dungeon?.bossName || row.dungeon?.name || "").trim();
        if (!bossName) {
            report.missing++;
            continue;
        }
        try {
            const patch = await fetchSpecialChallengeForBoss(bossName, fetchImpl as never);
            if (!patch) {
                report.missing++;
                report.details.push(`« ${bossName} » : succès spécial introuvable chez DofusDB (aucune écriture)`);
                continue;
            }
            report.updated++;
            if (apply) {
                const slug = slugifyBossName(patch.challengeName);
                let challengeId: string | null = null;
                const existing = await db.challenge.findFirst({ where: { slug } });
                if (existing) {
                    challengeId = existing.id;
                    await db.challenge.update({
                        where: { id: challengeId },
                        data: {
                            description: patch.description,
                            iconUrl: patch.iconUrl,
                            conditions: patch.conditions,
                        },
                    });
                } else {
                    const created = await db.challenge.create({
                        data: {
                            name: patch.challengeName,
                            slug,
                            description: patch.description,
                            iconUrl: patch.iconUrl,
                            conditions: patch.conditions,
                        },
                    });
                    challengeId = created.id;
                }
                await db.dungeonAchievement.update({
                    where: { id: row.id },
                    data: { challengeId, imageUrl: patch.achievementImageUrl },
                });
                report.written++;
            }
            report.details.push(`« ${bossName} » → ${patch.challengeName} (${patch.iconUrl})`);
        } catch (error) {
            report.errors++;
            report.details.push(`« ${bossName} » : ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    return report;
}

