/**
 * Référentiel des effets passifs **officiels** des objets (Dofus, objets légendaires,
 * bénédictions, Prysmaradites…).
 *
 * Deux sources, dans cet ordre :
 *  1. **Catalogue siphonné** (`src/data/item-passives.json`) — `GET /spells/{id}` DofusDB, texte
 *     FR **verbatim** (balisage `{{spell,id,grade::Nom}}` nettoyé ici et testé). Le lien
 *     objet → sort vient de la ligne native `effectId 1175` (`diceNum` = sort, `diceSide` = grade),
 *     mesurée sur **344 objets** le 23/10/2026 (`scripts/siphon-item-passives.mjs`).
 *  2. **Repli manuel** (`DOFUS_PASSIVES`) — résumés historiques, utilisés **uniquement** quand
 *     l'objet ne porte aucun `sp` et que son nom n'est pas au catalogue.
 *
 * ⚠️ Aucun texte inventé : sans source, on renvoie `null` (l'UI n'affiche rien plutôt qu'une
 * règle fausse). Le repli générique « Effet tactique déclenché lors du premier tour » a été
 * supprimé le 23/10/2026 (il était affiché pour toutes les Prysmaradites).
 */

import passivesCatalog from "@/data/item-passives.json";
import type { DofusbookItemEffect } from "@/lib/dofusbook-utils";

type CatalogEntry = { name: string; text: string };
const SPELL_CATALOG: Record<string, CatalogEntry> =
    (passivesCatalog as { spells?: Record<string, CatalogEntry> }).spells ?? {};

/** Nombre de sorts passifs officiels disponibles (constante de diagnostic, testée). */
export const OFFICIAL_PASSIVE_COUNT = Object.keys(SPELL_CATALOG).length;

export const DOFUS_PASSIVES: Record<string, string> = {
    "dofus abyssal":
        "Au début du tour : confère 1 PM si aucun ennemi n'est en ligne de vue à 4 cases ou moins, sinon confère 1 PA pendant 1 tour.",
    "dofus ivoire":
        "En début de tour, confère l'effet « Réduction des dommages » (50%). Cet effet est consommé dès la première attaque subie.",
    "dofus ebene":
        "À la fin du tour, confère 1 charge d'Ébène (max 5). Au début du tour, si 5 charges sont atteintes, la prochaine attaque directe applique un poison sur la cible pendant 3 tours.",
    "dofus nebuleux":
        "Aux tours impairs : confère 20% de dommages finaux. Aux tours pairs : retire 10% de dommages finaux.",
    "dofus emeraude":
        "À la fin du tour, confère 10% des PV max en bouclier pour chaque ennemi au contact (cumulable jusqu'à 20%).",
    "dofus pourpre":
        "Lorsque le porteur subit des dommages à distance, ses dommages finaux sont augmentés de 1% pendant 1 tour (cumulable 20 fois).",
    "dofus turquoise":
        "Lors d'un Coup Critique, augmente les dommages finaux de 1% pendant 3 tours (cumulable 10 fois). Si un échec critique est évité, augmente les dommages de 5%.",
    "dofus argente":
        "En fin de tour, si les points de vie sont inférieurs à 20%, soigne 20% des PV max et confère 20% de résistance pendant 1 tour (1 fois par combat).",
    "dofus argente scintillant":
        "En fin de tour, si les points de vie sont inférieurs à 20%, soigne 40% des PV max et confère 20% de résistance pendant 1 tour (1 fois par combat).",
    "dofus forgelave":
        "Lorsque le porteur est déplacé par une poussée, une attirance ou un échange de position, confère 150 points de bouclier pendant 1 tour.",
    "dofus tachete":
        "En début de tour, soigne le porteur et les alliés proches selon les altérations subies.",
    "dofus cauchemar":
        "À chaque début de tour, confère de la puissance et du bouclier selon la proximité des ennemis.",
    "dofus sylvestre":
        "À la fin du tour, applique l'effet Sylvestre augmentant les résistances ou soignant les alliés.",
    "dofus des glaces":
        "Confère 25 Dommages Fixes dans tous les éléments (Neutre, Terre, Feu, Eau, Air).",
    "dofus ocre":
        "Confère 1 Point d'Action (PA) permanent.",
    "dofus vulbis":
        "Confère 1 Point de Mouvement (PM) permanent. À la fin du tour, si aucun dommage n'a été subi, augmente les dommages finaux de 10% pendant 1 tour.",
    "dofus des veilleurs":
        "En début de tour, soigne de 7% de leurs PV max les alliés situés en ligne ou en diagonale avec le porteur.",
    "dofus dolmanax":
        "Confère 50 Force, 50 Intelligence, 50 Chance et 50 Agilité.",
    "dofus dokoko":
        "Au début du combat puis tous les 4 tours : soigne 25% des PV max.",
    "dofus domakuro":
        "Au début des 5 premiers tours de jeu, confère 16 à 20 Dommages Fixes cumulables.",
    "dofus cawotte":
        "Confère 60 Sagesse.",
    "dofus kaliptus":
        "Confère de 6 à 30 Prospection.",
};

/**
 * Normalise une chaîne pour recherche tolérante (sans accents ni ponctuation).
 */
