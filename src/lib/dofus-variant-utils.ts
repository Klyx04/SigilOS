import type { DofusbookItem, DofusbookItemEffect, DofusbookPreviewData } from "@/lib/dofusbook-utils";
import { activeSetBonuses, sumSetBonuses, type ActiveSetBonus, type ItemSetData } from "@/lib/dofus-set-bonuses";

/** Configuration des slots et des types d'items correspondants dans GameItem. */
export interface SlotTypeInfo {
    slotName: string;
    typeIds: number[];
    typeNames: string[];
    iconUrl?: string;
}

export const VARIANT_SLOTS: Record<string, SlotTypeInfo> = {
    ch: {
        slotName: "Coiffe",
        typeIds: [16],
        typeNames: ["Chapeau", "Coiffe"],
    },
    ca: {
        slotName: "Cape",
        typeIds: [17],
        typeNames: ["Cape"],
    },
    ce: {
        slotName: "Ceinture",
        typeIds: [10],
        typeNames: ["Ceinture"],
    },
    bo: {
        slotName: "Bottes",
        typeIds: [11],
        typeNames: ["Bottes"],
    },
    am: {
        slotName: "Amulette",
        typeIds: [1],
        typeNames: ["Amulette"],
    },
    a1: {
        slotName: "Anneau",
        typeIds: [9],
        typeNames: ["Anneau"],
    },
    a2: {
        slotName: "Anneau",
        typeIds: [9],
        typeNames: ["Anneau"],
    },
    br: {
        slotName: "Bouclier",
        typeIds: [82],
        typeNames: ["Bouclier"],
    },
    ar: {
        slotName: "Arme",
        typeIds: [2, 3, 4, 5, 6, 7, 8, 19, 20, 21, 22, 114, 271],
        typeNames: ["Arc", "Baguette", "Bâton", "Dague", "Épée", "Marteau", "Pelle", "Hache", "Outil", "Pioche", "Faux", "Arme magique", "Lance", "Arme"],
    },
    fa: {
        slotName: "Familier / Monture",
        typeIds: [18, 121, 311, 331, 332, 333],
        typeNames: ["Familier", "Montilier", "Monture", "Dragodinde", "Muldo", "Volkorne"],
    },
    mo: {
        slotName: "Monture",
        typeIds: [18, 121, 311, 331, 332, 333],
        typeNames: ["Familier", "Montilier", "Monture", "Dragodinde", "Muldo", "Volkorne"],
    },
    d1: {
        slotName: "Dofus / Trophée",
        typeIds: [23, 151, 217],
        typeNames: ["Dofus", "Trophée", "Prysmaradite", "Prysmarune"],
    },
    d2: {
        slotName: "Dofus / Trophée",
        typeIds: [23, 151, 217],
        typeNames: ["Dofus", "Trophée", "Prysmaradite", "Prysmarune"],
    },
    d3: {
        slotName: "Dofus / Trophée",
        typeIds: [23, 151, 217],
        typeNames: ["Dofus", "Trophée", "Prysmaradite", "Prysmarune"],
    },
    d4: {
        slotName: "Dofus / Trophée",
        typeIds: [23, 151, 217],
        typeNames: ["Dofus", "Trophée", "Prysmaradite", "Prysmarune"],
    },
    d5: {
        slotName: "Dofus / Trophée",
        typeIds: [23, 151, 217],
        typeNames: ["Dofus", "Trophée", "Prysmaradite", "Prysmarune"],
    },
    d6: {
        slotName: "Dofus / Trophée",
        typeIds: [23, 151, 217],
        typeNames: ["Dofus", "Trophée", "Prysmaradite", "Prysmarune"],
    },
};

/** Filtres de stats pour la bibliothèque de variantes (inspiré de Duffus). */
export interface StatFilterOption {
    code: string;
    label: string;
    category: "vital" | "elements" | "secondaires" | "damages" | "resists";
    icon?: string;
}

