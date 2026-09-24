/**
 * Encart statique « où est le donjon » — UNE tuile Leaflet en <img>, sans Leaflet.
 *
 * Reprend EXACTEMENT la formule du renderer (`leaflet-map-core.tsx` :
 * `SigilTilesLayer.getTileUrl` + position des marqueurs) pour que la tuile et
 * le repère coïncident avec la carte interactive :
 * - pixels échelle 1 : `px = origineX + gx*mapWidth + mapWidth/2`
 * - banque/échelle via `resolveTileBank`, grille TOUJOURS au `ceil` sur échelle
 *   snappée, `index = ty*cols + tx + 1`, tuile 256 px (monde 1) ou 250 px.
 */
import { resolveTileBank } from "./worldmap-tiles";

export interface MinimapWorld {
    id: number;
    origineX: number;
    origineY: number;
    mapWidth: number;
    mapHeight: number;
    totalWidth: number;
    totalHeight: number;
    zoom: number[];
}

export interface MinimapTile {
    /** URL publique de la tuile, ex. `/game-data/tiles/w1/0.6/184.webp`. */
    tileUrl: string;
    /** Position du repère en % dans la tuile. */
    leftPct: number;
    topPct: number;
    /** Lien profond vers la carte publique. */
    mapHref: string;
}

export interface MinimapGridTile {
    /** URL de la tuile, ou `null` hors grille (fond océan). */
    tileUrl: string | null;
    col: number;
    row: number;
}

export interface MinimapGrid {
    tiles: MinimapGridTile[];
    /** Dimensions de la grille (ex. 5×3 en paysage). */
    cols: number;
    rows: number;
    /** Position du repère en % dans la grille. */
    leftPct: number;
    topPct: number;
    /** Lien profond vers la carte publique. */
    mapHref: string;
}

/** Zoom Leaflet de l'encart : même cadrage que le deep-link historique (-2). */
export const MINIMAP_ZOOM = -2;

/** Demi-largeur de la grille (1 = 3×3 tuiles centrées sur le donjon). */
export const MINIMAP_GRID_RADIUS = 1;

/**
 * Calcule la tuile + la position du repère pour des coordonnées de jeu.
 * Retourne `null` si le point est hors grille (l'encart se masque seul).
 */
export function resolveMinimapTile(world: MinimapWorld, gx: number, gy: number, z: number = MINIMAP_ZOOM): MinimapTile | null {
    if (!Number.isFinite(gx) || !Number.isFinite(gy)) return null;
    const { scale, bank } = resolveTileBank(world.zoom?.length ? world.zoom : [1], z);
    const tileSize = world.id === 1 ? 256 : 250;
    const gridScale = parseFloat(scale.toFixed(4));
    if (!(gridScale > 0)) return null;

    const px = (world.origineX + gx * world.mapWidth + world.mapWidth / 2) * gridScale;
    const py = (world.origineY + gy * world.mapHeight + world.mapHeight / 2) * gridScale;
    const cols = Math.ceil((world.totalWidth * gridScale) / tileSize);
    const rows = Math.ceil((world.totalHeight * gridScale) / tileSize);
    const tx = Math.floor(px / tileSize);
    const ty = Math.floor(py / tileSize);
    if (tx < 0 || tx >= cols || ty < 0 || ty >= rows) return null;

    return {
        tileUrl: `/game-data/tiles/w${world.id}/${bank}/${ty * cols + tx + 1}.webp`,
        leftPct: ((px - tx * tileSize) / tileSize) * 100,
        topPct: ((py - ty * tileSize) / tileSize) * 100,
        mapHref: `/carte-du-monde?play=1&x=${gx}&y=${gy}&zoom=${z}&world=${world.id}`,
    };
}

/**
 * Grille centrée sur le donjon (défaut 3×3, paysage 5×3 pour l'encart) : le
 * repère est TOUJOURS dans la tuile centrale (jamais coupé au bord). Les
 * tuiles hors grille deviennent un fond océan. `null` si la tuile centrale
 * est hors grille.
 */
export function resolveMinimapGrid(
    world: MinimapWorld,
    gx: number,
    gy: number,
    z: number = MINIMAP_ZOOM,
    radiusX: number = MINIMAP_GRID_RADIUS,
    radiusY: number = MINIMAP_GRID_RADIUS
): MinimapGrid | null {
    if (!Number.isFinite(gx) || !Number.isFinite(gy)) return null;
    const { scale, bank } = resolveTileBank(world.zoom?.length ? world.zoom : [1], z);
    const tileSize = world.id === 1 ? 256 : 250;
    const gridScale = parseFloat(scale.toFixed(4));
    if (!(gridScale > 0)) return null;

    const px = (world.origineX + gx * world.mapWidth + world.mapWidth / 2) * gridScale;
    const py = (world.origineY + gy * world.mapHeight + world.mapHeight / 2) * gridScale;
    const cols = Math.ceil((world.totalWidth * gridScale) / tileSize);
    const rows = Math.ceil((world.totalHeight * gridScale) / tileSize);
    const centerTx = Math.floor(px / tileSize);
    const centerTy = Math.floor(py / tileSize);
    if (centerTx < 0 || centerTx >= cols || centerTy < 0 || centerTy >= rows) return null;

    const rx = Math.max(0, Math.floor(radiusX));
    const ry = Math.max(0, Math.floor(radiusY));
    const tiles: MinimapGridTile[] = [];
    for (let row = 0; row < ry * 2 + 1; row++) {
        for (let col = 0; col < rx * 2 + 1; col++) {
            const tx = centerTx + col - rx;
            const ty = centerTy + row - ry;
            tiles.push({
                tileUrl:
                    tx < 0 || tx >= cols || ty < 0 || ty >= rows
                        ? null
                        : `/game-data/tiles/w${world.id}/${bank}/${ty * cols + tx + 1}.webp`,
                col,
                row,
            });
        }
    }
    const markerXPx = px - (centerTx - rx) * tileSize;
    const markerYPx = py - (centerTy - ry) * tileSize;
    return {
        tiles,
        cols: rx * 2 + 1,
        rows: ry * 2 + 1,
        leftPct: (markerXPx / ((rx * 2 + 1) * tileSize)) * 100,
        topPct: (markerYPx / ((ry * 2 + 1) * tileSize)) * 100,
        mapHref: `/carte-du-monde?play=1&x=${gx}&y=${gy}&zoom=${z}&world=${world.id}`,
    };
}

/** Grille paysage de l'encart (5×3) : même centre, plus de contexte horizontal. */
export function resolveMinimapLandscape(
    world: MinimapWorld,
    gx: number,
    gy: number,
    z: number = MINIMAP_ZOOM
): MinimapGrid | null {
    return resolveMinimapGrid(world, gx, gy, z, 2, 1);
}
