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

/** Déjà conforme ? (texte réel présent **et** icône déjà servie par le proxy) : idempotent. */
export function isChallengeDetailComplete(row: ChallengeRow): boolean {
    const hasRealDescription = !!row.description && row.description.trim().length > 0;
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

