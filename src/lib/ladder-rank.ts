import { formatGroupedInteger } from "@/lib/market/kamas";

/**
 * D2 — les deux rangs affichés sur le profil ne sont pas la même chose.
 *
 * - `rank` vient du worker Ladder : rang du joueur au classement **Ankama** des succès ;
 * - `guildRank` est calculé par SigilOS (`getLadderPreview`) : nombre de membres ACTIFS
 *   de la guilde ayant plus de points + 1. Ce n'est ni un rang Ankama ni le rang de la
 *   guilde au classement.
 *
 * Les libellés « Monde » / « Guilde » laissaient croire l'inverse.
 */
export const SUCCESS_RANK_LABEL = "Rang succès";
export const SUCCESS_RANK_HINT = "Rang au classement des succès Ankama";
export const INTERNAL_RANK_LABEL = "Rang interne";
export const INTERNAL_RANK_HINT =
    "Classement interne SigilOS, dépend de la fraîcheur des points des autres membres";

/** Rang absent ou invalide : tiret, jamais « #undefined ». */
const EMPTY_RANK = "—";

/**
 * `364` → `364ᵉ`, `1` → `1ᵉʳ`, `1 234` → `1 234ᵉ`, absent → `—`.
 *
 * Formatage **déterministe** via `formatGroupedInteger` (espace fine insécable U+202F) :
 * le rendu serveur et l'hydratation produisent la même chaîne (BUG-9 du Marché).
 */
export function formatRankOrdinal(value: number | null | undefined): string {
    if (typeof value !== "number" || !Number.isFinite(value)) return EMPTY_RANK;
    const rank = Math.trunc(value);
    if (rank <= 0) return EMPTY_RANK;
    return rank === 1 ? "1ᵉʳ" : `${formatGroupedInteger(rank)}ᵉ`;
}