export const VARIANT_STAT_FILTERS: StatFilterOption[] = [
    // Vitals
    { code: "pa", label: "PA", category: "vital", icon: "/assets/dofus/stats/pa.png" },
    { code: "pm", label: "PM", category: "vital", icon: "/assets/dofus/stats/pm.png" },
    { code: "po", label: "Portée", category: "vital", icon: "/assets/dofus/stats/po.png" },
    { code: "invo", label: "Invocations", category: "vital", icon: "/assets/dofus/stats/invocation.png" },

    // Éléments
    { code: "fo", label: "Force", category: "elements", icon: "/assets/module-succes/terre.png" },
    { code: "in", label: "Intelligence", category: "elements", icon: "/assets/module-succes/Intelligence.png" },
    { code: "ch", label: "Chance", category: "elements", icon: "/assets/module-succes/eau.png" },
    { code: "ag", label: "Agilité", category: "elements", icon: "/assets/module-succes/Agility.png" },

    // Caractéristiques secondaires
    { code: "vi", label: "Vitalité", category: "secondaires", icon: "/assets/dofus/stats/pv.png" },
    { code: "sa", label: "Sagesse", category: "secondaires", icon: "/assets/dofus/stats/sagesse.png" },
    { code: "pu", label: "Puissance", category: "secondaires", icon: "/assets/dofus/stats/puissance.png" },
    { code: "cc", label: "% Critique", category: "secondaires", icon: "/assets/dofus/stats/critique.png" },
    { code: "so", label: "Soins", category: "secondaires", icon: "/assets/dofus/stats/soin.png" },
    { code: "pp", label: "Prospection", category: "secondaires", icon: "/assets/dofus/stats/pp.png" },
    { code: "ini", label: "Initiative", category: "secondaires", icon: "/assets/dofus/stats/initiative.png" },

    // Dommages
    { code: "df", label: "Dommages", category: "damages", icon: "/assets/dofus/stats/dmg.png" },
    { code: "dc", label: "Do Critique", category: "damages", icon: "/assets/dofus/stats/dmgCritique.png" },
    { code: "dnf", label: "Do Neutre", category: "damages", icon: "/assets/dofus/stats/dmgNeutre.png" },
    { code: "dtf", label: "Do Terre", category: "damages", icon: "/assets/dofus/stats/dmgTerre.png" },
    { code: "dff", label: "Do Feu", category: "damages", icon: "/assets/dofus/stats/dmgFeu.png" },
    { code: "def", label: "Do Eau", category: "damages", icon: "/assets/dofus/stats/dmgEau.png" },
    { code: "daf", label: "Do Air", category: "damages", icon: "/assets/dofus/stats/dmgAir.png" },
    { code: "dp", label: "Do Pou", category: "damages", icon: "/assets/dofus/stats/dmgPoussee.png" },
    { code: "da", label: "% Do Armes", category: "damages" },
    { code: "ds", label: "% Do Sorts", category: "damages" },
    { code: "dm", label: "% Do Mêlée", category: "damages" },
    { code: "di", label: "% Do Dist.", category: "damages" },

    // Résistances %
    { code: "rnp", label: "% Res Neutre", category: "resists", icon: "/assets/dofus/stats/resNeutre.png" },
    { code: "rtp", label: "% Res Terre", category: "resists", icon: "/assets/dofus/stats/resTerre.png" },
    { code: "rfp", label: "% Res Feu", category: "resists", icon: "/assets/dofus/stats/resFeu.png" },
    { code: "rep", label: "% Res Eau", category: "resists", icon: "/assets/dofus/stats/resEau.png" },
    { code: "rap", label: "% Res Air", category: "resists", icon: "/assets/dofus/stats/resAir.png" },

    // Esquives & Retraits
    { code: "fu", label: "Fuite", category: "secondaires", icon: "/assets/dofus/stats/fuite.png" },
    { code: "ta", label: "Tacle", category: "secondaires", icon: "/assets/dofus/stats/tacle.png" },
    { code: "epa", label: "Esquive PA", category: "secondaires", icon: "/assets/dofus/stats/esquivePa.png" },
    { code: "epm", label: "Esquive PM", category: "secondaires", icon: "/assets/dofus/stats/esquivePm.png" },
    { code: "rpa", label: "Retrait PA", category: "secondaires", icon: "/assets/dofus/stats/sablier.png" },
    { code: "rpm", label: "Retrait PM", category: "secondaires", icon: "/assets/dofus/stats/sablier.png" },
];

/**
 * Normalise un effet brut (GameItem nativeEffects ou Dofusbook effects)
 * vers un code Dofusbook standardisé (`vi`, `fo`, `pa`, etc.).
 */
