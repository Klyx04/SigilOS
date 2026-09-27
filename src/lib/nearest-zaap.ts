/**
 * Zaap le plus proche — helper PUR et PARTAGÉ (worldmap + guide Sylvestre +
 * overlay + page publique).
 *
 * Pourquoi il existe : le calcul n'existait qu'en local dans deux composants du
 * worldmap, en distance de Manhattan sur **tous** les zaaps sans tenir compte du
 * monde. Or `public/game-data/zaaps.json` ne contient que 44 zaaps, tous dans le
 * Monde des Douze (monde 1) et Incarnam (monde 2) : dans un monde sans zaap (les
 * dimensions, les sous-sols de donjon…), l'ancien calcul proposait un zaap du
 * monde 1 à 800 maps de distance, présenté comme « le plus proche » — un
 * mensonge silencieux.
 *
 * Règle ici : on cherche d'abord DANS le monde demandé, et si ce monde n'a aucun
 * zaap on rend `sameWorld: false` (avec, en repli, le zaap le plus proche hors
 * monde). L'appelant décide alors d'afficher « aucun zaap dans ce monde » —
 * jamais un faux « plus proche » sans le dire.
 */

export type ZaapEntry = {
    id?: number;
    name: string;
    x: number;
    y: number;
    /** Monde (`worldMap`) du zaap ; absent/null = monde inconnu. */
    worldId?: number | null;
    subArea?: string | null;
};

export type NearestZaap = {
    zaap: ZaapEntry;
    /** Distance de Manhattan en maps (le déplacement Dofus est orthogonal). */
    distance: number;
    /** Vrai si le zaap appartient au monde demandé (sinon : repli hors monde). */
    sameWorld: boolean;
};

export function manhattanDistance(a: { x: number; y: number }, b: { x: number; y: number }): number {
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function isUsableZaap(z: ZaapEntry | null | undefined): z is ZaapEntry {
    return !!z && Number.isFinite(z.x) && Number.isFinite(z.y);
}

function closestOf(zaaps: ZaapEntry[], target: { x: number; y: number }): ZaapEntry {
    let best = zaaps[0];
    let bestDist = manhattanDistance(best, target);
    for (const z of zaaps) {
        const d = manhattanDistance(z, target);
        // `<` strict : à distance égale, le premier de la liste gagne (déterminisme).
        if (d < bestDist) {
            bestDist = d;
            best = z;
        }
    }
    return best;
}

/**
 * Zaap le plus proche d'une position.
 *
 * @param zaaps  Liste brute (`public/game-data/zaaps.json` ou fetch client).
 * @param target Position cible ; `worldId` absent/null = monde inconnu → on
 *               cherche partout et `sameWorld` vaut `true` (aucune affirmation
 *               fausse possible sur un monde qu'on ignore).
 * @returns `null` si aucun zaap exploitable.
 */
export function findNearestZaap(
    zaaps: ZaapEntry[] | null | undefined,
    target: { x: number; y: number; worldId?: number | null }
): NearestZaap | null {
    const list = (zaaps ?? []).filter(isUsableZaap);
    if (list.length === 0) return null;

    const worldId = target?.worldId ?? null;
    if (worldId != null) {
        const inWorld = list.filter((z) => z.worldId === worldId);
        if (inWorld.length > 0) {
            const zaap = closestOf(inWorld, target);
            return { zaap, distance: manhattanDistance(zaap, target), sameWorld: true };
        }
        // Aucun zaap dans ce monde → repli hors monde, marqué comme tel.
        const zaap = closestOf(list, target);
        return { zaap, distance: manhattanDistance(zaap, target), sameWorld: false };
    }

    const zaap = closestOf(list, target);
    return { zaap, distance: manhattanDistance(zaap, target), sameWorld: true };
}
