/**
 * Rail de veille des datasets DofusDB — **brique PURE** (aucun réseau, aucun Prisma).
 *
 * 🎯 Pourquoi ce module existe (session 27/09/2026, demande user : « ça fait des mois qu'on
 * n'arrive pas à un truc stable pour du long terme avec les siphons de mise à jour ») :
 * chaque dataset était siphonné à sa façon — passe complète relancée de zéro, pas de mémoire de
 * l'endroit où on s'était arrêté, pas de notion de volume, d'où les passes de 30 min, les 429 et
 * les trous silencieux. Ici on pose **un seul contrat**, testable sans réseau :
 *
 *   1. **Filigrane** (`id[$gt]`) : une passe reprend EXACTEMENT où la précédente s'est arrêtée ;
 *   2. **Budget** : une passe traite au plus `limit` entités (borné, jamais « tout d'un coup ») ;
 *   3. **Tri stable** (`$sort=id`) : l'ordre ne dépend pas de la disponibilité de l'API ;
 *   4. **Jamais de recul** : le filigrane ne recule jamais (une réponse partielle ne réécrit pas
 *      une position acquise) ;
 *   5. **Validation avant appel** : DofusDB répond **HTTP 500** à une date invalide (mesuré le
 *      27/09/2026, `updatedAt[$gte]=pas-une-date`) ⇒ on refuse d'appeler plutôt que de casser.
 *
 * Mesures du 27/09/2026 sur `/monsters` (5 135 entités) qui fondent ces choix :
 *   · `$limit=5&$skip=0` → ids 31,34,36,42,46 ; `$skip=5` → 47,48,52,53,54 ; `$skip=100` → 207,208,209
 *     (**`$skip` fiable ET trié par id**, contrairement à `/quests` où `total` retombe à 0) ;
 *   · `id[$gt]=31&$sort=id` → 34,36,42 ; +`$skip=3` → 46,47,48 (**filigrane par id opérationnel**) ;
 *   · `updatedAt[$gte]` sur 30 jours → **0 entité** : le catalogue est **figé depuis le 23/06/2026**
 *     ⇒ une veille par date ne coûte rien en régime établi, et re-siphonner 5 135 fiches chaque
 *     nuit est inutile (c'est ce que faisait le cron « fiches monstres »).
 */

/** Nature du filigrane : `id` (backfill) ou `updatedAt` (veille par date). */
export type VeilleCursorKind = "id" | "updatedAt";

/** Contrat minimal d'un dataset veillé (déclaré par le dataset, jamais deviné). */
export interface VeilleSpec {
    /** Nom du dataset tel qu'il apparaît dans la télémétrie/God (« MONSTER_FICHES »…). */
    id: string;
    /** Endpoint DofusDB (`/monsters`, `/items`, `/quests`…). */
    endpoint: string;
    /** Nature du filigrane : `id` (backfill) ou `updatedAt` (veille par date). */
    cursor: VeilleCursorKind;
    /** Nombre maximal d'entités traitées par passe (budget réseau, jamais « tout d'un coup »). */
    limit: number;
    /** Champ de tri (`id` par défaut). */
    orderBy?: string;
}

/** Position d'une veille : où l'on en est, et ce qu'il restait au moment de la mesure. */
export interface VeilleState {
    /** Dernière valeur acquise (`"31"` pour un id, ISO pour une date) — jamais réécrite à la baisse. */
    cursor: string | null;
    /** Restant estimé (`total` renvoyé par l'API moins ce qui a été traité dans cette passe). */
    remaining: number | null;
    /** Date de la dernière passe réussie (ISO). */
    lastPassAt: string | null;
}

/** Un état vide est un état valide : la première passe est un backfill depuis le début. */
export const EMPTY_VEILLE_STATE: VeilleState = { cursor: null, remaining: null, lastPassAt: null };

/** Une date ISO 8601 exploitable par DofusDB (`2026-09-01` ou `2026-09-01T00:00:00.000Z`). */
export function isIsoDate(value: unknown): boolean {
    if (typeof value !== "string" || value.trim() === "") return false;
    const parsed = Date.parse(value);
    // `Date.parse` est tolérant (« 2026 ») : on exige la forme AAAA-MM-JJ minimum.
    return Number.isFinite(parsed) && /^\d{4}-\d{2}-\d{2}/.test(value.trim());
}

/** Un identifiant de filigrane `id` exploitable (entier positif). */
export function isValidIdCursor(value: unknown): boolean {
    const n = Math.floor(Number(value));
    return Number.isFinite(n) && n > 0;
}

