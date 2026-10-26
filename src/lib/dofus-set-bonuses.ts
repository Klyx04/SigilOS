/**
 * Bonus de panoplie — **règles pures**, source de vérité unique.
 *
 * 🎯 Pourquoi ce module existe : la sélection du palier était écrite **dans le parseur**
 * (`processDofusbookRawData`) et **absente** du recalcul des variantes, si bien qu'une
 * variante qui cassait (ou activait) une panoplie laissait les bonus du stuff d'origine.
 * Deux implémentations = deux vérités. Ici, une seule :
 *
 *   · une panoplie est **active dès 2 pièces distinctes** ;
 *   · **le palier courant remplace le précédent** — les paliers ne s'additionnent **jamais**
 *     (Dofus 3.7, doc « Comprendre les interactions d'équipement dans DOFUS », 25/10/2026) ;
 *   · un même objet porté deux fois ne compte que pour **une** pièce distincte.
 *
 * Sources de données normalisées par les appelants :
 *   · DofusDB `/item-sets` → `effects` est un **tableau indexé par palier** (`index = pièces − 1`),
 *     ligne = `{ characteristic, from, effectId }` (mesuré sur `/item-sets/242` le 26/10/2026) ;
 *   · payload Dofusbook → `cloths[].effects[]` porte déjà `count` sur chaque ligne.
 *
 * ⚠️ Aucun import : ce module reste utilisable côté client **et** serveur, et testable seul.
 */

/**
 * Une panoplie n'est active qu'à partir de **2 pièces distinctes** (règle 3.7).
 * Une éventuelle ligne `count = 1` envoyée par une source est donc ignorée : l'appliquer
 * serait un bonus fantôme.
 */
export const MIN_ACTIVE_SET_PIECES = 2;

/** Bornes de validation (donnée de base ou d'API externe : jamais crue). */
export const MAX_SET_TIERS = 20;
export const MAX_SET_TIER_EFFECTS = 40;
export const MAX_SET_VALUE = 1_000_000;

/** Effet d'un palier, déjà normalisé (`code` = `fo`, `ini`, `ta`…). */
export interface ItemSetTierEffect {
    code: string;
    value: number;
    /** `effectId` DofusDB — traçabilité, absent côté Dofusbook. */
    effectId?: number;
}

/** Un palier : le nombre de pièces qu'il exige + ses effets. */
export interface ItemSetTier {
    count: number;
    effects: ItemSetTierEffect[];
}

/** Panoplie normalisée (ligne `GameItemSet` ou échantillon de test). */
export interface ItemSetData {
    /** Id DofusDB de la panoplie. */
    id: number;
    name: string;
    /** Nombre total de pièces de la panoplie (`total` affiché « 3/6 »). */
    itemCount?: number;
    tiers: ItemSetTier[];
}

/** Panoplie active sur un stuff donné, avec le palier retenu et ses bonus cumulés. */
export interface ActiveSetBonus {
    setId: number;
    name: string;
    /** Pièces **distinctes** effectivement équipées. */
    pieces: number;
    /** Palier retenu (nombre de pièces), `0` si aucun palier atteint. */
    tier: number;
    /** Bonus du palier, par code de stat **normalisé**. */
    bonuses: Record<string, number>;
    /** Ids Ankama des pièces équipées de cette panoplie. */
    itemIds: number[];
}

/**
 * Résolution d'un ensemble de panoplies.
 *
 * `unknownIds` n'est **jamais** absorbé : une panoplie portée (≥ 2 pièces) mais absente du
 * référentiel rend le calcul **impossible** — l'appelant doit refuser (fail-closed), pas
 * afficher une approximation.
 */
export interface SetBonusResolution {
    active: ActiveSetBonus[];
    unknownIds: number[];
}

/**
 * Ligne de palier **plate** (les deux sources peuvent la produire) :
 * `count` = pièces exigées, `code` = stat déjà normalisée, `value` = valeur du palier.
 */
export interface SetBonusLine {
    count: number;
    code: string;
    value: number;
    effectId?: number;
}

function boundedValue(raw: unknown): number | null {
    const n = Number(raw);
    if (!Number.isFinite(n)) return null;
    return Math.max(-MAX_SET_VALUE, Math.min(MAX_SET_VALUE, Math.round(n)));
}

function boundedCount(raw: unknown): number | null {
    const n = Number(raw);
    if (!Number.isInteger(n) || n < 1 || n > MAX_SET_TIERS + 1) return null;
    return n;
}

/**
 * Nombre de pièces du **plus haut palier atteint**, `0` si la panoplie n'est pas active.
 *
 * C'est la seule décision qui compte : les lignes d'un palier inférieur sont ignorées,
 * jamais additionnées.
 */
