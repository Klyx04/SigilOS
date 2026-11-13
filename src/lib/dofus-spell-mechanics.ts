/**
 * Extension de la classification des effets de sort Dofus.
 *
 * Ajoute la détection des mécaniques avancées :
 *   - sorts à charges / accumulation (Torrent Arcanique, Glas du Xelor, Fléau…)
 *   - sorts posant des glyphes / pièges / runes (Huppemage, Roublard, Osamodas…)
 *   - effets conditionnels (pesanteur requise, seuil de PV…)
 *   - soins en fonction d'un état (soin si X)
 */

import { cleanDofusText } from "@/lib/dofus-spells";

// ─── Détection "sort à charges" ───────────────────────────────────────────────

/**
 * Résultat de l'analyse d'un sort pour déterminer s'il dépend de charges/accumulation.
 * Si `isChargeBased` est vrai, `chargeLabel` décrit la mécanique (ex. « × charges Wakfu »),
 * et `maxCharges` donne le plafond raisonnable à proposer dans le slider (heuristique).
 */
export interface ChargeSpellInfo {
    isChargeBased: boolean;
    /** Libellé de la mécanique de charge (pour le tooltip du slider). */
    chargeLabel: string;
    /** Nombre max de charges raisonnable (défaut 6, détecté si mentionné). */
    maxCharges: number;
    /** Facteur de multiplication des dégâts par charge (défaut 1 = pas de multiplication). */
    damagePerCharge: "additive" | "multiplicative" | "none";
}

/** Patterns de détection d'un sort à charges dans les libellés d'effets. */
const CHARGE_PATTERNS: { pattern: RegExp; label: string; max?: number; mode?: "additive" | "multiplicative" }[] = [
    { pattern: /par\s+charge/i,                   label: "Par charge",        max: 6,  mode: "additive" },
    { pattern: /charge\s+wakfu|wakfu\s+charge/i,  label: "Charge Wakfu",      max: 6,  mode: "additive" },
    { pattern: /accumul/i,                         label: "Accumulation",      max: 8,  mode: "additive" },
    { pattern: /(?:×|x|fois)\s*(?:le\s+)?nombre\s+de\s+charge/i, label: "× charges", max: 6, mode: "multiplicative" },
    { pattern: /niveau\s+de\s+maîtrise|maîtrise\s+de\s+sort/i,   label: "Maîtrise", max: 6, mode: "additive" },
    { pattern: /par\s+tour/i,                     label: "Par tour",          max: 10, mode: "additive" },
    { pattern: /selon\s+(?:le\s+)?(?:nombre|niveau)\s+de/i,      label: "Variable", max: 8, mode: "additive" },
    { pattern: /r[ée]p[eè]tition|nombre\s+de\s+(?:lancer|cast)/i, label: "Répétition", max: 5, mode: "additive" },
    { pattern: /par\s+cible\s+touch[ée]e/i,       label: "Par cible touchée", max: 6,  mode: "additive" },
];

/**
 * Analyse les effets d'un sort pour détecter une mécanique de charges / accumulation.
 * Ne retourne `isChargeBased: true` que si au moins un pattern est trouvé dans les libellés.
 */