export function normalizeStatCode(rawCodeOrName: string | number | undefined | null): string {
    if (rawCodeOrName === undefined || rawCodeOrName === null) return "";
    const str = String(rawCodeOrName).toLowerCase().trim();

    // Mapping par identifiant numérique de characteristic / effectId DofusDB
    const num = Number(str);
    if (!isNaN(num)) {
        switch (num) {
            case 1: case 111: return "pa";
            case 23: case 128: return "pm";
            case 19: case 117: return "po";
            case 11: case 125: return "vi";
            case 10: case 118: return "fo";
            case 15: case 126: return "in";
            case 13: case 123: return "ch";
            case 14: case 119: return "ag";
            case 12: case 124: return "sa";
            case 25: case 138: return "pu";
            case 18: case 115: return "cc";
            case 49: case 178: return "so";
            case 26: case 182: return "invo";
            case 44: case 174: return "ini";
            case 48: case 176: return "pp";
            case 78: return "fu";
            case 79: return "ta";
            case 27: case 160: case 162: return "epa";
            case 28: case 161: case 163: return "epm";
            case 80: case 82: case 410: return "rpa";
            case 83: case 412: return "rpm";
            case 16: case 112: return "df";
            case 418: return "dc";
            // ⚠️ Corrigé le 26/10/2026 (mesure `GET /characteristics`) : **85** = « Poussée (fixe) »,
            // c'est-à-dire une **réduction** de dommages de poussée (`rp`) — le code rendait `dp`
            // (dommages de poussée, qui sont la caractéristique **84**). Sans cela, une panoplie
            // « Ré Poussée » créditait les dommages.
            case 84: return "dp";
            case 85: return "rp";
            case 0: return "vi";
            case 58: return "rn";
            // `40` = Pods (mesuré sur `/characteristics` : `40 = Pods [weight]`). Le modèle
            // d'aperçu ne porte pas encore les pods (lot B) : le bonus est normalisé des deux
            // côtés du différentiel, sans effet sur les totaux pour l'instant.
            case 40: return "pod";
            case 430: case 431: return "dnf";
            case 422: case 423: return "dtf";
            case 424: case 425: return "dff";
            case 426: case 427: return "def";
            case 428: case 429: return "daf";
            case 141: return "ds";
            case 142: return "dm";
            case 143: return "di";
            case 144: return "da";
            case 37: case 214: return "rnp";
            case 33: case 210: return "rtp";
            case 34: case 213: return "rfp";
            case 35: case 211: return "rep";
            case 36: case 212: return "rap";
            /**
             * Caractéristiques **mesurées** le 26/10/2026 sur `GET /characteristics`
             * (référentiel officiel, 123 entrées) — nécessaires aux **bonus de panoplie**
             * (`/item-sets` les exprime en `characteristic`, pas en `effectId`) :
             *
             *   · `50` Renvoi · `54`–`57` réductions **fixes** par élément (Terre/Feu/Eau/Air) ;
             *   · `86` dommages critiques · `87` réduction critique ;
             *   · `88`–`92` dommages par élément (Terre, Feu, Eau, Air, Neutre).
             *
             * ⚠️ `91`/`92` sont **ambigus** comme `effectId` (« vol de vie ») : les appelants
             * privilégient `characteristic` — même arbitrage que `CHAR_NAMES`
             * (`src/lib/market/effects.ts`).
             *
             * ⚠️ Les codes `rt/rf/re/rn/ra` (réductions fixes) ne sont **pas** portés par le
             * modèle d'aperçu (comme dans le parseur Dofusbook) : ils sont normalisés pour que
             * les deux côtés d'un différentiel parlent la même langue, sans effet sur les totaux.
             */
            case 50: return "rv";
            case 54: return "rt";
            case 55: return "rf";
            case 56: return "re";
            case 57: return "ra";
            case 86: return "dc";
            case 87: return "rc";
            case 88: return "dtf";
            case 89: return "dff";
            case 90: return "def";
            case 91: return "daf";
            case 92: return "dnf";
        }
    }

    // Mapping par libellé ou acronyme Dofusbook
    switch (str) {
        case "pa": case "point d'action": case "points d'action": return "pa";
        case "pm": case "point de mouvement": case "points de mouvement": return "pm";
        case "po": case "portée": return "po";
        case "vi": case "vit": case "vitalité": case "vie": return "vi";
        case "fo": case "force": return "fo";
        case "in": case "intel": case "intelligence": return "in";
        case "ch": case "chance": return "ch";
        case "ag": case "agilité": case "agi": return "ag";
        case "sa": case "sagesse": return "sa";
        case "pu": case "puissance": return "pu";
        case "cc": case "% critique": case "critique": case "coups critiques": return "cc";
        case "so": case "soin": case "soins": return "so";
        case "invo": case "ic": case "invocation": case "invocations": return "invo";
        case "ini": case "ii": case "initiative": return "ini";
        case "pp": case "prospection": return "pp";
        case "fu": case "fuite": return "fu";
        case "ta": case "tacle": return "ta";
        case "epa": case "esquive pa": return "epa";
        case "epm": case "esquive pm": return "epm";
        case "rpa": case "retpa": case "retrait pa": return "rpa";
        case "rpm": case "retpm": case "retrait pm": return "rpm";
        case "dnf": case "do neutre": case "dommages neutre": return "dnf";
        case "dtf": case "do terre": case "dommages terre": return "dtf";
        case "dff": case "do feu": case "dommages feu": return "dff";
        case "def": case "do eau": case "dommages eau": return "def";
        case "daf": case "do air": case "dommages air": return "daf";
        case "df": case "dmg": case "dommages": return "df";
        case "dc": case "do crit": case "dommages critiques": return "dc";
        case "dp": case "do pou": case "dommages poussée": return "dp";
        case "da": case "% do armes": return "da";
        case "ds": case "% do sorts": return "ds";
        case "dm": case "% do mêlée": return "dm";
        case "di": case "dd": case "% do dist": case "% do dist.": case "% do distance": return "di";
        case "rnp": case "% ré neutre": case "résistance neutre (%)": case "% res neutre": return "rnp";
        case "rtp": case "% ré terre": case "résistance terre (%)": case "% res terre": return "rtp";
        case "rfp": case "% ré feu": case "résistance feu (%)": case "% res feu": return "rfp";
        case "rep": case "% ré eau": case "résistance eau (%)": case "% res eau": return "rep";
        case "rap": case "% ré air": case "résistance air (%)": case "% res air": return "rap";
        default: return str;
    }
}

/** Libellé lisible pour un code de stat normalisé. */
export function getStatLabel(code: string): string {
    const filter = VARIANT_STAT_FILTERS.find((f) => f.code === code);
    if (filter) return filter.label;
    return code.toUpperCase();
}

/**
 * Calcule les totaux de stats cumulés d'un item Dofusbook (ou variante).
 */
export function calculateItemStatTotals(item: DofusbookItem | null | undefined): Record<string, number> {
    const totals: Record<string, number> = {};
    if (!item?.effects || !Array.isArray(item.effects)) return totals;

    for (const eff of item.effects) {
        const code = normalizeStatCode(eff.code);
        if (!code) continue;
        const val = eff.value ?? Math.max(eff.min ?? 0, eff.max ?? 0);
        totals[code] = (totals[code] ?? 0) + val;
    }
    return totals;
}

