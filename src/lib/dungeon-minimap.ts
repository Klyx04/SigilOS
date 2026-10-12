/**
 * Encart statique « où est le donjon » — UNE tuile Leaflet en <img>, sans Leaflet.
 *
 * Reprend EXACTEMENT la formule du renderer (`leaflet-map-core.tsx` :
 * `SigilTilesLayer.getTileUrl` + position des marqueurs) pour que la tuile et
 * le repère coïncident avec la carte interactive :
 * - pixels échelle 1 : `px = origineX + gx*mapWidth + mapWidth/2`
 * - banque/échelle via `resolveTileBank`, grille TOUJOURS au `ceil` sur échelle
 *   snappée, `index = ty*cols + tx + 1`, tuile `WORLDMAP_TILE_SIZE` (250 px).
 */
import { resolveTileBank, WORLDMAP_TILE_SIZE } from "./worldmap-tiles";

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
    /**
     * URL publique de la tuile. Jamais `null` : la fenêtre est **rognée dans la
     * grille du monde** (une tuile hors grille n'existe pas — un 404 affichait
     * un aplat « océan » en plein milieu de l'encart).
     */
    tileUrl: string;
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
    const tileSize = WORLDMAP_TILE_SIZE;
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
 * repère est TOUJOURS dans la fenêtre, jamais coupé au bord.
 *
 * La fenêtre est **rognée dans la grille du monde** (elle glisse vers
 * l'intérieur au lieu de déborder) et **rétrécit** si la grille est plus petite
 * qu'elle (ex. monde 36 : 4×4 tuiles). Aucune tuile demandée n'est donc hors
 * grille. C'était un défaut visible : mesuré le 11/10/2026, **21 donjons sur
 * 109** (sur **12 mondes**) affichaient un bandeau océan — ex. « Sousouricière
 * du Rat Noir » (monde 9, grille 6×5, centre en colonne 0) : 6 des 15 tuiles
 * hors grille, soit tout le tiers droit en aplat vert. `null` si la tuile
 * centrale du donjon est elle-même hors grille.
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
    const tileSize = WORLDMAP_TILE_SIZE;
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
    // Fenêtre réellement servie : bornée par la grille du monde, puis glissée
    // vers l'intérieur (le donjon reste visible, simplement plus centré).
    const windowCols = Math.min(rx * 2 + 1, cols);
    const windowRows = Math.min(ry * 2 + 1, rows);
    const startTx = Math.min(Math.max(centerTx - rx, 0), cols - windowCols);
    const startTy = Math.min(Math.max(centerTy - ry, 0), rows - windowRows);

    const tiles: MinimapGridTile[] = [];
    for (let row = 0; row < windowRows; row++) {
        for (let col = 0; col < windowCols; col++) {
            const tx = startTx + col;
            const ty = startTy + row;
            tiles.push({
                tileUrl: `/game-data/tiles/w${world.id}/${bank}/${ty * cols + tx + 1}.webp`,
                col,
                row,
            });
        }
    }
    const markerXPx = px - startTx * tileSize;
    const markerYPx = py - startTy * tileSize;
    return {
        tiles,
        cols: windowCols,
        rows: windowRows,
        leftPct: (markerXPx / (windowCols * tileSize)) * 100,
        topPct: (markerYPx / (windowRows * tileSize)) * 100,
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
