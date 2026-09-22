/**
 * Calcul de dégâts Dofus 2 — **source unique** de l'onglet « Sorts » d'une fiche stuff ET de la
 * prévisu de dégâts de la simulation tactique (stuff comme monstres).
 *
 * Module PUR (aucun IO / aucun fetch) : utilisable côté client ET côté serveur,
 * et testable unitairement sans réseau. Il applique les caractéristiques réelles
 * d'un build (recalculées par `processDofusbookRawData`) à la base de dégâts d'un
 * sort DofusDB pour produire des valeurs théoriques (non-crit / critique).
 *
 * ⚠️ Approximation de DOFUS 2 (pas une simulation de combat) :
 *   - « théorique » = stat élémentaire + Puissance + dommages fixes + % dommages ;
 *   - « réel » non calculé (dépend des résistances/défenses de la cible) ;
 *   - critique = multiplicateur critique du sort (défaut 1.5).
 *
 * → Source de vérité des dégâts de base : DofusDB `api.dofusdb.fr/spells` (by grade).
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export type SpellElementKey = "terre" | "feu" | "eau" | "air" | "neutre";

/** Zone d'effet brute portée par une ligne de dégâts (issue de `zoneDescr` DofusDB). */
export interface SpellLineZone {
    /** Lettre de gabarit Ankama (`P`, `C`, `X`, `L`, `V`, `+`…). */
    shape: string;
    /** Taille (`param1`, ex. rayon du cercle). */
    size: number;
}

/**
 * **Dégressivité des dégâts de zone** telle que la porte la donnée DofusDB depuis la 3.6 :
 * chaque effet déclare dans son `zoneDescr` la perte par case d'éloignement
 * (`damageDecreaseStepPercent`) et le nombre maximal d'applications de cette perte
 * (`maxDamageDecreaseApplyCount`).
 *
 * 🔍 Mesuré le 22/09/2026 sur `api.dofusdb.fr` :
 *   · `spell-levels/42413` (Éther) → `damageDecreaseStepPercent: 10` + `maxDamageDecreaseApplyCount: 4` ;
 *   · échantillon de **1 200 niveaux / 2 039 effets** → **2 023** effets portent `10 | 4` (4 effets
 *     sans dégressivité, 1 cas isolé) ⇒ la paire est la valeur par défaut de l'effet, pas un
 *     réglage par sort. D'où `ZONE_DAMAGE_DECREASE_DEFAULT` (`dofus-zone-damage.ts`).
 */
export interface ZoneDamageDecrease {
    /** Perte de dégâts **par case** d'éloignement, en pourcentage. */
    stepPercent: number;
    /** Nombre maximal de fois où cette perte s'applique (au-delà : plafond atteint). */
    maxApplyCount: number;
}

export interface SpellBaseDamage {
    /** Dommages de base min (au grade donné). */
    min: number;
    /** Dommages de base max (au grade donné). */
    max: number;
    /** Élément du sort (sert à choisir la stat élémentaire & la ligne « Dommages X ». */
    element: SpellElementKey;
    /** Grade (niveau) du sort utilisé pour ces dégâts. */
    grade: number;
    /** Zone d'effet de CETTE ligne (`zoneDescr` DofusDB, absent = monocible). */
    zone?: SpellLineZone | null;
    /** Dégressivité de CETTE ligne (`zoneDescr` 3.6) — absente ⇒ défaut mesuré. */
    decrease?: ZoneDamageDecrease | null;
}

/**
 * Forme de zone normalisée (même vocabulaire que Dofensive/`SpellRangeGrid`).
 * Convention reprise de `toAnomalyZone` (session 15/09 : `zoneDescr.shape` =
 * code ASCII du gabarit Ankama, `'P'` = 80 → Point, `'C'` = 67 → Cercle…).
 * `'+'` (43, observé sur des effets monocibles, ex. Somnolence) vaut Point ;
 * les gabarits non calibrés (`'Q'`, `'O'`…) restent « Inconnue » : on n'invente rien.
 */
export type SpellZoneShape = "Point" | "Cercle" | "Croix" | "Ligne" | "Cône" | "Inconnue";

