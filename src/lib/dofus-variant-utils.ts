import type { DofusbookItem, DofusbookItemEffect, DofusbookPreviewData } from "@/lib/dofusbook-utils";

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
            case 85: return "dp";
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
 * Applique des variantes locales à un build Dofusbook existant.
 * ⚠️ FONCTION PURE : ne mute jamais `baseData`.
 * Recalcule `stats`, `elements`, `damages`, `resists` et met à jour `items`.
 */
export function applyVariantsToBuild(
    baseData: DofusbookPreviewData | null | undefined,
    variants: Record<string, DofusbookItem>
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

    for (const slot of variantKeys) {
        const variantItem = variants[slot];
        if (!variantItem) continue;

        const originalItem = baseData.items?.[slot];
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
                case "rpa": result.stats.retpa = (result.stats.retpa ?? 0) + delta; break;
                case "rpm": result.stats.retpm = (result.stats.retpm ?? 0) + delta; break;
                case "ta": result.stats.tacle = (result.stats.tacle ?? 0) + delta; break;
                case "fu": result.stats.fuite = (result.stats.fuite ?? 0) + delta; break;

                // Éléments
                case "fo": {
                    result.elements.fo = (result.elements.fo ?? 0) + delta;
                    if (result.characteristics?.fo) {
                        result.characteristics.fo.items = Math.max(0, (result.characteristics.fo.items ?? 0) + delta);
                        result.characteristics.fo.total = Math.max(0, (result.characteristics.fo.total ?? 0) + delta);
                    }
                    break;
                }
                case "in": {
                    result.elements.in = (result.elements.in ?? 0) + delta;
                    if (result.characteristics?.in) {
                        result.characteristics.in.items = Math.max(0, (result.characteristics.in.items ?? 0) + delta);
                        result.characteristics.in.total = Math.max(0, (result.characteristics.in.total ?? 0) + delta);
                    }
                    break;
                }
                case "ch": {
                    result.elements.ch = (result.elements.ch ?? 0) + delta;
                    if (result.characteristics?.ch) {
                        result.characteristics.ch.items = Math.max(0, (result.characteristics.ch.items ?? 0) + delta);
                        result.characteristics.ch.total = Math.max(0, (result.characteristics.ch.total ?? 0) + delta);
                    }
                    break;
                }
                case "ag": {
                    result.elements.ag = (result.elements.ag ?? 0) + delta;
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

        // Remplacement du slot
        result.items[slot] = variantItem;
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