function normalizeKey(str: string): string {
    return str
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

/**
 * Nettoie le balisage DofusDB d'une description de sort passif.
 *
 * Entrée réelle (`/spells/5952`) :
 * `{{spell,5952,1::Bleu Turquoise}} :\n• Lorsque le porteur effectue un coup critique…`
 * Sortie : `• Lorsque le porteur effectue un coup critique…`
 */
export function cleanPassiveMarkup(raw: string | null | undefined): string | null {
    if (typeof raw !== "string") return null;
    let text = raw.replace(/\r\n?/g, "\n");

    // En-tête « {{spell,<id>,<grade::Nom>}} : » éventuel (avec ou sans espace avant « : »).
    text = text.replace(/^\s*\{\{spell,[^}]*\}\}\s*:?\s*/i, "");
    // Balises résiduelles (liens de sort au fil du texte).
    text = text.replace(/\{\{spell,[^}]*\}\}/gi, "");
    text = text.replace(/\{\{[^}]*\}\}/g, "");
    text = text.replace(/\u00a0/g, " ");
    text = text
        .split("\n")
        .map((line) => line.replace(/[ \t]+$/g, ""))
        .join("\n")
        .trim();

    return text.length > 0 ? text : null;
}

/** Texte officiel d'un sort passif (id Ankama/DofusDB). `null` si absent du catalogue. */
export function resolvePassiveText(spellId: number | null | undefined): string | null {
    if (!spellId || !Number.isFinite(spellId) || spellId <= 0) return null;
    const entry = SPELL_CATALOG[String(spellId)];
    return entry ? cleanPassiveMarkup(entry.text) : null;
}

/** Nom officiel du sort passif (diagnostic / repli d'affichage). */
export function resolvePassiveName(spellId: number | null | undefined): string | null {
    if (!spellId || !Number.isFinite(spellId) || spellId <= 0) return null;
    return SPELL_CATALOG[String(spellId)]?.name ?? null;
}

/** Id du sort passif porté par un nom d'objet (catalogue officiel uniquement). */
export function findPassiveSpellIdByName(itemName: string | null | undefined): number | null {
    if (!itemName) return null;
    const clean = normalizeKey(itemName);
    if (!clean) return null;

    for (const [id, entry] of Object.entries(SPELL_CATALOG)) {
        const spellName = normalizeKey(entry.name);
        if (spellName && spellName === clean) return Number(id);
    }
    for (const [id, entry] of Object.entries(SPELL_CATALOG)) {
        const spellName = normalizeKey(entry.name);
        if (spellName && (spellName.includes(clean) || clean.includes(spellName))) return Number(id);
    }
    return null;
}

/**
 * Repli manuel par nom d'objet (résumés historiques). **Ne devine jamais** : sans entrée,
 * renvoie `null`.
 */
export function getPassiveDescription(itemName: string): string | null {
    if (!itemName) return null;
    const clean = normalizeKey(itemName);

    for (const [key, desc] of Object.entries(DOFUS_PASSIVES)) {
        if (clean.includes(key) || key.includes(clean)) {
            return desc;
        }
    }
    return null;
}

export type ItemPassiveResolution = {
    /** Texte affichable (balisage déjà nettoyé). */
    text: string;
    /** Id du sort passif quand il est connu (`null` pour un repli par nom). */
    spellId: number | null;
    /** `spell` = description officielle DofusDB ; `name` = résumé manuel de repli. */
    source: "spell" | "name";
};

type PassiveItemLike = {
    name?: string | null;
    effects?: ReadonlyArray<Pick<DofusbookItemEffect, "code" | "min" | "max">> | null;
};

/**
 * Résout l'effet passif d'un **objet d'un build** (payload Dofusbook).
 *
 * `sp` porte le sort passif dans `min` (id) et `max` (grade) — l'ancien affichage brut
 * « sp 6828-1 » était exactement `min–max`.
 *
 * Ordre : sort du `sp` → nom de l'objet au catalogue → résumé manuel → `null`.
 */
export function resolveItemPassive(item: PassiveItemLike | null | undefined): ItemPassiveResolution | null {
    if (!item) return null;

    // 1. `sp` du build (source la plus fiable : c'est CE sort que le jeu applique).
    const spLine = (item.effects ?? []).find((fx) => fx?.code === "sp");
    const spId = spLine ? Number(spLine.min) : 0;
    if (spId > 0) {
        const text = resolvePassiveText(spId);
        if (text) return { text, spellId: spId, source: "spell" };
    }

    // 2. Nom de l'objet → sort officiel du catalogue.
    const byName = findPassiveSpellIdByName(item.name ?? null);
    if (byName) {
        const text = resolvePassiveText(byName);
        if (text) return { text, spellId: byName, source: "spell" };
    }

    // 3. Repli manuel (résumé), uniquement si aucune source officielle.
    const manual = item.name ? getPassiveDescription(item.name) : null;
    if (manual) return { text: manual, spellId: null, source: "name" };

    return null;
}

/** L'objet porte-t-il une ligne `sp` (donc un pouvoir passif) sans texte officiel résolu ? */
export function hasUnresolvedPassive(item: PassiveItemLike | null | undefined): boolean {
    if (!item) return false;
    const hasSp = (item.effects ?? []).some((fx) => fx?.code === "sp");
    return hasSp && resolveItemPassive(item) === null;
}