export interface SpellZoneSummary {
    shape: SpellZoneShape;
    size: number;
}

export function spellZoneShapeFromLetter(letter: string): SpellZoneShape {
    switch (String(letter || "").toUpperCase()) {
        case "P":
        case "+":
            return "Point";
        case "C":
            return "Cercle";
        case "X":
            return "Croix";
        case "L":
            return "Ligne";
        case "V":
            return "Cône";
        default:
            return "Inconnue";
    }
}

/**
 * Zone d'effet d'un sort à partir de ses lignes de dégâts : la première ligne
 * avec une vraie AoE (non-Point) fait foi (toutes les lignes d'un sort
 * partagent la même zone en pratique — vérifié : Torrent Arcanique = 4× Cercle 2) ;
 * sinon le sort est monocible. `null` = aucun dégât (sort utilitaire).
 */
export function spellZoneFromDamages(
    damages: Array<{ zone?: SpellLineZone | null } | null | undefined>
): SpellZoneSummary | null {
    const lines = (damages || []).filter(Boolean) as { zone?: SpellLineZone | null }[];
    if (lines.length === 0) return null;
    for (const line of lines) {
        const shape = line.zone ? spellZoneShapeFromLetter(line.zone.shape) : "Point";
        const size = Math.max(0, Number(line.zone?.size) || 0);
        if (shape !== "Point") return { shape, size };
    }
    return { shape: "Point", size: 0 };
}

// ─── Prévisu de DÉGÂTS : les jets par élément d'un sort ──────────────────────
// Source unique des deux simulateurs (monstres/boss sur la grille tactique, builds de stuff) :
// les jets numériques viennent des effets DÉJÀ calculés (`DofensiveSpellEffect.damage` côté
// Dofensive, `spellDamageFromEffect` côté DofusDB) — jamais d'un parsing de texte côté client.

/** Une ligne de dégâts agrégée : un élément, son jet cumulé, et le nombre de jets regroupés. */
export interface SpellDamageLine {
    /** Élément de la ligne (`terre` · `feu` · `eau` · `air` · `neutre`). */
    element: SpellElementKey;
    /** Jet minimum cumulé (tous les jets de cet élément). */
    min: number;
    /** Jet maximum cumulé. */
    max: number;
    /** Nombre de jets regroupés (un sort peut porter 2 lignes du même élément, ex. 2× Feu). */
    lines: number;
    /**
     * Jet **critique** cumulé de la ligne (`criticalEffect` DofusDB, `GroupCriticalEffects`
     * Dofensive). `null`/absent quand la source n'en fournit pas : on **n'invente jamais** un
     * coup critique à partir du jet normal (le multiplicateur 1,5 de `computeSpellDamage` reste
     * réservé à la fiche d'un sort qui ne publie pas de jet critique).
     */
    crit?: { min: number; max: number } | null;
    /** Dégressivité de la ligne (3.6) — `null`/absent ⇒ `ZONE_DAMAGE_DECREASE_DEFAULT`. */
    decrease?: ZoneDamageDecrease | null;
}

/** Alias d'éléments → clés du simulateur (Dofensive dit `earth`, la fiche dit `terre`…). */
const ELEMENT_ALIASES: Record<string, SpellElementKey> = {
    earth: "terre",
    terre: "terre",
    fire: "feu",
    feu: "feu",
    water: "eau",
    eau: "eau",
    air: "air",
    neutral: "neutre",
    neutre: "neutre",
};

/**
 * Dégâts d'un sort, par élément, à partir de ses effets structurés.
 *
 * @returns `lines` : un jet cumulé par élément (l'ordre suit l'apparition) ; `push` : la distance
 * de poussée (cases) si le sort pousse — **affichée telle quelle**, aucun dégât de poussée n'est
 * calculé (la formule du jeu n'est pas implémentée).
 *
 * 🔒 Règle d'agrégation du **critique** : le jet critique (`crit`) n'est cumulé que si CHAQUE jet
 * de l'élément en porte un — sinon la somme serait partielle, donc fausse. Même règle pour la
 * dégressivité : elle n'est conservée que si toutes les lignes de l'élément partagent la même
 * (sinon on retombe sur le défaut mesuré, jamais sur une valeur choisie au hasard).
 */