export function detectChargeSpell(
    effectDetails?: Array<{ label?: string } | string> | null | undefined
): ChargeSpellInfo {
    const fallback: ChargeSpellInfo = { isChargeBased: false, chargeLabel: "", maxCharges: 6, damagePerCharge: "none" };
    if (!effectDetails || effectDetails.length === 0) return fallback;

    for (const raw of effectDetails) {
        const label = cleanDofusText(typeof raw === "string" ? raw : (raw as { label?: string }).label ?? "");
        for (const { pattern, label: chargeLabel, max = 6, mode = "additive" } of CHARGE_PATTERNS) {
            if (pattern.test(label)) {
                // Cherche un max explicite dans le texte (ex. "jusqu'à 8 charges")
                const maxMatch = label.match(/jusqu'[àa]\s*(\d+)\s*charge/i) ?? label.match(/max[imum]*\s+(\d+)/i);
                const detectedMax = maxMatch ? Math.min(12, Math.max(2, +maxMatch[1])) : max;
                return { isChargeBased: true, chargeLabel, maxCharges: detectedMax, damagePerCharge: mode };
            }
        }
    }
    return fallback;
}

// ─── Détection glyphes / pièges / invocations de zone ────────────────────────

export type GlyphKind = "glyph" | "trap" | "rune" | "totem" | "summon_zone" | "marking";

export interface GlyphInfo {
    isGlyph: boolean;
    kind: GlyphKind;
    /** Durée du glyphe/piège en texte. */
    duration: string | null;
    /** Couleur thématique du glyphe (pour le rendu SVG). */
    color: string;
    /** Icône emoji du glyphe. */
    icon: string;
    /** Description courte. */
    label: string;
}

const GLYPH_PATTERNS: { pattern: RegExp; kind: GlyphKind; color: string; icon: string }[] = [
    { pattern: /glyphe/i,            kind: "glyph",       color: "#a78bfa", icon: "✦" },
    { pattern: /piège|pi.ge/i,       kind: "trap",        color: "#f97316", icon: "⚠" },
    { pattern: /rune/i,              kind: "rune",        color: "#60a5fa", icon: "ᚱ" },
    { pattern: /totem/i,             kind: "totem",       color: "#34d399", icon: "🗿" },
    { pattern: /balisage|balise/i,   kind: "marking",     color: "#fbbf24", icon: "◎" },
    { pattern: /zone\s+d[e']invoc/i, kind: "summon_zone", color: "#f97316", icon: "👾" },
    { pattern: /sceau/i,             kind: "rune",        color: "#60a5fa", icon: "◈" },
    { pattern: /symbole/i,           kind: "glyph",       color: "#a78bfa", icon: "⬡" },
    { pattern: /chakra/i,            kind: "glyph",       color: "#f472b6", icon: "✦" },
    { pattern: /portail/i,           kind: "glyph",       color: "#818cf8", icon: "⌀" },
];

/**
 * Analyse les effets pour détecter un sort posant un glyphe / piège / rune sur la grille.
 */
export function detectGlyphSpell(
    effectDetails?: Array<{ label?: string; duration?: string | null } | string> | null | undefined
): GlyphInfo {
    const fallback: GlyphInfo = { isGlyph: false, kind: "glyph", duration: null, color: "#a78bfa", icon: "✦", label: "" };
    if (!effectDetails || effectDetails.length === 0) return fallback;

    for (const raw of effectDetails) {
        const label = cleanDofusText(typeof raw === "string" ? raw : (raw as { label?: string }).label ?? "");
        const duration = typeof raw === "object" && raw !== null && "duration" in raw
            ? (raw as { duration?: string | null }).duration ?? null : null;
        for (const { pattern, kind, color, icon } of GLYPH_PATTERNS) {
            if (pattern.test(label)) {
                return { isGlyph: true, kind, duration, color, icon, label };
            }
        }
    }
    return fallback;
}

// ─── Détection effets conditionnels ──────────────────────────────────────────

export interface ConditionalEffect {
    /** Condition requise (texte nettoyé). */
    condition: string;
    /** Effet si condition vraie (texte nettoyé). */
    ifTrue: string;
}

const CONDITION_PATTERNS = [
    /si\s+la\s+cible\s+est\s+en\s+(.+?)(?:\s*[:,])/i,
    /si\s+(.+?)\s+(?:est|sont)\s+actif/i,
    /sous\s+(?:l[''])?[ée]tat\s+(.+?)(?:\s*[:,;])/i,
    /uniquement\s+(?:si|sous)/i,
    /n[ée]cessite\s+/i,
];

export function detectConditionalEffects(
    effectDetails?: Array<{ label?: string } | string> | null | undefined
): ConditionalEffect[] {
    if (!effectDetails) return [];
    const out: ConditionalEffect[] = [];
    for (const raw of effectDetails) {
        const label = cleanDofusText(typeof raw === "string" ? raw : (raw as { label?: string }).label ?? "");
        for (const p of CONDITION_PATTERNS) {
            const m = label.match(p);
            if (m) {
                out.push({ condition: m[1]?.trim() ?? label, ifTrue: label });
                break;
            }
        }
    }
    return out;
}