/**
 * Panoplies nécessaires au recalcul d'une variante, **résolues côté serveur**.
 *
 * · `sets`   : id de panoplie (DofusDB) → panoplie normalisée (`GameItemSet.tiers`) ;
 * · `byItem` : id Ankama d'objet → id de panoplie (la variante ne porte pas cette information,
 *   `normalizeSavedVariants` ne conserve pas `itemSetId` : la base fait foi).
 */
export interface VariantItemSets {
    sets: Record<number, ItemSetData>;
    byItem: Record<number, number>;
}

/** Slot **virtuel** : porte le différentiel des bonus de panoplie dans la boucle de stats. */
export const SET_BONUS_VIRTUAL_SLOT = "__panoplies__";

/**
 * Pourquoi une variante n'a **pas** pu être calculée.
 *
 * 🎯 Constat user du 26/10/2026 : « dommage de ne pas expliciter au user les vraies causes ».
 * Le refus était correct (fail-closed) mais muet : le message doit dire **ce qui manque** et
 * **quoi faire**, sans jargon interne.
 */
export type VariantRefusalCode = "no-set-context" | "unknown-sets" | "incoherent-context";

export interface VariantRefusal {
    code: VariantRefusalCode;
    /** Message **court**, prêt à afficher (utilisé dans le badge). */
    message: string;
    /** Détail actionnable (infobulle) : chiffres et noms concernés. */
    details: string;
    /** Panoplies présentes sur le stuff mais **absentes** du référentiel. */
    unknownSetIds?: number[];
    /** Panoplies déclarées par Dofusbook que le référentiel **n'explique pas**. */
    unexplainedSetNames?: string[];
}

/**
 * Diagnostique un refus de recalcul (ou `null` si la variante est calculable).
 *
 * C'est **la** décision : `applyVariantsToBuild` s'appuie dessus, l'UI affiche le message.
 */
export function explainVariantRefusal(
    baseData: DofusbookPreviewData | null | undefined,
    variants: Record<string, DofusbookItem>,
    itemSets?: VariantItemSets | null,
): VariantRefusal | null {
    if (!baseData) return null;
    if (Object.keys(variants ?? {}).length === 0) return null;

    const baseCloths = Array.isArray(baseData.cloths) ? baseData.cloths : [];

    if (!itemSets) {
        if (baseCloths.length === 0) return null;
        return {
            code: "no-set-context",
            message: "Panoplies non chargées — stuff d'origine affiché",
            details:
                `Ce build porte ${baseCloths.length} panoplie(s) active(s) ` +
                `(${baseCloths.map((cloth) => cloth.name).join(", ")}), mais leurs paliers n'ont pas été chargés ` +
                "pour cette page : le total de la variante ne peut pas être recalculé sans afficher un chiffre faux. " +
                "Recharge la page ; si le message persiste, la synchronisation des données de jeu n'est pas terminée.",
        };
    }

    const piecesBySet = effectivePiecesBySet(baseData.items, variants, itemSets.byItem);
    const resolution = activeSetBonuses(piecesBySet, Object.values(itemSets.sets));

    if (resolution.unknownIds.length > 0) {
        return {
            code: "unknown-sets",
            message: "Panoplie non reconnue — stuff d'origine affiché",
            details:
                `La panoplie ${resolution.unknownIds.map((id) => `#${id}`).join(", ")} est portée par ce build ` +
                "mais absente du référentiel des panoplies : impossible d'appliquer ses paliers. " +
                "Demande une synchronisation des données de jeu (siphon des panoplies).",
            unknownSetIds: resolution.unknownIds,
        };
    }

    const baseResolution = activeSetBonuses(
        effectivePiecesBySet(baseData.items, {}, itemSets.byItem),
        Object.values(itemSets.sets),
    );
    if (baseResolution.unknownIds.length > 0 || baseResolution.active.length !== baseCloths.length) {
        const resolved = new Set(baseResolution.active.map((set) => set.name.toLowerCase()));
        const unexplained = baseCloths
            .map((cloth) => cloth.name)
            .filter((name) => !resolved.has(String(name).toLowerCase()));

        return {
            code: "incoherent-context",
            message: "Panoplies incohérentes — stuff d'origine affiché",
            details:
                `Dofusbook déclare ${baseCloths.length} panoplie(s) active(s), le catalogue n'en retrouve que ` +
                `${baseResolution.active.length}` +
                (unexplained.length > 0 ? ` (non expliquée(s) : ${unexplained.join(", ")})` : "") +
                ". Soustraire les anciens bonus pour n'ajouter que les nouveaux donnerait un total faux : " +
                "la variante n'est donc pas calculée. Vérifie que les objets de ce build sont bien dans le catalogue.",
            unexplainedSetNames: unexplained,
        };
    }

    return null;
}


/** Codes de stat **normalisés** d'un ensemble de bonus de panoplie (clés `ii`, `ic`… → `ini`, `invo`). */
function normalizedBonusTotals(bonuses: Record<string, number> | null | undefined): Record<string, number> {
    const totals: Record<string, number> = {};
    for (const [rawCode, value] of Object.entries(bonuses ?? {})) {
        const code = normalizeStatCode(rawCode);
        if (!code || !Number.isFinite(value) || value === 0) continue;
        totals[code] = (totals[code] ?? 0) + value;
    }
    return totals;
}