export function damageLinesFromEffects(
    effectDetails:
        | {
              damage?: {
                  element: string;
                  min: number;
                  max: number;
                  critMin?: number | null;
                  critMax?: number | null;
                  decrease?: ZoneDamageDecrease | null;
              } | null;
              pushDistance?: number | null;
          }[]
        | null
        | undefined
): { lines: SpellDamageLine[]; push: number | null } {
    const byElement = new Map<SpellElementKey, SpellDamageLine>();
    let push: number | null = null;

    for (const effect of effectDetails ?? []) {
        if (!effect) continue;
        if (typeof effect.pushDistance === "number" && effect.pushDistance > 0) {
            push = Math.max(push ?? 0, effect.pushDistance);
        }
        const damage = effect.damage;
        if (!damage) continue;
        const element = ELEMENT_ALIASES[String(damage.element ?? "").toLowerCase()];
        if (!element) continue;
        const min = Math.max(0, Math.floor(Number(damage.min) || 0));
        const max = Math.max(min, Math.floor(Number(damage.max) || 0));
        if (max <= 0) continue;

        const critMin = toDamageNumber(damage.critMin);
        const critMax = toDamageNumber(damage.critMax);
        const crit = critMin !== null && critMax !== null ? { min: critMin, max: Math.max(critMin, critMax) } : null;
        const decrease = normalizeDecrease(damage.decrease);

        const current = byElement.get(element);
        if (current) {
            current.min += min;
            current.max += max;
            current.lines += 1;
            if (current.crit && crit) {
                current.crit.min += crit.min;
                current.crit.max += crit.max;
            } else {
                current.crit = null;
            }
            if (!sameDecrease(current.decrease, decrease)) current.decrease = null;
        } else {
            byElement.set(element, { element, min, max, lines: 1, crit, decrease });
        }
    }

    return { lines: [...byElement.values()], push };
}

/** Nombre exploitables ≥ 0, ou `null` (valeur absente/non finie : on n'invente rien). */
function toDamageNumber(value: unknown): number | null {
    if (value === null || value === undefined || value === "") return null;
    const n = Number(value);
    return Number.isFinite(n) && n >= 0 ? Math.floor(n) : null;
}

/** Dégressivité exploitable (au moins une application et une perte non nulle), sinon `null`. */
export function normalizeDecrease(decrease: ZoneDamageDecrease | null | undefined): ZoneDamageDecrease | null {
    const stepPercent = Number(decrease?.stepPercent);
    const maxApplyCount = Number(decrease?.maxApplyCount);
    if (!Number.isFinite(stepPercent) || !Number.isFinite(maxApplyCount)) return null;
    if (stepPercent <= 0 || maxApplyCount <= 0) return null;
    return { stepPercent, maxApplyCount: Math.floor(maxApplyCount) };
}

/** Deux dégressivités identiques (ou toutes deux absentes) — utilisé pour ne pas mélanger les lignes. */
function sameDecrease(a: ZoneDamageDecrease | null | undefined, b: ZoneDamageDecrease | null | undefined): boolean {
    return (a?.stepPercent ?? null) === (b?.stepPercent ?? null) && (a?.maxApplyCount ?? null) === (b?.maxApplyCount ?? null);
}

/** Dégâts cumulés de toutes les lignes (ce qu'un coup inflige au total à une cible). */
export function totalDamageRange(lines: SpellDamageLine[]): { min: number; max: number } {
    return lines.reduce(
        (acc, line) => ({ min: acc.min + line.min, max: acc.max + line.max }),
        { min: 0, max: 0 }
    );
}

/** Affichage d'un jet : `666–774`, ou `666` quand min === max. */
export function formatDamageRange(min: number, max: number): string {
    return min === max ? String(min) : `${min}–${max}`;
}

/**
 * Jet **critique** total des lignes (somme par élément), ou `null` dès qu'une ligne n'en publie
 * pas : jamais une fourchette partielle présentée comme complète.
 */
