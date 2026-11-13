/**
 * **Pods** (capacité d'inventaire) — règle pure, sans I/O.
 *
 * 🎯 Mesure du 26/10/2026 (builds réels de la base, valeurs Dofusbook) :
 *   · build `22329554` — Force **190** → **1950** = `1000 + 5 × 190` ;
 *   · build `23582119` — Force **50** → **1250** = `1000 + 5 × 50`.
 * Les deux tombent **exactement** juste : la formule est `1000 + 5 × Force`, plus les pods
 * donnés par les objets (caractéristique DofusDB `40`, code `pod`).
 *
 * ⚠️ Le payload Dofusbook ne porte **aucun poids** : `GameItem.realWeight` (la charge, en kg)
 * n'a rien à voir avec cette valeur, qui est une **capacité**. Ne pas joindre les poids.
 *
 * **Fail-closed** : Force inconnue ⇒ `null`. L'UI n'affiche alors rien (jamais `1000` par défaut,
 * qui ferait passer une donnée manquante pour un vrai total).
 */

/** Socle de pods de tout personnage. */
export const PODS_BASE = 1000;
/** Pods gagnés par point de Force. */
export const PODS_PER_FORCE = 5;
/** Borne de sécurité (donnée d'affichage : jamais de valeur absurde). */
export const MAX_PODS = 100_000;

export interface PodsInput {
    /** Force **totale** du personnage (`elements.fo` : équipement + capital + parchotage). */
    force?: number | null;
    /** Pods apportés par l'équipement (`stats.pod`, items + panoplies). */
    itemPods?: number | null;
}

/**
 * Capacité en pods, ou `null` si elle n'est **pas** calculable.
 *
 * @returns un entier borné `[0, MAX_PODS]`, ou `null` quand la Force est inconnue.
 */
export function computePods(input: PodsInput): number | null {
    // ⚠️ `Number(null)` vaut **0** : une Force absente passerait pour « 0 de Force » et
    // afficherait `1000` — une valeur inventée. On refuse explicitement l'absence.
    if (input.force === null || input.force === undefined) return null;
    const force = Number(input.force);
    if (!Number.isFinite(force)) return null;

    const rawItemPods = Number(input.itemPods ?? 0);
    const itemPods = Number.isFinite(rawItemPods) ? rawItemPods : 0;

    const total = PODS_BASE + PODS_PER_FORCE * force + itemPods;
    return Math.max(0, Math.min(MAX_PODS, Math.round(total)));
}

/** Libellé d'affichage : `—` quand la capacité n'est pas calculable (jamais `0`). */
export function formatPods(pods: number | null | undefined): string {
    return pods === null || pods === undefined ? "—" : String(pods);
}
