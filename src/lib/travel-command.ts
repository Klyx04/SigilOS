/**
 * Commandes de téléportation in-game (`/travel`, `/zaap`) — règles **pures**.
 *
 * Mesuré le 07/10/2026 : depuis la màj **3.7**, le client accepte
 * `/zaap x,y` (téléportation vers le zaap de ces coordonnées) **combinable**
 * avec `/travel x,y` (« `/zaap x,y ; /travel x,y` », annonce dofuspourlesnoobs).
 * Contrainte : `/zaap` **ne traverse pas les mondes** (zaap inaccessible
 * depuis la map actuelle ⇒ commande inopérante) — d'où la garde `sameWorld`,
 * déjà calculée par `findNearestZaap` (`src/lib/nearest-zaap.ts`).
 */

export interface MapCoords {
    x: number;
    y: number;
}

/** Coordonnée entière finie (les positions du jeu sont des entiers). */
function isValidCoord(value: unknown): value is number {
    return typeof value === "number" && Number.isSafeInteger(value);
}

function isValidPosition(pos: MapCoords | null | undefined): pos is MapCoords {
    return !!pos && isValidCoord(pos.x) && isValidCoord(pos.y);
}

/** `/travel x,y` — `null` si la position n'est pas exploitable (jamais inventée). */
export function buildTravelCommand(pos: MapCoords | null | undefined): string | null {
    if (!isValidPosition(pos)) return null;
    return `/travel ${pos.x},${pos.y}`;
}

/** Candidat zaap (ex. `NearestZaapInfo`) : coords + garde même-monde. */
export interface ZaapCandidate {
    x?: unknown;
    y?: unknown;
    sameWorld?: boolean;
}

/**
 * `/zaap x,y ; /travel x,y` façon dofuspourlesnoobs — `null` quand le détour
 * zaap est indisponible : zaap inconnu, position inconnue, ou **monde
 * différent** (`sameWorld: false` ⇒ la commande échouerait en jeu).
 */
export function buildZaapTravelCommand(
    zaap: ZaapCandidate | null | undefined,
    pos: MapCoords | null | undefined,
): string | null {
    if (!zaap || zaap.sameWorld === false) return null;
    if (!isValidCoord(zaap.x) || !isValidCoord(zaap.y)) return null;
    const travelCmd = buildTravelCommand(pos);
    if (!travelCmd) return null;
    return `/zaap ${zaap.x},${zaap.y} ; ${travelCmd}`;
}