/** Somme des bonus de panoplie **d'origine** (palier actif, tel que parsé par Dofusbook). */
function baseClothBonusTotals(cloths: DofusbookPreviewData["cloths"]): Record<string, number> {
    const totals: Record<string, number> = {};
    for (const cloth of cloths ?? []) {
        const clothTotals = normalizedBonusTotals(cloth.bonuses);
        for (const [code, value] of Object.entries(clothTotals)) {
            totals[code] = (totals[code] ?? 0) + value;
        }
    }
    return totals;
}

/** Un ensemble `code → valeur` transformé en effets d'objet : réutilise le mapping de stats. */
function effectsFromTotals(totals: Record<string, number>): DofusbookItemEffect[] {
    return Object.entries(totals)
        .filter(([, value]) => Number.isFinite(value) && value !== 0)
        .map(([code, value]) => ({ code, min: value, max: value, value }));
}

/**
 * Pièces **effectives** par panoplie (stuff d'origine + variantes), pièces **distinctes**.
 * L'identité d'un objet est `official || id` (une variante porte l'id Ankama dans `official`).
 */
function effectivePiecesBySet(
    items: DofusbookPreviewData["items"],
    variants: Record<string, DofusbookItem>,
    byItem: Record<number, number>,
): Map<number, Set<number>> {
    const piecesBySet = new Map<number, Set<number>>();
    const slots = new Set<string>([...Object.keys(items ?? {}), ...Object.keys(variants ?? {})]);

    for (const slot of slots) {
        const item = variants[slot] ?? items?.[slot];
        if (!item) continue;
        const ankamaId = Number(item.official || item.id || 0);
        if (!Number.isInteger(ankamaId) || ankamaId <= 0) continue;
        const setId = Number(byItem[ankamaId] ?? 0);
        if (!Number.isInteger(setId) || setId <= 0) continue;

        const pieces = piecesBySet.get(setId) ?? new Set<number>();
        pieces.add(ankamaId); // même objet porté deux fois = **une** pièce
        piecesBySet.set(setId, pieces);
    }
    return piecesBySet;
}

