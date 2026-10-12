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

import { z } from "zod";

export interface MapCoords {
    x: number;
    y: number;
}

/**
 * Position GPS d'une étape de quête — **source unique** (God quêtes par
 * Dofus) : `{x, y}` du travel, `label` libre, `zaap` = détour **manuel**
 * saisi en God (`{x, y}` → `/zaap zx,zy ; /travel x,y`). Le booléen `true`
 * reste accepté pour les positions historiques en mode auto (zaap le plus
 * proche, façon DPLN). Sans `zaap` : simple `/travel x,y`.
 */
export const questPositionSchema = z.object({
    x: z.number(),
    y: z.number(),
    label: z.string().optional().nullable(),
    zaap: z.union([z.boolean(), z.object({ x: z.number(), y: z.number() })]).optional(),
});

export type QuestPosition = z.infer<typeof questPositionSchema>;

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

/**
 * Coordonnée de jeu saisie en God (champ X / Y dissocié) : accepte `number`
 * ou chaîne (`" -22 "`), refuse tout le reste (vide, décimal, NaN, infini).
 * `null` = inexploitable (jamais inventée, jamais arrondie).
 */
export function parseGameCoord(value: unknown): number | null {
    if (typeof value === "number") {
        return isValidCoord(value) ? value : null;
    }
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    if (!/^-?\d+$/.test(trimmed)) return null;
    const parsed = parseInt(trimmed, 10);
    return isValidCoord(parsed) ? parsed : null;
}

/**
 * `/zaap zx,zy ; /travel x,y` **manuel** (saisie God explicite) : les 4
 * coordonnées sont validées comme entières, sinon `null`. Contrairement à
 * `buildZaapTravelCommand` (zaap auto le plus proche + garde même-monde),
 * la saisie manuelle est copiée telle quelle — c'est le God qui décide que
 * le détour vaut le coup (façon DPLN, annonce 3.7).
 */
export function buildManualZaapTravelCommand(
    zaapX: unknown,
    zaapY: unknown,
    x: unknown,
    y: unknown,
): string | null {
    const zx = parseGameCoord(zaapX);
    const zy = parseGameCoord(zaapY);
    const tx = parseGameCoord(x);
    const ty = parseGameCoord(y);
    if (zx === null || zy === null || tx === null || ty === null) return null;
    return `/zaap ${zx},${zy} ; /travel ${tx},${ty}`;
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
