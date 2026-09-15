/**
 * « Calcul de dégâts » des sorts de MONSTRE — parité avec le réglage Dofensive
 * « Activer le calcul de dégâts » (et avec la fiche DofusDB déjà calculée).
 *
 * Constat user du 15/09/2026 : la fiche affichait les **jets bruts** de l'API Dofensive
 * (« 74 à 86 dommages Air » pour *Râle d'Agonie*) alors que Dofensive (réglage activé) et
 * la description DofusDB affichent les **dégâts réels** (« 666 à 774 »).
 *
 * Règle du jeu (identique à celle déjà appliquée au chemin DofusDB de `getMonsterStats`) :
 *
 *     dégâts = floor( jet × (1 + caractéristique / 100) )
 *
 * · Terre → Force · Feu → Intelligence · Eau → Chance · Air → Agilité
 * · Neutre → aucune caractéristique ne le booste (stat 0 : même convention que la fiche)
 *
 * Les caractéristiques viennent du **grade** du monstre (`Grades[].PrimaryCharacteristics`
 * côté Dofensive : `Strength`/`Intelligence`/`Chance`/`Agility`), celui du sort affiché.
 *
 * ⚠️ Module **pur** (aucun import) : utilisable côté serveur (siphon, actions) comme dans
 * les tests unitaires, sans tirer la chaîne d'auth Next.
 */

export type DamageElement = "earth" | "fire" | "water" | "air" | "neutral";

/** Caractéristiques élémentaires effectives d'un monstre (0 = aucun bonus). */
export interface MonsterDamageStats {
    earth: number;
    fire: number;
    water: number;
    air: number;
    neutral: number;
}

/** Aucun bonus élémentaire (repli sûr : les jets restent bruts). */
export const NO_DAMAGE_BONUS: MonsterDamageStats = { earth: 0, fire: 0, water: 0, air: 0, neutral: 0 };

/**
 * Labels techniques Dofensive qui **retirent des PV** (dommages directs et vol de vie).
 * Le suffixe d'élément est optionnel : `ACTION_CHARACTER_LIFE_POINTS_LOST` sans suffixe
 * = **Neutre** (mesuré : « Épicentre » → « dommages Neutre »).
 */
const LIFE_LOSS_LABEL = /^ACTION_CHARACTER_LIFE_POINTS_(?:LOST|STEAL)/;

/** Les variantes « pourcentage » (ex. `_LOST_PERCENT`) ne se calculent PAS par stat. */
const PERCENT_LABEL = /PERCENT/;

const LABEL_ELEMENT: Array<[RegExp, DamageElement]> = [
    [/_FROM_(?:EARTH|TERRE)$/, "earth"],
    [/_FROM_(?:FIRE|FEU)$/, "fire"],
    [/_FROM_(?:WATER|EAU)$/, "water"],
    [/_FROM_(?:AIR)$/, "air"],
    [/_FROM_(?:NEUTRAL|NEUTRE)$/, "neutral"],
];

/** Repli sur le libellé localisé (« 74 à 86 dommages Air », « Vol de vie Neutre »). */
const NAME_DAMAGE = "(?:dommages?|d[ée]g[âa]ts?|vol de vie)";
const NAME_ELEMENT: Array<[RegExp, DamageElement]> = [
    [new RegExp(`${NAME_DAMAGE}[^a-z]*(?:terre)`, "i"), "earth"],
    [new RegExp(`${NAME_DAMAGE}[^a-z]*(?:feu)`, "i"), "fire"],
    [new RegExp(`${NAME_DAMAGE}[^a-z]*(?:eau)`, "i"), "water"],
    [new RegExp(`${NAME_DAMAGE}[^a-z]*(?:air)`, "i"), "air"],
    [new RegExp(`${NAME_DAMAGE}[^a-z]*(?:neutre)`, "i"), "neutral"],
];

/** Libellés localisés à NE PAS calculer (pas élémentaires ou déjà multiplicatifs). */
const NAME_EXCLUDED = /pouss|critique|%|renvoi|r[ée]duction|r[ée]sistance/i;