export function totalCritRange(lines: SpellDamageLine[]): { min: number; max: number } | null {
    if (!lines || lines.length === 0) return null;
    let min = 0;
    let max = 0;
    for (const line of lines) {
        if (!line.crit) return null;
        min += line.crit.min;
        max += line.crit.max;
    }
    return { min, max };
}

/** Caractéristiques réelles d'un build, issues de `DofusbookPreviewData`. */
export interface BuildStatsForSpells {
    elements: { fo: number; in: number; ch: number; ag: number; sa: number; pu: number };
    damages: {
        neutre: number;
        terre: number;
        feu: number;
        eau: number;
        air: number;
        general: number;
        critique: number;
        poussee: number;
        armes: number;
        sorts: number;
        melee: number;
        distance: number;
        /**
         * `% Dommages finaux` : multiplicateur appliqué **en dernier**, après tout le reste
         * (règle du jeu, même famille que les `% Dommages subis` de DPLN qui se multiplient).
         * Absent des builds Dofusbook actuels ⇒ `0` (aucun effet), et c'est ce champ que
         * renseignent les boosts de type « +X % Dommages finaux » du panneau Boosts.
         */
        finaux?: number;
    };
}

export interface SpellDamageResult {
    /** Base brute (min-max) du sort au grade choisi. */
    baseMin: number;
    baseMax: number;
    /** Théorique NON-crit (min-max) appliqué aux stats du build. */
    theoMin: number;
    theoMax: number;
    /** Théorique CRITIQUE (min-max). */
    critMin: number;
    critMax: number;
    /** Stat élémentaire utilisée (pour l'affichage). */
    elementStat: number;
    /** Multiplicateur critique appliqué. */
    critMult: number;
    /** Grade retenu. */
    grade: number;
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

/** Ligne « Dommages X » du build pour l'élément donné (dommages fixes). */
export function fixedDamageForElement(
    d: BuildStatsForSpells["damages"],
    element: SpellElementKey
): number {
    switch (element) {
        case "terre": return d.terre;
        case "feu": return d.feu;
        case "eau": return d.eau;
        case "air": return d.air;
        default: return d.neutre;
    }
}

/**
 * Stat élémentaire du personnage pour un élément. Dofus : Force→Terre,
 * Intelligence→Feu, Chance→Eau, Agilité→Air. Neutre = aucune stat (0).
 */
export function elementStatFor(
    e: BuildStatsForSpells["elements"],
    element: SpellElementKey
): number {
    switch (element) {
        case "terre": return e.fo;
        case "feu": return e.in;
        case "eau": return e.ch;
        case "air": return e.ag;
        default: return 0;
    }
}

/**
 * % de dommages applicable. `general` (% Do) s'ajoute toujours ; `ds` (% Do Sorts)
 * touche tous les sorts ; `dm`/`di` selon la portée.
 */
export function percentDamageFor(
    d: BuildStatsForSpells["damages"],
    kind: "sorts" | "melee" | "distance"
): number {
    // general = "Dommages" FIXES (plateau), pas un pourcentage : géré par fixedDamageForElement + damages.general.
    switch (kind) {
        case "melee": return (d.melee || 0) + (d.sorts || 0);
        case "distance": return (d.distance || 0) + (d.sorts || 0);
        case "sorts":
        default: return (d.sorts || 0);
    }
}

/**
 * Calcule les dégâts théoriques d'une ligne de base selon la formule officielle Dofus 2 :
 *   statEffective = statÉlément + Puissance
 *   dégâtsBruts = floor( base × (1 + statEffective / 100) ) + dommagesFixes
 *   dégâtsFinaux = floor( dégâtsBruts × (1 + %dommages / 100) )
 */
export function applyBuild(
    base: number,
    elementStat: number,
    fixed: number,
    pctDamage: number,
    puissance: number
): number {
    const statEffective = Math.max(0, elementStat + puissance);
    const boostedBase = Math.floor(base * (1 + statEffective / 100));
    const withFixed = boostedBase + fixed;
    const pctMultiplier = 1 + pctDamage / 100;
    
    return Math.max(0, Math.floor(withFixed * pctMultiplier));
}

/**
 * Résultat complet d'un sort appliqué au build.
 *
 * @param dmg    ligne de dégâts de base (min/max) du sort au grade.
 * @param build  stats réelles du build.
 * @param kind   nature de portée du sort (sorts / mêlée / distance).
 * @param critMult multiplicateur critique (défaut 1.5).
 * @param critBase base min/max en coup critique (criticalEffect DofusDB).
 */
export function computeSpellDamage(
    dmg: SpellBaseDamage,
    build: BuildStatsForSpells,
    kind: "sorts" | "melee" | "distance" = "sorts",
    critMult: number = 1.5,
    critBase?: { min: number; max: number }
): SpellDamageResult {
    const elementStat = elementStatFor(build.elements, dmg.element);
    const fixed = fixedDamageForElement(build.damages, dmg.element) + (build.damages.general || 0);
    const fixedCrit = fixed + (build.damages.critique || 0);
    const pct = percentDamageFor(build.damages, kind);
    const pu = build.elements.pu || 0;
    // `% Dommages finaux` : appliqué en DERNIER (règle du jeu). Sans valeur ⇒ aucun changement.
    const finaux = Math.max(0, Number(build.damages.finaux) || 0);
    const applyFinaux = (v: number) => (finaux > 0 ? Math.floor(v * (1 + finaux / 100)) : v);

    const theoMin = applyBuild(dmg.min, elementStat, fixed, pct, pu);
    const theoMax = applyBuild(dmg.max, elementStat, fixed, pct, pu);

    // Critique : si un jet critique (criticalEffect DofusDB) est fourni, on le calcule
    // avec le jet critique de base + les dommages critiques fixes (stat 86).
    // Sinon, on applique le multiplicateur critique par défaut.
    // ⚠️ `% Dommages finaux` s'applique APRÈS, une seule fois (`theo` sert de base au multiplicateur).
    const cMinRaw = critBase ? applyBuild(critBase.min, elementStat, fixedCrit, pct, pu) : Math.floor(theoMin * critMult);
    const cMaxRaw = critBase ? applyBuild(critBase.max, elementStat, fixedCrit, pct, pu) : Math.floor(theoMax * critMult);

    return {
        baseMin: dmg.min,
        baseMax: dmg.max,
        theoMin: applyFinaux(theoMin),
        theoMax: applyFinaux(theoMax),
        critMin: applyFinaux(cMinRaw),
        critMax: applyFinaux(cMaxRaw),
        elementStat,
        critMult,
        grade: dmg.grade,
    };
}

/**
 * **Effets structurés d'un sort de classe appliqué aux stats du build** — même FORME que celle
 * servie par le serveur pour les monstres (`DofensiveSpellEffect` : `damage` numérique), afin que la
 * simulation tactique (`SpellRangeGrid`) affiche jets par élément, badges par cible et dégressivité
 * de zone **sans aucun cas particulier** (une seule source : `damageLinesFromEffects`).
 *
 * 🎯 Retour user (22/09/2026) : « où sont les estimations de dégâts par cible posées sur le
 * simulateur pour les stuff ? » — l'onglet Simulation d'une fiche stuff construisait ses sorts
 * **sans** `effectDetails` ⇒ aucune ligne de dégâts, option « Dégâts estimés » désactivée.
 *
 * Les valeurs viennent **exclusivement** de `computeSpellDamage` (formule du jeu : stat élémentaire
 * + Puissance + dommages fixes + % dommages) : aucune estimation, aucun parsing de texte. Le libellé
 * suit le format des libellés Dofensive (« 61 à 70 dommages Terre »).
 */
export function spellEffectDetailsFromBuild(
    damages: SpellBaseDamage[] | undefined | null,
    build: BuildStatsForSpells,
    opts: {
        /** Nature de portée : le `% Dommages` appliqué dépend de la mêlée / distance / sorts. */
        kind?: "sorts" | "melee" | "distance";
        /**
         * Jets **critiques** du grade (`criticalEffect` DofusDB). Rattachés à la ligne de **même
         * élément** : un sort qui ne publie pas de jet critique n'en affiche aucun (jamais le
         * multiplicateur 1,5, qui n'est pas un jet critique du jeu).
         */
        critDamages?: SpellBaseDamage[] | null;
    } = {}
): {
    label: string;
    duration: null;
    triggers: string[];
    masks: string[];
    damage: {
        element: string;
        min: number;
        max: number;
        critMin?: number;
        critMax?: number;
        decrease?: ZoneDamageDecrease | null;
    } | null;
}[] {
    const kind = opts.kind ?? "sorts";
    const critByElement = new Map<SpellElementKey, SpellBaseDamage>();
    for (const crit of opts.critDamages ?? []) {
        if (!crit || critByElement.has(crit.element)) continue;
        critByElement.set(crit.element, crit);
    }
    return (damages ?? [])
        .filter(Boolean)
        .map((dmg) => {
            // Jets NORMAUX (`theoMin`/`theoMax`) **et** jet critique du même élément quand le sort
            // en publie un (le taux de critique reste l'affaire du joueur : les deux sont affichés).
            const critBase = critByElement.get(dmg.element);
            const res = computeSpellDamage(
                dmg,
                build,
                kind,
                1.5,
                critBase ? { min: critBase.min, max: critBase.max } : undefined
            );
            // Élément écrit comme le jeu l'écrit (clé capitalisée : « Terre », « Feu »…) — jamais un
            // libellé inventé, et aucune table de libellés dupliquée dans ce module sans dépendance.
            const elementLabel = dmg.element.charAt(0).toUpperCase() + dmg.element.slice(1);
            return {
                label: `${res.theoMin} à ${res.theoMax} dommages ${elementLabel}`,
                duration: null,
                triggers: [] as string[],
                masks: [] as string[],
                // Un sort utilitaire (soin, état, poussée) n'a aucun degré de dégâts ⇒ `null`.
                damage: res.theoMax > 0
                    ? {
                          element: String(dmg.element),
                          min: res.theoMin,
                          max: res.theoMax,
                          ...(critBase && res.critMax > 0 ? { critMin: res.critMin, critMax: res.critMax } : {}),
                          decrease: dmg.decrease ?? null,
                      }
                    : null,
            };
        });
}

/**
 * Limites de lancer Dofus (0 = illimité / non renseigné par DofusDB).
 * `maxPerTarget`/`maxPerTurn` à 0 signifient "pas de plafond du sort"
 * (seuls les PA limitent) : on ne multiplie jamais par 0.
 */
export function castsPerTarget(maxPerTarget: number, maxPerTurn: number): number | null {
    const t = Math.floor(Number(maxPerTarget) || 0);
    const p = Math.floor(Number(maxPerTurn) || 0);
    if (t > 0 && p > 0) return Math.min(t, p);
    if (t > 0) return t;
    if (p > 0) return 1; // plafonné au tour mais pas à la cible : 1 lancer de référence par cible
    return null;
}

export function castsPerTurn(maxPerTurn: number): number | null {
    const p = Math.floor(Number(maxPerTurn) || 0);
    return p > 0 ? p : null;
}

/**
 * Forme structurelle minimale d'un grade de sort (suffit à sélectionner et
 * appliquer le grade par défaut — pas de dépendance au module serveur).
 */
export interface SpellGradeLike {
    grade: number;
    minPlayerLevel?: number;
    apCost: number;
    minRange: number;
    maxRange: number;
    criticalChance: number;
    maxCastPerTurn: number;
    maxCastPerTarget: number;
    minCastInterval: number;
    castInLine?: boolean;
    castInDiagonal?: boolean;
    castTestLos?: boolean;
    zone: { shape: string; size: number; range: number } | null;
    damages: SpellBaseDamage[];
    critDamages?: SpellBaseDamage[];
}

/** Grade par défaut pour un niveau de perso : le plus élevé accessible, sinon le 1er. */
export function pickGradeForLevel<T extends SpellGradeLike>(grades: T[] | undefined, charLevel: number): T | null {
    const list = (grades || []).filter(Boolean);
    if (list.length === 0) return null;
    const accessible = list.filter((g) => Number(g.minPlayerLevel ?? 1) <= charLevel);
    return (accessible.length > 0 ? accessible[accessible.length - 1] : list[0]) ?? null;
}

/**
 * Applique le grade par défaut (selon le niveau) à chaque sort.persisté.
 * Les sorts stockés (`ClassSpellbook`, canonique niv. 200) portent déjà tous
 * leurs grades : cette fonction pure re-dérive les champs de tête SANS réseau,
 * à l'identique du fetch (`normalizeSpell` + filtre d'accessibilité).
 */
export function applyCharLevelToSpells<
    T extends { grade: number; minPlayerLevel?: number; grades?: SpellGradeLike[] | null } & Partial<SpellGradeLike>,
>(spells: T[], charLevel: number): T[] {
    return (spells || []).map((sp) => {
        const chosen = pickGradeForLevel(sp.grades ?? undefined, charLevel);
        if (!chosen) return sp;
        return {
            ...sp,
            grade: chosen.grade,
            minPlayerLevel: Number(chosen.minPlayerLevel ?? 1),
            apCost: chosen.apCost,
            minRange: chosen.minRange,
            maxRange: chosen.maxRange,
            criticalChance: chosen.criticalChance,
            maxCastPerTurn: chosen.maxCastPerTurn,
            maxCastPerTarget: chosen.maxCastPerTarget,
            minCastInterval: chosen.minCastInterval,
            castInLine: !!chosen.castInLine,
            castInDiagonal: !!chosen.castInDiagonal,
            castTestLos: chosen.castTestLos !== false,
            zone: chosen.zone,
            damages: chosen.damages,
            critDamages: chosen.critDamages,
        };
    });
}

/**
 * Applique un build aux sorts d'une classe et renvoie les dégâts théoriques.
 * Fonction pure → réside ici (module client-safe), pas dans un fichier "use server".
 */
export function applySpellsToBuild(
    spells: Array<{ damages: SpellBaseDamage[]; grade: number; maxRange: number; critMult?: number }>,
    build: BuildStatsForSpells,
    critMult: number = 1.5
): Array<{ grade: number; result: SpellDamageResult }> {
    return spells.map((sp) => {
        const dmg = sp.damages[0];
        // Portée : 1 → mêlée (ou partout), sinon distance.
        const kind: "sorts" | "melee" | "distance" = sp.maxRange <= 1 ? "melee" : "distance";
        const result = dmg
            ? computeSpellDamage({ ...dmg, grade: sp.grade }, build, kind, sp.critMult || critMult)
            : null;
        return { grade: sp.grade, result: result! };
    });
}

// ─── Extraction d'une ligne de dégâts depuis un effect DofusDB ────────────────────────────────────────────────────────────────

/**
 * Déduit l'élément d'un effect DofusDB à partir de `effectElement`.
 *   1 = Terre · 2 = Feu · 3 = Eau · 4 = Air · 5+ = Neutre.
 */
export function elementFromDofusdb(effectElement: number | null | undefined): SpellElementKey {
    switch (Number(effectElement)) {
        case 1: return "terre";
        case 2: return "feu";
        case 3: return "eau";
        case 4: return "air";
        default: return "neutre";
    }
}

/**
 * IDs DofusDB de dégâts directs (min-max par `diceNum`/`diceSide`).
 * Sémantique vérifiée contre l'API live (`/spell-levels`, `/effects`, classes
 * Huppermage + Eniripsa : steals, dégâts, soins, +PO) :
 *   91-95 = Vols (Eau/Terre/Air/Feu/Neutre — 1 ligne de dégâts, comme Dofusbook),
 *   96-100 = Dommages (Eau/Terre/Air/Feu/Neutre),
 *   112 = Dommage sans élément (neutre).
 * Exclus VOLONTAIREMENT (sinon TOTAL gonflé + lignes fantômes) :
 *   90/108 = Soins (« Rend X PV », « soins Feu »),
 *   117 = bonus de Portée (« +X PO » → devenait une fausse ligne « Neutre X–X »).
 */
const DIRECT_DAMAGE_IDS = new Set([91, 92, 93, 94, 95, 96, 97, 98, 99, 100, 112]);

/**
 * Tente de produire une `SpellBaseDamage` depuis un effect DofusDB brut.
 * Tolérant aux formes `diceNum`/`diceSide`, `min`/`max`, `value`, ou `formatted`.
 * Retourne `null` si l'effect n'est pas un dégât direct exploitable.
 */
/**
 * Décode la map de caractéristiques FINALES renvoyée par `api.dofusdb.fr/stuffs/{id}`
 * (clés = ids numériques DofusDB → valeurs) vers une `BuildStatsForSpells`.
 * C'est exactement la source de vérité que DofusDB utilise pour calculer les dégâts,
 * donc utiliser ce décodeur aligne nos résultats sur ceux affichés par DofusDB.
 *   id 10=Force · 15=Intelligence · 13=Chance · 14=Agilité · 25=Puissance · 12=Sagesse
 *   dommages fixes : 88=Terre 89=Feu 90=Eau 91=Air 92=Neutre · 16=Dommages (général)
 *   %do : 123=Sorts 125=Mêlée 120=Distance 122=Armes · 86=Critiques 84=Poussée
 */
export function statsFromDofusdb(stats: Record<string, number>): BuildStatsForSpells {
    const v = (id: number): number => {
        const n = Number((stats as Record<string, unknown>)[String(id)]);
        return Number.isFinite(n) ? n : 0;
    };
    return {
        elements: { fo: v(10), in: v(15), ch: v(13), ag: v(14), sa: v(12), pu: v(25) },
        damages: {
            neutre: v(92), terre: v(88), feu: v(89), eau: v(90), air: v(91),
            general: v(16), critique: v(86), poussee: v(84),
            armes: v(122), sorts: v(123), melee: v(125), distance: v(120),
        },
    };
}

export function spellDamageFromEffect(eff: any): SpellBaseDamage | null {
    if (!eff || typeof eff !== "object") return null;

    const id = Number(eff.effectId ?? eff.id);
    const isDamage = DIRECT_DAMAGE_IDS.has(id) || (!!eff.formatted && /[Dd]ommages/.test(String(eff.formatted)));
    if (!isDamage) return null;

    let min = Number(eff.diceNum ?? eff.min ?? eff.value) || 0;
    let max = Number(eff.diceSide ?? eff.max ?? eff.value) || 0;

    // Si `formatted` fourni ("10 à 18"), on tente de l'exploiter.
    if ((min === 0 || max === 0) && typeof eff.formatted === "string") {
        const m = eff.formatted.match(/(\d+)(?:\s*à\s*(\d+))?/);
        if (m) {
            min = Number(m[1]);
            max = m[2] ? Number(m[2]) : min;
        }
    }

    if (max === 0) max = min;
    if (min === 0) return null;

    // Zone d'effet de la ligne (`zoneDescr` DofusDB : `shape` = code ASCII du
    // gabarit, `param1` = taille). Absent = monocible (cas nominal).
    // Le MÊME bloc porte la dégressivité 3.6 (`damageDecreaseStepPercent` /
    // `maxDamageDecreaseApplyCount`) — lue telle quelle, jamais supposée.
    const zd = (eff as any).zoneDescr;
    const zoneShapeCode = Number(zd?.shape) || 0;
    const zone: SpellLineZone | null =
        zoneShapeCode > 0
            ? { shape: String.fromCharCode(zoneShapeCode), size: Math.max(0, Number(zd?.param1) || 0) }
            : null;
    const decrease = normalizeDecrease({
        stepPercent: Number(zd?.damageDecreaseStepPercent),
        maxApplyCount: Number(zd?.maxDamageDecreaseApplyCount),
    });

    return {
        min,
        max,
        element: elementFromDofusdb(eff.effectElement ?? (eff as any).effectElementId),
        grade: Number(eff.grade ?? eff.level ?? 0),
        zone,
        decrease,
    };
}



