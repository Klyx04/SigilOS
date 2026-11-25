/**
 * Zaap « façon dofuspourlesnoobs » — **règle pure, ISO DPLN** (mesure du
 * 25/11/2026, script `fast-travel/autopilotage.js`).
 *
 * Le guide Rush doit proposer exactement les mêmes boutons que DPLN :
 *   · la position de départ vient de la ligne « Position de lancement » DPLN ;
 *   · le zaap est le **plus proche** de cette position, calculé sur la liste
 *     DPLN ci-dessous (distance de Manhattan + pénalité éventuelle) ;
 *   · un zaap explicite `(zaap x,y)` dans la page prime ;
 *   · `[x,y!]` (exclusion) ou `.no-auto-zaap` supprime le bouton.
 *
 * On ne calcule donc **jamais** avec `public/game-data/zaaps.json` : cette liste
 * contient des zaaps ajoutés/modifiés depuis (39 en monde 1 contre 37 chez
 * DPLN, dont Bonta `[-31,-56]`) et produisait un zaap différent de DPLN.
 *
 * Tous les zaaps DPLN sont dans le monde classique (1) : hors monde 1 on rend
 * `sameWorld: false` et l'interface n'affiche pas de commande qui échouerait.
 */

/** Liste DPLN, ordre et pénalités recopiés tels quels (`autopilotage.js`). */
const DPLN_ZAAPS: ReadonlyArray<readonly [number, number, number?]> = [
  [-83, -15, 1],
  [-78, -41],
  [-77, -73],
  [-67, -77],
  [-67, 29],
  [-46, 18],
  [-34, -8],
  [-31, -56],
  [-27, -36],
  [-26, 37],
  [-25, 12],
  [-20, -20],
  [-17, -47],
  [-16, 1],
  [-13, -28],
  [-11, -36],
  [-5, -23],
  [-5, -8],
  [-3, -42],
  [-2, 0],
  [-1, 13],
  [-1, 24],
  [0, -56],
  [1, -32],
  [3, -5],
  [5, -18],
  [5, 7],
  [7, -4],
  [10, 22],
  [13, 26],
  [15, -58],
  [20, -29, 1],
  [25, -4],
  [27, -14],
  [35, 12],
  [39, -82],
  [40, -44],
];

export type DplnZaap = {
  x: number;
  y: number;
  /** Distance DPLN (Manhattan + pénalité), pour expliquer/tester. */
  distance: number;
  /** `false` hors monde 1 : la commande `/zaap` ne traverserait pas le monde. */
  sameWorld: boolean;
};

/**
 * Zaap le plus proche d'une position, **règle DPLN exacte**.
 *
 * `worldId` : monde du `pos_tags`. Absent/null = monde inconnu → on accepte la
 * liste DPLN (comportement historique). Un monde explicitement différent de 1
 * rend `sameWorld: false` (fail-closed, aucun zaap inventé).
 */
export function dplnNearestZaap(
  x: number,
  y: number,
  worldId?: number | null
): DplnZaap | null {
  if (!Number.isSafeInteger(x) || !Number.isSafeInteger(y)) return null;
  let best: readonly [number, number, number?] | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const zaap of DPLN_ZAAPS) {
    const distance = Math.abs(x - zaap[0]) + Math.abs(y - zaap[1]) + (zaap[2] ?? 0);
    // `<` strict : à égalité, le premier de la liste DPLN gagne (déterminisme).
    if (distance < bestDistance) {
      bestDistance = distance;
      best = zaap;
    }
  }
  if (!best) return null;
  const sameWorld = typeof worldId !== "number" || worldId === 1;
  return { x: best[0], y: best[1], distance: bestDistance, sameWorld };
}
