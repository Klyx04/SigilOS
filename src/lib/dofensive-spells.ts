/**
 * Types + fusion des sorts Dofensive — module client-safe (PAS un server action).
 *
 * Les données de combat Dofensive (`/spells/{id}`, par grade) sont la source de
 * vérité pour la simulation : AP, portée, LdV, ligne/diagonale, cooldown, max cast
 * et zone AoE. Ce module est importé par les composants clients pour fusionner ces
 * données avec les sorts DofusDB (images/descriptions) sans passer par un server action.
 */

export type DofensiveZoneShape =
    | "Cercle"
    | "Croix"
    | "Ligne"
    | "Cône"
    | "Perpend"
    | "Rectangle"
    | "Point"
    | "Inconnue";

export interface DofensiveSpellZone {
    shape: DofensiveZoneShape;
    size: number;
    range: number;
}

/** Effet Dofensive structuré (durée, déclencheurs, masques d'affectation). */
export interface DofensiveSpellEffect {
    /** Effet principal formaté (ex. « État Invulnérable », « -10 Fuite »). */
    label: string;
    /** Durée formatée : « infini », « pour N tour(s) », ou null (instantané). */
    duration: string | null;
    /** Déclencheurs (ex. « L'effet est déclenché lorsque la cible reçoit des dommages d'une invocation »). */
    triggers: string[];
    /** Masques d'affectation (ex. « Affecte le lanceur (même en-dehors de la zone d'effet) »). */
    masks: string[];
}

export interface DofensiveSpellCombat {
    id: number;
    name: string;
    /** Icône officielle Dofensive (CDN) — distincte par sort, contrairement à DofusDB. */
    imageUrl?: string;
    apCost: number;
    minRange: number;
    range: number;
    castTestLos: boolean;
    castInLine: boolean;
    castInDiagonal: boolean;
    /** Probabilité de coup critique (%). */
    criticalChance: number;
    /** Nombre de lancers par tour. */
    maxCastPerTurn: number;
    /** Nombre de lancers par cible. */
    maxCastPerTarget: number;
    /** Cooldown (tours). */
    minCastInterval: number;
    /** Description Dofensive du sort (ex. « Ce sort est lancé une seule fois par l'ennemi lorsqu'il rejoint le combat. »). */
    description?: string;
    /** Grade/Niveau Dofensive du level utilisé (« Niv. X »). */
    grade?: number;
    /** Effets résumés (texte FR formaté) — lignes « label (durée) » + déclencheurs. */
    effects: string[];
    /** Version structurée des effets (durées, déclencheurs, masques) pour l'affichage détaillé. */
    effectDetails?: DofensiveSpellEffect[];
    /** Effets critiques formatés (lignes) — section « Effets critiques ». */
    criticalEffects?: string[];
    /** false si le sort n'a aucun effet critique (« Aucun effet critique »). */
    hasCriticalEffects?: boolean;
    zone: DofensiveSpellZone | null;
}

export interface DofensiveMergedSpell extends Omit<DofensiveSpellCombat, "zone"> {
    zone?: DofensiveSpellZone;
    imageUrl?: string;
    description?: string;
}

/**
 * Fusionne les sorts DofusDB (images/descriptions) avec les données de combat
 * Dofensive (AP/portée/LoS/ligne/diagonale/cooldown/zone). Les champs de combat
 * Dofensive PRIMENT (source de vérité combat) ; les sorts présents uniquement chez
 * l'une des deux sources sont conservés. Jamais d'écrasement destructif.
 */
export function mergeDofensiveSpells(
    dbSpells: Array<{ id: number; name?: string; imageUrl?: string; description?: string }> = [],
    dofensiveSpells: DofensiveSpellCombat[] = []
): DofensiveMergedSpell[] {
    const dbMap = new Map<number, { name?: string; imageUrl?: string; description?: string }>();
    for (const s of dbSpells) {
        const sid = Number(s?.id);
        if (Number.isFinite(sid) && sid > 0) dbMap.set(sid, s);
    }

    const merged: DofensiveMergedSpell[] = [];
    const seen = new Set<number>();
    for (const ds of dofensiveSpells) {
        const db = dbMap.get(ds.id);
        merged.push({
            ...ds,
            name: db?.name || ds.name,
            imageUrl: ds.imageUrl || db?.imageUrl, // icône Dofensive préférée (distincte par sort)
            // Description Dofensive prioritaire (contexte de combat du sort), DofusDB en fallback.
            description: ds.description || db?.description,
            zone: ds.zone ?? undefined,
        });
        seen.add(ds.id);
    }
    // Sorts DofusDB non couverts par Dofensive (ex. sorts invoqués/déclenchés) : on les garde tels quels.
    for (const db of dbSpells) {
        const sid = Number(db?.id);
        if (Number.isFinite(sid) && sid > 0 && !seen.has(sid)) {
            merged.push(db as unknown as DofensiveMergedSpell);
        }
    }
    return merged;
}
