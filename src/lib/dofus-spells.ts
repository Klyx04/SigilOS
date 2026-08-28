/**
 * Calcul de dégâts Dofus 2 pour l'onglet « Sorts » d'une fiche stuff.
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

export interface SpellBaseDamage {
    /** Dommages de base min (au grade donné). */
    min: number;
    /** Dommages de base max (au grade donné). */
    max: number;
    /** Élément du sort (sert à choisir la stat élémentaire & la ligne « Dommages X ». */
    element: SpellElementKey;
    /** Grade (niveau) du sort utilisé pour ces dégâts. */
    grade: number;
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

    const theoMin = applyBuild(dmg.min, elementStat, fixed, pct, pu);
    const theoMax = applyBuild(dmg.max, elementStat, fixed, pct, pu);

    // Critique : si un jet critique (criticalEffect DofusDB) est fourni, on le calcule
    // avec le jet critique de base + les dommages critiques fixes (stat 86).
    // Sinon, on applique le multiplicateur critique par défaut.
    const cMin = critBase
        ? applyBuild(critBase.min, elementStat, fixedCrit, pct, pu)
        : Math.floor(theoMin * critMult);
    const cMax = critBase
        ? applyBuild(critBase.max, elementStat, fixedCrit, pct, pu)
        : Math.floor(theoMax * critMult);

    return {
        baseMin: dmg.min,
        baseMax: dmg.max,
        theoMin,
        theoMax,
        critMin: cMin,
        critMax: cMax,
        elementStat,
        critMult,
        grade: dmg.grade,
    };
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

/** IDs DofusDB de dégâts directs (min-max par `diceNum`/`diceSide`). */
const DIRECT_DAMAGE_IDS = new Set([91, 92, 93, 94, 95, 96, 97, 98, 99, 100, 108, 112, 113, 117]);

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

    return {
        min,
        max,
        element: elementFromDofusdb(eff.effectElement ?? (eff as any).effectElementId),
        grade: Number(eff.grade ?? eff.level ?? 0),
    };
}