/**
 * Construit la requête d'une passe : **budgetée**, **triée**, reprenant au filigrane.
 *
 * `null` quand le filigrane n'est pas exploitable : on refuse d'appeler l'API (DofusDB répond
 * HTTP 500 à une date invalide, mesuré) plutôt que de casser la passe et de risquer un faux
 * « terminé ».
 */
export function buildVeilleQuery(spec: VeilleSpec, state: Pick<VeilleState, "cursor">): string | null {
    const limit = Math.floor(Number(spec?.limit) || 0);
    if (limit <= 0) return null;
    const params = [`$limit=${limit}`, `$sort=${spec.orderBy ?? "id"}`];

    const cursor = state?.cursor ?? null;
    if (cursor == null) return params.join("&");

    if (spec.cursor === "id") {
        if (!isValidIdCursor(cursor)) return null;
        params.push(`id[$gt]=${Math.floor(Number(cursor))}`);
        return params.join("&");
    }
    if (!isIsoDate(cursor)) return null;
    params.push(`updatedAt[$gte]=${encodeURIComponent(String(cursor))}`);
    return params.join("&");
}

/**
 * Filigrane suivant : **jamais de recul**. On prend la plus grande valeur vue dans la passe,
 * sinon on conserve la position acquise (une passe vide ne remet pas la veille à zéro).
 */
export function nextCursor(
    spec: Pick<VeilleSpec, "cursor">,
    previous: string | null,
    seen: (string | number | null | undefined)[]
): string | null {
    const values = (Array.isArray(seen) ? seen : [])
        .map((v) => (v == null ? "" : String(v).trim()))
        .filter((v) => v !== "");
    if (values.length === 0) return previous ?? null;

    if (spec.cursor === "id") {
        const max = values.reduce((acc, v) => {
            const n = Math.floor(Number(v) || 0);
            return n > acc ? n : acc;
        }, 0);
        if (max <= 0) return previous ?? null;
        const previousId = Math.floor(Number(previous) || 0);
        return String(max > previousId ? max : previousId);
    }

    const max = values.reduce((acc, v) => (v > acc ? v : acc), "");
    if (!isIsoDate(max)) return previous ?? null;
    return previous && previous > max ? previous : max;
}

/** Résultat d'une passe (compteurs pour la télémétrie — jamais de « succès » sans chiffre). */
export interface VeillePassResult {
    /** Entités vues dans cette passe. */
    processed: number;
    /** Filigrane après la passe. */
    cursor: string | null;
    /** Restant estimé après la passe (`null` si l'API n'a pas donné de total). */
    remaining: number | null;
    /** La passe a-t-elle atteint la fin du dataset (plus rien à traiter) ? */
    done: boolean;
}

/**
 * Clôt une passe : avance le filigrane et estime le restant.
 * `totalFromApi` = entités **correspondant à la requête** (donc au-delà du filigrane).
 */
export function closeVeillePass(
    spec: Pick<VeilleSpec, "cursor">,
    previous: string | null,
    seen: (string | number | null | undefined)[],
    totalFromApi: number | null | undefined
): VeillePassResult {
    const processed = Array.isArray(seen) ? seen.filter((v) => v != null && String(v).trim() !== "").length : 0;
    const cursor = nextCursor(spec, previous, seen);
    const total = Number.isFinite(Number(totalFromApi)) ? Math.max(0, Math.floor(Number(totalFromApi))) : null;
    const remaining = total == null ? null : Math.max(0, total - processed);
    return { processed, cursor, remaining, done: processed === 0 || (total != null && remaining === 0) };
}

/** Jauge de couverture d'un dataset (God) : ce qui est stocké sur ce que la source annonce. */
export function coverageGauge(
    stored: number | null | undefined,
    expected: number | null | undefined
): { stored: number; expected: number | null; percent: number | null; label: string } {
    const s = Math.max(0, Math.floor(Number(stored) || 0));
    const e = Number.isFinite(Number(expected)) && Number(expected) > 0 ? Math.floor(Number(expected)) : null;
    if (e == null) return { stored: s, expected: null, percent: null, label: `${s} fiche(s) — total source inconnu` };
    const percent = Math.min(100, Math.round((s / e) * 100));
    return {
        stored: s,
        expected: e,
        percent,
        label: percent >= 100 ? `${s}/${e} — complet` : `${s}/${e} (${percent} %) — veille en cours`,
    };
}