function toStat(v: unknown): number {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

/**
 * Élément d'un effet Dofensive, ou `null` si l'effet n'inflige pas de dommages élémentaires.
 * 1. `TechnicalLabel` (autorité : `ACTION_CHARACTER_LIFE_POINTS_LOST[_FROM_<ELEMENT>]`) ;
 * 2. repli sur le libellé localisé quand le label est absent (payloads DofusDB/inconnus).
 */
export function damageElementOfEffect(effect: any): DamageElement | null {
    const label = String(effect?.TechnicalLabel ?? "").trim().toUpperCase();
    if (label) {
        if (!LIFE_LOSS_LABEL.test(label) || PERCENT_LABEL.test(label)) return null;
        for (const [re, element] of LABEL_ELEMENT) {
            if (re.test(label)) return element;
        }
        return "neutral";
    }
    const name = String(effect?.Name ?? effect?.label ?? "");
    if (!name || NAME_EXCLUDED.test(name)) return null;
    for (const [re, element] of NAME_ELEMENT) {
        if (re.test(name)) return element;
    }
    return null;
}

/** Dégâts réels d'un jet : `floor(jet × (1 + stat/100))` (convention Dofus déjà utilisée côté DofusDB). */
export function scaleDamageDice(value: number, stat: number): number {
    if (!Number.isFinite(value)) return value;
    const bonus = toStat(stat);
    if (bonus === 0) return Math.floor(value);
    return Math.floor(value * (1 + bonus / 100));
}

/**
 * Renvoie une **copie** de l'effet dont les jets numériques sont calculés (jamais de mutation :
 * le payload source reste intact pour les autres consommateurs).
 */
export function scaleDamageEffect(effect: any, stats: MonsterDamageStats): any {
    const element = damageElementOfEffect(effect);
    if (!element) return effect;
    const stat = toStat(stats?.[element]);
    if (stat === 0) return effect;
    const params: any[] = Array.isArray(effect?.Parameters) ? effect.Parameters : [];
    if (params.length === 0) return effect;

    let changed = false;
    const scaledParams = params.map((p) => {
        const raw = Number(p?.Value ?? p?.Name);
        if (!Number.isFinite(raw)) return p;
        const scaled = scaleDamageDice(raw, stat);
        if (scaled === raw) return p;
        changed = true;
        return { ...p, Name: String(scaled), Value: scaled };
    });
    return changed ? { ...effect, Parameters: scaledParams } : effect;
}

/**
 * Applique le calcul de dégâts à tous les effets de groupes Dofensive
 * (`GroupEffects`, `GroupCriticalEffects`) — copie défensive du tableau.
 */
export function scaleDamageInEffectGroups<T>(groups: T, stats: MonsterDamageStats): T {
    if (!Array.isArray(groups)) return groups;
    return groups.map((group: any) =>
        Array.isArray(group?.Effects)
            ? { ...group, Effects: group.Effects.map((e: any) => scaleDamageEffect(e, stats)) }
            : group
    ) as unknown as T;
}

/** Caractéristiques élémentaires d'un grade **Dofensive** (`Grades[].PrimaryCharacteristics`). */
export function damageStatsFromDofensiveGrade(grade: any): MonsterDamageStats {
    const chars = grade?.PrimaryCharacteristics ?? {};
    return {
        earth: toStat(chars.Strength),
        fire: toStat(chars.Intelligence),
        water: toStat(chars.Chance),
        air: toStat(chars.Agility),
        // Aucune caractéristique ne booste le Neutre (même convention que la fiche DofusDB).
        neutral: 0,
    };
}

/**
 * Caractéristiques du grade demandé (1-based) — repli sur le **dernier grade** (le plus haut),
 * exactement comme la sélection du niveau de sort (`Levels[grade - 1] ?? dernier`).
 */
export function pickMonsterDamageStats(grades: any, grade?: number): MonsterDamageStats {
    const list: any[] = Array.isArray(grades) ? grades : [];
    if (list.length === 0) return NO_DAMAGE_BONUS;
    const idx = typeof grade === "number" && grade >= 1 && grade <= list.length ? grade - 1 : list.length - 1;
    return damageStatsFromDofensiveGrade(list[idx]);
}
