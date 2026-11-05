/**
 * Règles pures du **déplacement d'une quête** entre deux blocs du guide Rush.
 *
 * Un déplacement ne touche **que** le bloc et l'ordre : la route (cité, Ordre,
 * palier, classe), les tips, les tags, les donjons et les métadonnées restent
 * attachés à la quête. L'ordre d'arrivée est calculé ici, hors UI, pour que
 * l'action serveur et le studio parlent le même langage (une seule règle).
 */
export function nextSequenceOrder(orders: readonly number[]): number {
    let max = -1;
    for (const order of orders) {
        if (Number.isFinite(order) && order > max) max = order;
    }
    return max + 1;
}
