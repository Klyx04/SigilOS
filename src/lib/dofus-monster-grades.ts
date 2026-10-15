/**
 * Lecture des **grades d'un monstre** — chantier « Raccord DofusDB », lot **R-2**.
 *
 * ⚠️ Fichier **pur** (client + serveur) : aucun I/O.
 *
 * **Pourquoi cette fonction existe (mesure du 15/10/2026)** : d'un écran à l'autre, la même
 * information arrive sous **trois** formes :
 *   · notre base : `MonsterStat.stats.grades[].resists = { neutral: 54, fire: 34, … }` (mesuré) ;
 *   · certaines payloads amont : `resistances` (au pluriel long) ;
 *   · d'autres : rien du tout — et c'est **précisément** le cas de l'écran « avis de recherche », qui
 *     affiche `Tacle`/`Fuite` (clés présentes) mais **aucune** valeur de résistance (clé absente).
 * Chaque écran bricolait donc sa lecture (`grade?.resists || {}`), et un payload légèrement différent
 * suffisait à faire disparaître les valeurs **sans erreur** — le pire des symptômes.
 *
 * Une **seule** lecture pour tout le monde, **fail-closed** : aucune valeur exploitable ⇒ `null`
 * (l'appelant garde son repli visuel, on n'invente jamais des résistances à 0 %).
 */

/** Résistances d'un grade, en pourcentage (null = non publié, jamais 0 par défaut). */
export interface GradeResists {
    neutral: number | null;
    earth: number | null;
    fire: number | null;
    water: number | null;
    air: number | null;
}

/**
 * Repli **typé** quand aucun grade n'est exploitable : cinq `null`, à utiliser tel quel
 * (`readGradeResists(grade) ?? EMPTY_GRADE_RESISTS`) — un `|| {}` perdrait le type et l'écran
 * afficherait « 0 % » au lieu de « — ».
 */
export const EMPTY_GRADE_RESISTS: GradeResists = {
    neutral: null,
    earth: null,
    fire: null,
    water: null,
    air: null,
};

/** Clés acceptées, dans l'ordre de préférence (notre base d'abord). */
const RESIST_KEYS = ["resists", "resistances", "resistancesPercent", "resistance"] as const;

/** Un pourcentage exploitable : nombre fini (une chaîne numérique est acceptée). */
function toPercent(value: unknown): number | null {
    const numeric =
        typeof value === "number"
            ? value
            : typeof value === "string" && /^-?\d+(\.\d+)?$/.test(value.trim())
              ? Number(value.trim())
              : Number.NaN;
    return Number.isFinite(numeric) ? Math.round(numeric) : null;
}

/**
 * Résistances d'un grade, quelle que soit la forme reçue. `null` si **aucune** des cinq n'est
 * exploitable (jamais un objet vide qui ferait croire à cinq résistances à zéro).
 */
export function readGradeResists(grade: unknown): GradeResists | null {
    if (!grade || typeof grade !== "object" || Array.isArray(grade)) return null;
    const source = grade as Record<string, unknown>;

    const raw = RESIST_KEYS.map((key) => source[key]).find(
        (candidate) => candidate && typeof candidate === "object" && !Array.isArray(candidate),
    ) as Record<string, unknown> | undefined;
    if (!raw) return null;

    const resists: GradeResists = {
        neutral: toPercent(raw.neutral),
        earth: toPercent(raw.earth),
        fire: toPercent(raw.fire),
        water: toPercent(raw.water),
        air: toPercent(raw.air),
    };
    const hasAny = Object.values(resists).some((value) => value !== null);
    return hasAny ? resists : null;
}


/**
 * Tacle / fuite d'un grade, **règle du jeu** : `floor(agilité / 10) + bonus`.
 *
 * C'est **la** règle déjà appliquée par `scripts/siphon-unity-bestiary.py:371` (`tackle = int(agi/10)
 * + bonus.get("tackleBonus")`) : on ne l'invente pas, on la porte au même endroit pour les fiches qui
 * n'ont jamais reçu la valeur. `null` si l'agilité est absente (fail-closed : aucune valeur inventée).
 */
export function resolveTackleEvade(agility: unknown, bonus: unknown): number | null {
    const agi = toInteger(agility);
    if (agi === null) return null;
    return Math.floor(agi / 10) + (toInteger(bonus) ?? 0);
}

/** Entier exploitable (nombre fini, ou chaîne d'entiers) ; `null` sinon. */
export function toInteger(value: unknown): number | null {
    const numeric =
        typeof value === "number"
            ? value
            : typeof value === "string" && /^-?\d+$/.test(value.trim())
              ? Number(value.trim())
              : Number.NaN;
    return Number.isFinite(numeric) ? Math.trunc(numeric) : null;
}

/**
 * Caractéristiques de combat **à plat** d'un grade (chantier « Raccord DofusDB », lot **R-3**).
 *
 * Mesure du 15/10/2026 : **deux** producteurs de grades existent dans `monster-stats-core.ts`. Le
 * premier (`:287-293`) écrit `tackle`/`evade`/`apDodge`/`mpDodge`/`apRemoval`/`mpRemoval`/`initiative` ;
 * le second (`:966-994`) **ne les écrit pas** — d'où des écrans qui affichent « Tacle — » / « Fuite — »
 * sur les fiches issues de ce chemin (`MonsterStat.stats.grades[]` mesuré : `tackle` **0/283**).
 *
 * Ici : on **préfère toujours la valeur publiée** (source ou `carac`), et on ne **dérive** tacle/fuite
 * de l'agilité que lorsqu'elle manque — jamais l'inverse, jamais une valeur inventée.
 */
export interface GradeCombatStats {
    tackle: number | null;
    evade: number | null;
    apDodge: number | null;
    mpDodge: number | null;
    apRemoval: number | null;
    mpRemoval: number | null;
    initiative: number | null;
}

export function deriveGradeCombatStats(grade: unknown, carac?: unknown): GradeCombatStats {
    const g = (grade && typeof grade === "object" ? grade : {}) as Record<string, any>;
    const c = (carac && typeof carac === "object" ? carac : {}) as Record<string, any>;

    const agility = toInteger(g.agility ?? c.agility);

    return {
        tackle: toInteger(g.tackle) ?? resolveTackleEvade(agility, g.tackleBonus ?? c.tackleBonus),
        evade: toInteger(g.evade) ?? resolveTackleEvade(agility, g.evadeBonus ?? c.evadeBonus),
        apDodge: toInteger(g.apDodge ?? c.paDodge),
        mpDodge: toInteger(g.mpDodge ?? c.pmDodge),
        apRemoval: toInteger(g.apRemoval),
        mpRemoval: toInteger(g.mpRemoval),
        initiative: toInteger(g.initiative),
    };
}