export function activeTierCount(
    lines: ReadonlyArray<{ count: number }>,
    pieces: number,
): number {
    if (!Number.isFinite(pieces) || pieces < MIN_ACTIVE_SET_PIECES) return 0;
    return lines.reduce((max, line) => {
        const count = Number(line.count) || 0;
        return count > 0 && count <= pieces ? Math.max(max, count) : max;
    }, 0);
}


/**
 * Bonus d'une panoplie normalisée pour un nombre de pièces donné.
 *
 * Les lignes d'un même code **au sein d'un palier** se cumulent (une panoplie peut porter
 * deux fois la même stat) ; les **paliers** ne se cumulent pas.
 */
export function tierBonuses(
    tiers: readonly ItemSetTier[],
    pieces: number,
): { tier: number; bonuses: Record<string, number> } {
    const tier = activeTierCount(tiers, pieces);
    if (tier === 0) return { tier: 0, bonuses: {} };

    const bonuses: Record<string, number> = {};
    for (const line of tiers) {
        if (Number(line.count) !== tier) continue;
        for (const effect of line.effects) {
            if (!effect.code) continue;
            bonuses[effect.code] = (bonuses[effect.code] ?? 0) + effect.value;
        }
    }
    return { tier, bonuses };
}

/** Somme de plusieurs panoplies actives (même code ⇒ addition **entre panoplies**). */
export function sumSetBonuses(active: readonly ActiveSetBonus[]): Record<string, number> {
    const total: Record<string, number> = {};
    for (const set of active) {
        for (const [code, value] of Object.entries(set.bonuses)) {
            if (!value) continue;
            total[code] = (total[code] ?? 0) + value;
        }
    }
    return total;
}

/**
 * Panoplies actives d'un stuff.
 *
 * @param piecesBySet id de panoplie → **ids Ankama distincts** des pièces équipées
 * @param sets        référentiel (seules les panoplies portées sont nécessaires)
 */
export function activeSetBonuses(
    piecesBySet: ReadonlyMap<number, ReadonlySet<number>>,
    sets: readonly ItemSetData[],
): SetBonusResolution {
    const byId = new Map<number, ItemSetData>();
    for (const set of sets) byId.set(set.id, set);

    const active: ActiveSetBonus[] = [];
    const unknownIds: number[] = [];

    for (const [setId, pieceIds] of piecesBySet) {
        if (!Number.isInteger(setId) || setId <= 0) continue;
        const pieces = pieceIds.size;
        if (pieces < MIN_ACTIVE_SET_PIECES) continue;

        const set = byId.get(setId);
        if (!set) {
            unknownIds.push(setId);
            continue;
        }

        const { tier, bonuses } = tierBonuses(set.tiers, pieces);
        /**
         * Une panoplie **portée** (≥ 2 pièces distinctes) est active **même sans bonus** : les
         * panoplies cosmétiques existent (aucun palier). L'ignorer ferait croire à une donnée
         * manquante et décalerait la cohérence avec les `cloths` du parseur.
         */
        active.push({
            setId,
            name: set.name,
            pieces,
            tier,
            bonuses,
            itemIds: [...pieceIds],
        });
    }

    active.sort((a, b) => a.setId - b.setId);
    unknownIds.sort((a, b) => a - b);
    return { active, unknownIds };
}

/**
 * Valide une valeur `GameItemSet.tiers` (JSON de base) → paliers sûrs.
 *
 * Fail-closed : une ligne illisible est **écartée** (jamais de bonus inventé) ; un palier
 * vide n'est pas conservé.
 */
export function normalizeItemSetTiers(raw: unknown): ItemSetTier[] {
    if (!Array.isArray(raw)) return [];

    const tiers: ItemSetTier[] = [];
    for (const rawTier of raw.slice(0, MAX_SET_TIERS)) {
        if (!rawTier || typeof rawTier !== "object") continue;
        const count = boundedCount((rawTier as { count?: unknown }).count);
        if (count === null) continue;

        const rawEffects = (rawTier as { effects?: unknown }).effects;
        if (!Array.isArray(rawEffects)) continue;

        const effects: ItemSetTierEffect[] = [];
        for (const rawEffect of rawEffects.slice(0, MAX_SET_TIER_EFFECTS)) {
            if (!rawEffect || typeof rawEffect !== "object") continue;
            const line = rawEffect as { code?: unknown; value?: unknown; effectId?: unknown };
            const code = typeof line.code === "string" ? line.code.trim().slice(0, 12) : "";
            const value = boundedValue(line.value);
            if (!code || value === null || value === 0) continue;
            const effectId = Number(line.effectId);
            effects.push({
                code,
                value,
                ...(Number.isInteger(effectId) && effectId > 0 ? { effectId } : {}),
            });
        }

        if (effects.length > 0) tiers.push({ count, effects });
    }

    return tiers.sort((a, b) => a.count - b.count);
}
