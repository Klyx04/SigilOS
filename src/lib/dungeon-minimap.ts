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

/** Zoom Leaflet de l'encart : même cadrage que le deep-link historique (-2). */
export const MINIMAP_ZOOM = -2;

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
