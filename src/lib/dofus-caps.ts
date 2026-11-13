/**
 * **Plafonds de points** (PA / PM) — règle pure, source officielle.
 *
 * 📌 Mesure du 26/10/2026 (Dofus Wiki, `Characteristic` § Action Point / Movement Point) :
 *   · « You can only have a maximum of **12 AP** … Although you are able to equip extra
 *     equipment with more AP, **the AP bonus will not be included**. »
 *   · « You can only have a maximum of **6 MP** … the MP bonus will not be included. »
 * Le plafond ne s'applique **qu'aux** bonus d'équipement : les buffs de combat peuvent le
 * dépasser, un build ne le peut pas.
 *
 * 🎯 Constat user du 26/10/2026 : « j'ai mis un familier PA qui fait monter le stuff à 13 PA
 * de base (impossible normalement sur Dofus) ». L'objet est bien +1 PA ; c'est le **total
 * affiché** qui doit être plafonné — et le point ignoré **dit**, jamais masqué.
 *
 * ⚠️ Aucun import : utilisable côté client comme serveur.
 */

/** Plafond des points d'action (hors buffs de combat). */
export const MAX_AP = 12;
/** Plafond des points de mouvement (hors buffs de combat). */
export const MAX_MP = 6;
/** Plafond de la portée (PO) — « the Range bonus will not be included » au-delà. */
export const MAX_RANGE = 6;
/** Plafond des invocations — « the Summons bonus will not be included » au-delà. */
export const MAX_SUMMONS = 6;

export interface CappedPoints {
    /** Valeur affichable (plafonnée). */
    value: number;
    /** Points calculés au-delà du plafond, donc **non comptés** par le jeu. */
    ignored: number;
}

/**
 * Plafonne une valeur de PA/PM.
 *
 * @param raw valeur calculée (items + panoplies + variante), éventuellement au-dessus du plafond
 * @param max `MAX_AP` ou `MAX_MP`
 */
export function capPoints(raw: number | null | undefined, max: number): CappedPoints {
    const value = Number(raw);
    if (raw === null || raw === undefined || !Number.isFinite(value)) {
        return { value: 0, ignored: 0 };
    }
    const boundedMax = Number.isFinite(max) && max > 0 ? max : 0;
    const floored = Math.max(0, Math.round(value));
    return {
        value: Math.min(floored, boundedMax),
        ignored: Math.max(0, floored - boundedMax),
    };
}

/** Raccourci PA. */
export function capActionPoints(raw: number | null | undefined): CappedPoints {
    return capPoints(raw, MAX_AP);
}

/** Raccourci PM. */
export function capMovementPoints(raw: number | null | undefined): CappedPoints {
    return capPoints(raw, MAX_MP);
}

/** Raccourci Portée (PO). */
export function capRange(raw: number | null | undefined): CappedPoints {
    return capPoints(raw, MAX_RANGE);
}

/** Raccourci Invocations. */
export function capSummons(raw: number | null | undefined): CappedPoints {
    return capPoints(raw, MAX_SUMMONS);
}