/** Panoplies actives, prêtes pour l'affichage (`cloths`), avec leurs pièces effectives. */
function clothsFromActiveSets(
    active: readonly ActiveSetBonus[],
    items: DofusbookPreviewData["items"],
    variants: Record<string, DofusbookItem>,
    sets: Record<number, ItemSetData>,
): NonNullable<DofusbookPreviewData["cloths"]> {
    const effectiveItems: DofusbookItem[] = [];
    const seen = new Set<string>();
    for (const slot of new Set<string>([...Object.keys(items ?? {}), ...Object.keys(variants ?? {})])) {
        const item = variants[slot] ?? items?.[slot];
        if (!item) continue;
        const key = `${slot}:${Number(item.official || item.id || 0)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        effectiveItems.push(item);
    }

    return active.map((set) => ({
        name: set.name,
        count: set.pieces,
        total: sets[set.setId]?.itemCount ?? set.pieces,
        clothItems: effectiveItems.filter((item) => set.itemIds.includes(Number(item.official || item.id || 0))),
        bonuses: set.bonuses,
    }));
}

/**
 * Applique des variantes locales à un build Dofusbook existant.
 * ⚠️ FONCTION PURE : ne mute jamais `baseData`.
 * Recalcule `stats`, `elements`, `damages`, `resists` et met à jour `items`.
 */
export function applyVariantsToBuild(
    baseData: DofusbookPreviewData | null | undefined,
    variants: Record<string, DofusbookItem>,
    itemSets?: VariantItemSets | null,
): DofusbookPreviewData | null {
    if (!baseData) return null;
    const variantKeys = Object.keys(variants);
    if (variantKeys.length === 0) return baseData;

    // Clone profond pour ne jamais muter les données d'origine
    const result: DofusbookPreviewData = JSON.parse(JSON.stringify(baseData));
    if (!result.items) result.items = {};
    if (!result.stats) {
        result.stats = { pa: 7, pm: 3, po: 0, vit: 1050, ini: 1000, pp: 100, cc: 0, invo: 1, so: 0 };
    }
    if (!result.elements) {
        result.elements = { fo: 0, in: 0, ch: 0, ag: 0, sa: 0, pu: 0 };
    }
    if (!result.resists) {
        result.resists = { neutre: 0, terre: 0, feu: 0, eau: 0, air: 0 };
    }
    if (!result.damages) {
        result.damages = {
            neutre: 0, terre: 0, feu: 0, eau: 0, air: 0, general: 0,
            critique: 0, poussee: 0, armes: 0, sorts: 0, melee: 0, distance: 0,
        };
    }

    /**
     * 🔁 **Bonus de panoplie recalculés** (lot A, 26/10/2026).
     *
     * Le payload Dofusbook ne porte que le **palier actif** : une variante qui casse (ou active)
     * une panoplie laissait donc les bonus du stuff d'origine. On retire les bonus d'origine
     * (`cloths[].bonuses`, déjà inclus dans les totaux parsés) et on réapplique ceux du stuff
     * **effectif**, calculés par la règle partagée `activeSetBonuses()`.
     *
     * ⚠️ **Fail-closed** : contexte absent sur un build qui porte une panoplie, ou panoplie
     * absente du référentiel ⇒ `null`. L'appelant affiche un refus explicite — jamais une
     * approximation silencieuse.
     */
    type PendingSwap = { slot: string; variantItem: DofusbookItem; originalItem: DofusbookItem | null };
    const pending: PendingSwap[] = [];
    const baseCloths = Array.isArray(baseData.cloths) ? baseData.cloths : [];

    // ⚠️ **La** décision de refus vit dans `explainVariantRefusal()` : la règle de calcul et le
    // message affiché à l'utilisateur ne peuvent pas diverger (constat user du 26/10/2026 :
    // « dommage de ne pas expliciter au user les vraies causes »).
    if (explainVariantRefusal(baseData, variants, itemSets)) return null;

    if (itemSets) {
        const piecesBySet = effectivePiecesBySet(baseData.items, variants, itemSets.byItem);
        const { active } = activeSetBonuses(piecesBySet, Object.values(itemSets.sets));

        const oldTotals = baseClothBonusTotals(baseCloths);
        const newTotals = sumSetBonuses(active);
        pending.push({
            slot: SET_BONUS_VIRTUAL_SLOT,
            // Aucun de ces deux objets n'est écrit dans `items` (slot virtuel) : ils ne servent
            // qu'à porter le **différentiel** dans le mapping de stats existant.
            originalItem: { id: 0, name: "", picture: 0, official: 0, effects: effectsFromTotals(oldTotals) },
            variantItem: { id: 0, name: "", picture: 0, official: 0, effects: effectsFromTotals(newTotals) },
        });
        result.cloths = clothsFromActiveSets(active, baseData.items, variants, itemSets.sets);
    }

    for (const slot of variantKeys) {
        const variantItem = variants[slot];
        if (!variantItem) continue;
        pending.push({ slot, variantItem, originalItem: baseData.items?.[slot] ?? null });
    }

    for (const { slot, variantItem, originalItem } of pending) {
        const oldTotals = calculateItemStatTotals(originalItem);
        const newTotals = calculateItemStatTotals(variantItem);

        // Différentiel pour chaque stat modifiée
        const allKeys = new Set([...Object.keys(oldTotals), ...Object.keys(newTotals)]);

        for (const statCode of allKeys) {
            const oldVal = oldTotals[statCode] ?? 0;
            const newVal = newTotals[statCode] ?? 0;
            const delta = newVal - oldVal;
            if (delta === 0) continue;

            switch (statCode) {
                // Vitals
                case "pa": result.stats.pa = Math.max(0, (result.stats.pa ?? 0) + delta); break;
                case "pm": result.stats.pm = Math.max(0, (result.stats.pm ?? 0) + delta); break;
                case "po": result.stats.po = (result.stats.po ?? 0) + delta; break;
                case "vi": case "vit": {
                    result.stats.vit = Math.max(0, (result.stats.vit ?? 0) + delta);
                    if (result.characteristics?.vi) {
                        result.characteristics.vi.items = Math.max(0, (result.characteristics.vi.items ?? 0) + delta);
                        result.characteristics.vi.total = Math.max(0, (result.characteristics.vi.total ?? 0) + delta);
                    }
                    break;
                }
                case "ini": result.stats.ini = Math.max(0, (result.stats.ini ?? 0) + delta); break;
                case "pp": result.stats.pp = Math.max(0, (result.stats.pp ?? 0) + delta); break;
                case "cc": result.stats.cc = (result.stats.cc ?? 0) + delta; break;
                case "invo": result.stats.invo = Math.max(1, (result.stats.invo ?? 0) + delta); break;
                case "so": result.stats.so = (result.stats.so ?? 0) + delta; break;
                // Pods apportés par l'équipement (la capacité se recalcule à l'affichage).
                case "pod": result.stats.pod = Math.max(0, (result.stats.pod ?? 0) + delta); break;
                case "rpa": result.stats.retpa = (result.stats.retpa ?? 0) + delta; break;
                case "rpm": result.stats.retpm = (result.stats.retpm ?? 0) + delta; break;
                case "epa": result.stats.epa = (result.stats.epa ?? 0) + delta; break;
                case "epm": result.stats.epm = (result.stats.epm ?? 0) + delta; break;
                case "ta": result.stats.tacle = (result.stats.tacle ?? 0) + delta; break;
                case "fu": result.stats.fuite = (result.stats.fuite ?? 0) + delta; break;

                // Éléments
                case "fo": {
                    result.elements.fo = (result.elements.fo ?? 0) + delta;
                    // Initiative = somme des 4 éléments ⇒ un delta élémentaire la déplace aussi.
                    result.stats.ini = (result.stats.ini ?? 0) + delta;
                    if (result.characteristics?.fo) {
                        result.characteristics.fo.items = Math.max(0, (result.characteristics.fo.items ?? 0) + delta);
                        result.characteristics.fo.total = Math.max(0, (result.characteristics.fo.total ?? 0) + delta);
                    }
                    break;
                }
                case "in": {
                    result.elements.in = (result.elements.in ?? 0) + delta;
                    result.stats.ini = (result.stats.ini ?? 0) + delta;
                    if (result.characteristics?.in) {
                        result.characteristics.in.items = Math.max(0, (result.characteristics.in.items ?? 0) + delta);
                        result.characteristics.in.total = Math.max(0, (result.characteristics.in.total ?? 0) + delta);
                    }
                    break;
                }
                case "ch": {
                    result.elements.ch = (result.elements.ch ?? 0) + delta;
                    result.stats.ini = (result.stats.ini ?? 0) + delta;
                    if (result.characteristics?.ch) {
                        result.characteristics.ch.items = Math.max(0, (result.characteristics.ch.items ?? 0) + delta);
                        result.characteristics.ch.total = Math.max(0, (result.characteristics.ch.total ?? 0) + delta);
                    }
                    break;
                }
                case "ag": {
                    result.elements.ag = (result.elements.ag ?? 0) + delta;
                    result.stats.ini = (result.stats.ini ?? 0) + delta;
                    if (result.characteristics?.ag) {
                        result.characteristics.ag.items = Math.max(0, (result.characteristics.ag.items ?? 0) + delta);
                        result.characteristics.ag.total = Math.max(0, (result.characteristics.ag.total ?? 0) + delta);
                    }
                    break;
                }
                case "sa": {
                    result.elements.sa = (result.elements.sa ?? 0) + delta;
                    if (result.characteristics?.sa) {
                        result.characteristics.sa.items = Math.max(0, (result.characteristics.sa.items ?? 0) + delta);
                        result.characteristics.sa.total = Math.max(0, (result.characteristics.sa.total ?? 0) + delta);
                    }
                    break;
                }
                case "pu": {
                    result.elements.pu = (result.elements.pu ?? 0) + delta;
                    if (result.characteristics?.pu) {
                        result.characteristics.pu.items = Math.max(0, (result.characteristics.pu.items ?? 0) + delta);
                        result.characteristics.pu.total = Math.max(0, (result.characteristics.pu.total ?? 0) + delta);
                    }
                    break;
                }

                // Résistances %
                case "rnp": result.resists.neutre = (result.resists.neutre ?? 0) + delta; break;
                case "rtp": result.resists.terre = (result.resists.terre ?? 0) + delta; break;
                case "rfp": result.resists.feu = (result.resists.feu ?? 0) + delta; break;
                case "rep": result.resists.eau = (result.resists.eau ?? 0) + delta; break;
                case "rap": result.resists.air = (result.resists.air ?? 0) + delta; break;

                // Résistances secondaires / renvoi (`rc`, `rp`, `rm`, `rd`, `rv`)
                case "rc": result.resists.critique = (result.resists.critique ?? 0) + delta; break;
                case "rp": result.resists.poussee = (result.resists.poussee ?? 0) + delta; break;
                case "rm": result.resists.melee = (result.resists.melee ?? 0) + delta; break;
                case "rd": result.resists.distance = (result.resists.distance ?? 0) + delta; break;
                case "rv": result.resists.renvoi = (result.resists.renvoi ?? 0) + delta; break;

                // Dommages fixes & %
                case "dnf": result.damages.neutre = (result.damages.neutre ?? 0) + delta; break;
                case "dtf": result.damages.terre = (result.damages.terre ?? 0) + delta; break;
                case "dff": result.damages.feu = (result.damages.feu ?? 0) + delta; break;
                case "def": result.damages.eau = (result.damages.eau ?? 0) + delta; break;
                case "daf": result.damages.air = (result.damages.air ?? 0) + delta; break;
                case "df": result.damages.general = (result.damages.general ?? 0) + delta; break;
                case "dc": result.damages.critique = (result.damages.critique ?? 0) + delta; break;
                case "dp": result.damages.poussee = (result.damages.poussee ?? 0) + delta; break;
                case "da": result.damages.armes = (result.damages.armes ?? 0) + delta; break;
                case "ds": result.damages.sorts = (result.damages.sorts ?? 0) + delta; break;
                case "dm": result.damages.melee = (result.damages.melee ?? 0) + delta; break;
                case "di": result.damages.distance = (result.damages.distance ?? 0) + delta; break;
            }
        }

        // Remplacement du slot — jamais pour le slot **virtuel** des panoplies.
        if (slot !== SET_BONUS_VIRTUAL_SLOT) result.items[slot] = variantItem;
    }

    return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// Variantes **enregistrées** (proposées par le joueur sur son stuff)
// ─────────────────────────────────────────────────────────────────────────────

/** Nombre maximal de slots dans une variante enregistrée (16 slots d'équipement). */
export const SAVED_VARIANT_MAX_SLOTS = 16;
const SAVED_VARIANT_MAX_EFFECTS = 40;
const SAVED_VARIANT_MAX_NAME = 120;
const SAVED_VARIANT_MAX_STAT = 1_000_000;

/**
 * Icône **locale** acceptée pour un objet variante : chemin relatif servi par l'application
 * (`/uploads/…`, `/assets/…`, `/api/assets-dofus/…`). Toute URL externe est refusée
 * (pas de hotlink, pas d'`http`, pas de `//host`).
 */
export function safeVariantIconUrl(raw: unknown): string | undefined {
    if (typeof raw !== "string") return undefined;
    const value = raw.trim().slice(0, 200);
    if (!value.startsWith("/") || value.startsWith("//")) return undefined;
    if (!/^\/(uploads|assets|api\/assets-dofus)\//.test(value)) return undefined;
    return value;
}

/**
 * Variante proposée par le joueur, **stockée dans `dofusBookLinks[].variants`** (JSON, aucune
 * migration) : une entrée par slot, au format `DofusbookItem` (le même que `applyVariantsToBuild`).
 *
 * ⚠️ La synchronisation Dofusbook n'est **jamais** touchée : `previewData` reste la donnée du
 * build d'origine, la variante s'applique par-dessus, à l'affichage.
 */
export type SavedVariant = Record<string, DofusbookItem>;

function boundedInt(value: unknown, fallback = 0): number {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(-SAVED_VARIANT_MAX_STAT, Math.min(SAVED_VARIANT_MAX_STAT, Math.round(n)));
}

/**
 * Assainit une variante **venue du client ou de la base** : slots connus uniquement, bornes sur
 * les textes et les valeurs, effets tronqués. Une entrée invalide est **écartée** (fail-closed :
 * une variante corrompue ne casse pas l'affichage du stuff d'origine).
 */
export function normalizeSavedVariants(raw: unknown): SavedVariant {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};

    const out: SavedVariant = {};
    let slots = 0;

    for (const [slot, value] of Object.entries(raw as Record<string, unknown>)) {
        if (slots >= SAVED_VARIANT_MAX_SLOTS) break;
        const slotInfo = VARIANT_SLOTS[slot];
        if (!slotInfo) continue;
        if (!value || typeof value !== "object" || Array.isArray(value)) continue;

        const item = value as Record<string, unknown>;
        const id = boundedInt(item.id);
        const name = typeof item.name === "string" ? item.name.trim().slice(0, SAVED_VARIANT_MAX_NAME) : "";
        if (id <= 0 || name.length === 0) continue;

        const effects: DofusbookItemEffect[] = [];
        if (Array.isArray(item.effects)) {
            for (const fx of item.effects.slice(0, SAVED_VARIANT_MAX_EFFECTS)) {
                if (!fx || typeof fx !== "object") continue;
                const line = fx as Record<string, unknown>;
                const code = typeof line.code === "string" ? line.code.trim().slice(0, 12) : "";
                if (!code) continue;
                const min = boundedInt(line.min);
                const max = boundedInt(line.max, min);
                const value = boundedInt(line.value, Math.max(min, max));
                effects.push({ code, min, max, value });
            }
        }

        out[slot] = {
            id,
            name,
            picture: boundedInt(item.picture, id),
            official: boundedInt(item.official, id),
            level: Math.max(1, Math.min(200, boundedInt(item.level, 1))),
            typeName: typeof item.typeName === "string" ? item.typeName.trim().slice(0, 40) : slotInfo.slotName,
            effects,
            ...(safeVariantIconUrl(item.iconUrl) ? { iconUrl: safeVariantIconUrl(item.iconUrl) } : {}),
        };
        slots += 1;
    }

    return out;
}

/** La variante est-elle vide (aucun slot utile) ? */
export function hasSavedVariant(variants: SavedVariant | null | undefined): boolean {
    return !!variants && Object.keys(variants).length > 0;
}

/** Ordre d'équipement stable : sert aux surfaces qui listent une variante (miniature, galerie). */
const VARIANT_SLOT_ORDER = [
    "ch", "ca", "am", "a1", "a2", "ce", "bo", "ar", "br", "fa", "mo",
    "d1", "d2", "d3", "d4", "d5", "d6",
] as const;

/** Un objet remplacé par la variante, prêt à être affiché (libellé de slot + objet d'origine). */
export interface SavedVariantDescription {
    slot: string;
    slotLabel: string;
    name: string;
    originalName: string | null;
}

/**
 * Décrit les objets **remplacés** par une variante, dans l'ordre d'équipement.
 *
 * Pourquoi : la miniature du profil et la carte de la galerie doivent montrer la variante
 * **au clic**, sans ouvrir la fiche détaillée (demande user du 25/10/2026). La règle reste
 * ici — une seule source de vérité, testable sans rendu — et les surfaces se contentent
 * d'afficher le résultat.
 *
 * `originalItems` est optionnel : sans lui, `originalName` vaut `null` (aucune invention
 * du nom d'origine).
 */
export function describeSavedVariants(
    variants: SavedVariant | null | undefined,
    originalItems?: Record<string, DofusbookItem | null | undefined> | null,
): SavedVariantDescription[] {
    if (!variants) return [];

    const described: SavedVariantDescription[] = [];
    const seen = new Set<string>();

    const push = (slot: string, name: string) => {
        seen.add(slot);
        described.push({
            slot,
            slotLabel: VARIANT_SLOTS[slot]?.slotName ?? slot,
            name,
            originalName: originalItems?.[slot]?.name ?? null,
        });
    };

    for (const slot of VARIANT_SLOT_ORDER) {
        const item = variants[slot];
        if (item) push(slot, item.name);
    }
    // Ceinture de sécurité : un slot inconnu (donnée ancienne) reste affichable, jamais perdu.
    for (const [slot, item] of Object.entries(variants)) {
        if (item && !seen.has(slot)) push(slot, item.name);
    }

    return described;
}

/** Deux variantes portent-elles exactement les mêmes objets (évite une écriture inutile) ? */
export function sameSavedVariant(a: SavedVariant | null | undefined, b: SavedVariant | null | undefined): boolean {
    const left = a ?? {};
    const right = b ?? {};
    const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
    for (const key of keys) {
        const la = left[key];
        const rb = right[key];
        if (!la || !rb) return false;
        if (la.id !== rb.id || la.name !== rb.name) return false;
        const ea = la.effects ?? [];
        const eb = rb.effects ?? [];
        if (ea.length !== eb.length) return false;
        for (let i = 0; i < ea.length; i += 1) {
            if (ea[i].code !== eb[i].code || ea[i].min !== eb[i].min || ea[i].max !== eb[i].max) return false;
        }
    }
    return true;
}

