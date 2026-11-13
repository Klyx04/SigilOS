/**
 * Marquage « Titan vaincu » — verdict **pur** sur la réponse du serveur.
 *
 * 🐛 Défaut mesuré le 30/10/2026 (constat user) : le 1er clic affichait un toast **ERREUR** alors
 * que la ligne était bien créée, et le 2ᵉ clic décocheait. La cause était l'ancien `toggle`
 * implicite + une comparaison illisible côté client
 * (`res.data.completed === !prev.has(id)`), qui prenait un **succès** pour un échec.
 *
 * La règle désormais : le client **dit l'état voulu**, le serveur le renvoie, et on compare
 * simplement les deux. Aucune notion de « prev ».
 */
export interface TitanToggleResult {
    success: boolean;
    data?: { completed?: boolean };
}

/** `true` seulement si l'action a réussi **et** que l'état obtenu est celui demandé. */
export function isTitanToggleApplied(result: TitanToggleResult | null | undefined, desired: boolean): boolean {
    return !!result?.success && result.data?.completed === desired;
}
