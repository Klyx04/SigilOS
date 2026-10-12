/**
 * Encart statique « où est cette zone » — tuiles <img> + polygone vectoriel,
 * SANS Leaflet (mêmes formules que le renderer `leaflet-map-core.tsx`).
 *
 * Source de vérité de la géométrie de zone : `subareas[].shape` de
 * `worldmap.json` — exactement le tracé utilisé par le bouton « Zones » de la
 * carte (`zoneHighlight`).
 *
 * ⚠️ **Deux espaces de coordonnées**, à ne jamais confondre :
 * - un **sommet de tracé** est un **coin de case** : il tombe au pixel
 *   `(origineX + gx*mapWidth) * scale` — c'est la formule du renderer monde
 *   (`toCP`, `ox + gx*mw`), donc le contour se superpose exactement au bouton
 *   « Zones » ;
 * - une **position de map** est un **indice de case** : son centre est au coin
 *   plus une demi-case, `(origineX + gx*mapWidth + mapWidth/2) * scale`
 *   (formule des marqueurs, `resolveMinimapTile`).
 * Ajouter `mapWidth/2` à un sommet (bug corrigé le 11/10/2026) décalait tout
 * l'encart d'une demi-tuile en X et en Y — mesuré : sous-zone 883 « Nimotopia »,
 * tracé borné x [-68, -61] / y [28, 35] contre maps x [-68, -62] / y [28, 34]
 * (un tracé vaut toujours la boîte des maps **plus une case**).
 *
 * Le cadrage choisit automatiquement l'échelle : la plus zoomée où la zone
 * tient dans `maxCols × maxRows` tuiles, sinon la moins zoomée (le tracé est
 * alors rogné par le conteneur — jamais déformé : la fenêtre reste carrée).
 */
import { hasKnownGameCoords, resolveTileBank, WORLDMAP_TILE_SIZE } from "./worldmap-tiles";
import type { MinimapWorld } from "./dungeon-minimap";

/** Un point en coordonnées de jeu (indice de case). */
export interface ZonePoint {
    x: number;
    y: number;
}

export interface ZoneBounds {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
}

export interface ZoneShapeFrame {
    /** Tracé officiel : un ou plusieurs polygones (coordonnées de jeu). */
    polygons: ZonePoint[][];
    bounds: ZoneBounds;
    /** Centre de l'icône : centroïde du plus grand polygone. */
    /** Le plus fourni des polygones (contour principal) — emprise du libellé de zone. */
    main: ZonePoint[];

    focus: ZonePoint;
}

export interface ZoneMinimapTile {
    tileUrl: string | null;
    col: number;
    row: number;
}

export interface ZoneMinimap {
    cols: number;
    rows: number;
    tiles: ZoneMinimapTile[];
    /** Tracé en pixels de la fenêtre, prêt pour `<polygon points>`. */
    polygons: string[];
    widthPx: number;
    heightPx: number;
    /** Position de l'icône en % de la fenêtre. */
    focusLeftPct: number;
    focusTopPct: number;
    /** Échelle Leaflet retenue (négative, cf. `resolveTileBank`). */
    zoom: number;
    worldId: number;
    mapHref: string;
}

export interface ZoneMinimapOptions {
    maxCols?: number;
    maxRows?: number;
    /** Marge autour de la zone, en tuiles (0.5 de chaque côté par défaut). */
    marginTiles?: number;
    /** Index d'échelle minimal (0 = la plus zoomée du monde). */
    minScaleIndex?: number;
    /** Centre de repli quand la zone n'a pas de tracé exploitable. */
    fallbackCenter?: ZonePoint | null;
    /** Sous-zones à activer à l'ouverture de la carte (calque « Zones » du lien profond). */
    zoneIds?: number[] | null;
}

export const ZONE_MINIMAP_MAX_COLS = 5;
export const ZONE_MINIMAP_MAX_ROWS = 3;
export const ZONE_MINIMAP_MARGIN_TILES = 1;

/** Au-delà, une valeur du tracé est un en-tête de fichier (cf. renderer). */
const SHAPE_HEADER_THRESHOLD = 1000;

/**
 * Lit le tracé `shape` d'une sous-zone : paires (gx, gy), les valeurs de tête
 * (> 1000 en absolu) séparant deux polygones. Retourne `null` si aucun
 * polygone exploitable (< 3 points).
 */
export function parseZoneShape(shape: unknown): ZoneShapeFrame | null {
    if (!Array.isArray(shape) || shape.length < 6) return null;

    const polygons: ZonePoint[][] = [];
    let current: ZonePoint[] = [];

    const flush = () => {
        if (current.length >= 3) polygons.push(current);
        current = [];
    };

    for (let i = 0; i + 1 < shape.length; i += 2) {
        const gx = Number(shape[i]);
        const gy = Number(shape[i + 1]);
        if (!Number.isFinite(gx) || !Number.isFinite(gy)) {
            flush();
            continue;
        }
        if (Math.abs(gx) > SHAPE_HEADER_THRESHOLD || Math.abs(gy) > SHAPE_HEADER_THRESHOLD) {
            flush();
            continue;
        }
        current.push({ x: gx, y: gy });
    }
    flush();
    if (polygons.length === 0) return null;

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const polygon of polygons) {
        for (const point of polygon) {
            if (point.x < minX) minX = point.x;
            if (point.x > maxX) maxX = point.x;
            if (point.y < minY) minY = point.y;
            if (point.y > maxY) maxY = point.y;
        }
    }

    // Icône : centroïde du polygone le plus fourni (le contour principal).
    const main = polygons.reduce((best, p) => (p.length > best.length ? p : best), polygons[0]);
    const focus = {
        x: main.reduce((sum, p) => sum + p.x, 0) / main.length,
        y: main.reduce((sum, p) => sum + p.y, 0) / main.length,
    };

    return { polygons, bounds: { minX, maxX, minY, maxY }, focus, main };
}

/**
 * Un tracé **sentinelle** de `worldmap.json` : le petit carré 1×1 collé à
 * l'origine. Mesuré : 9 sous-zones (`Songes Infinis`, `Destin du Monde`,
 * `Ankama`, `Dofus Games`…) — des lieux qui n'existent sur aucune carte du
 * monde, dont *toutes* les maps sont aussi en (0, 0). Leur centroïde vaut (0, 0)
 * et ne doit donc jamais devenir le centre d'une cible.
 */
export function isPlaceholderZoneShape(frame: ZoneShapeFrame | null): boolean {
    if (!frame) return true;
    const { bounds } = frame;
    return bounds.minX === 0 && bounds.minY === 0 && bounds.maxX === 1 && bounds.maxY === 1;
}

/** Position retenue pour une cible (avis, archimonstre) : centre + monde. */
export interface SubAreaCenter {
    x: number;
    y: number;
    /** Sous-zone retenue — la première exploitable de la liste fournie. */
    subAreaId: number;
    /** `shape` = centroïde du tracé officiel ; `map` = repli sur une map positionnée. */
    source: "shape" | "map";
    /** Monde de la sous-zone (`worldMap` de sa map), 1 par défaut. */
    worldId: number;
}

/**
 * Centre de la **première** sous-zone exploitable d'une cible : centroïde de son
 * tracé officiel (`subareas[].shape` — exactement la géométrie du contour
 * affiché), sinon repli sur sa première map réellement positionnée. Le couple
 * (0, 0) étant le tas des maps sans coordonnées connues, il n'est **jamais** un
 * centre (cf. `hasKnownGameCoords`). `null` si ni tracé ni map ne répond.
 *
 * Règle **unique** de position d'une cible : le recentrage, l'icône clignotante
 * et l'encart tombent ainsi *dans* le contour, au lieu d'un point de map parfois
 * hors zone — et jamais sur la position sentinelle (0, 0).
 */
export function resolveSubAreaCenter(
    subAreaIds: number[] | null | undefined,
    subareas: Array<{ id: number; shape?: unknown }> | null | undefined,
    mapsBySubAreaId: Map<number, Array<{ x?: number | null; y?: number | null; worldMap?: number | null }>> | null | undefined
): SubAreaCenter | null {
    const ids = (subAreaIds ?? []).filter((id) => Number.isInteger(id) && id > 0);
    if (ids.length === 0) return null;

    const byId = new Map<number, { id: number; shape?: unknown }>();
    for (const subarea of subareas ?? []) byId.set(subarea.id, subarea);

    const worldIdOf = (subAreaId: number): number => {
        const map = (mapsBySubAreaId?.get(subAreaId) ?? []).find(hasKnownGameCoords);
        const world = map?.worldMap;
        return typeof world === "number" && world > 0 ? world : 1;
    };

    // 1. Tracé officiel : le centroïde tombe dans la zone, comme le contour.
    for (const id of ids) {
        const frame = parseZoneShape(byId.get(id)?.shape);
        if (isPlaceholderZoneShape(frame)) continue;
        return {
            x: Math.round(frame!.focus.x),
            y: Math.round(frame!.focus.y),
            subAreaId: id,
            source: "shape",
            worldId: worldIdOf(id),
        };
    }

    // 2. Repli : première map positionnée (jamais le tas (0, 0)).
    for (const id of ids) {
        const map = (mapsBySubAreaId?.get(id) ?? []).find(hasKnownGameCoords);
        if (!map) continue;
        return {
            x: Math.round(map.x as number),
            y: Math.round(map.y as number),
            subAreaId: id,
            source: "map",
            worldId: worldIdOf(id),
        };
    }

    return null;
}

/**
 * Calcule l'encart statique d'une zone : fenêtre de tuiles alignée sur la
 * grille, tracé et icône exprimés dans les coordonnées de cette fenêtre.
 * `null` si la zone n'a ni tracé ni centre de repli.
 */
export function resolveZoneMinimap(
    world: MinimapWorld,
    shape: unknown,
    options: ZoneMinimapOptions = {}
): ZoneMinimap | null {
    if (!world || !Number.isFinite(world.origineX) || !Number.isFinite(world.origineY)) return null;

    const frame = parseZoneShape(shape);
    const fallback = options.fallbackCenter ?? null;
    if (!frame && !fallback) return null;

    const maxCols = Math.max(1, options.maxCols ?? ZONE_MINIMAP_MAX_COLS);
    const maxRows = Math.max(1, options.maxRows ?? ZONE_MINIMAP_MAX_ROWS);
    const marginTiles = Math.max(0, options.marginTiles ?? ZONE_MINIMAP_MARGIN_TILES);
    const minScaleIndex = Math.max(0, options.minScaleIndex ?? 1);
    const zoneIds = (options.zoneIds ?? []).filter((id) => Number.isInteger(id) && id > 0);

    const scales = Array.isArray(world.zoom) && world.zoom.length > 0 ? world.zoom : [1];
    const tileSize = WORLDMAP_TILE_SIZE;
    const lastIndex = scales.length - 1;

    const bounds: ZoneBounds = frame
        ? frame.bounds
        : {
            minX: fallback!.x - 1,
            maxX: fallback!.x + 1,
            minY: fallback!.y - 1,
            maxY: fallback!.y + 1,
        };
    const centerGame: ZonePoint = frame
        ? { x: (bounds.minX + bounds.maxX) / 2, y: (bounds.minY + bounds.maxY) / 2 }
        : fallback!;

    const marginPx = marginTiles * tileSize;
    const spanX = bounds.maxX - bounds.minX + 1;
    const spanY = bounds.maxY - bounds.minY + 1;

    // Échelle la plus zoomée où la zone entière tient dans la fenêtre.
    let scaleIndex = lastIndex;
    for (let index = Math.min(minScaleIndex, lastIndex); index <= lastIndex; index++) {
        const candidateScale = scales[index];
        const candidateCols = Math.ceil((spanX * world.mapWidth * candidateScale + marginPx) / tileSize);
        const candidateRows = Math.ceil((spanY * world.mapHeight * candidateScale + marginPx) / tileSize);
        if (candidateCols <= maxCols && candidateRows <= maxRows) {
            scaleIndex = index;
            break;
        }
    }

    const { scale, bank } = resolveTileBank(scales, -scaleIndex);
    const gridScale = parseFloat(scale.toFixed(4));
    if (!(gridScale > 0)) return null;

    // Sommet de tracé = **coin** de case : même formule que le renderer monde.
    const vertexToPixelX = (gx: number) => (world.origineX + gx * world.mapWidth) * gridScale;
    const vertexToPixelY = (gy: number) => (world.origineY + gy * world.mapHeight) * gridScale;
    // Position de **map** = indice de case : son centre est une demi-case plus loin.
    const cellToPixelX = (gx: number) => (world.origineX + gx * world.mapWidth + world.mapWidth / 2) * gridScale;
    const cellToPixelY = (gy: number) => (world.origineY + gy * world.mapHeight + world.mapHeight / 2) * gridScale;
    // `centerGame`/`focus` vivent dans l'espace des sommets s'il y a un tracé, des cases sinon.
    const centerToPixelX = frame ? vertexToPixelX : cellToPixelX;
    const centerToPixelY = frame ? vertexToPixelY : cellToPixelY;

    const totalCols = Math.ceil((world.totalWidth * gridScale) / tileSize);
    const totalRows = Math.ceil((world.totalHeight * gridScale) / tileSize);

    const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
    const cols = clamp(Math.ceil((spanX * world.mapWidth * gridScale + marginPx) / tileSize), 1, maxCols);
    const rows = clamp(Math.ceil((spanY * world.mapHeight * gridScale + marginPx) / tileSize), 1, maxRows);

    const tx0 = clamp(Math.round((centerToPixelX(centerGame.x) - (cols * tileSize) / 2) / tileSize), 0, Math.max(0, totalCols - cols));
    const ty0 = clamp(Math.round((centerToPixelY(centerGame.y) - (rows * tileSize) / 2) / tileSize), 0, Math.max(0, totalRows - rows));

    const windowLeft = tx0 * tileSize;
    const windowTop = ty0 * tileSize;
    const widthPx = cols * tileSize;
    const heightPx = rows * tileSize;

    const tiles: ZoneMinimapTile[] = [];
    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            const tx = tx0 + col;
            const ty = ty0 + row;
            tiles.push({
                tileUrl:
                    tx < 0 || tx >= totalCols || ty < 0 || ty >= totalRows
                        ? null
                        : `/game-data/tiles/w${world.id}/${bank}/${ty * totalCols + tx + 1}.webp`,
                col,
                row,
            });
        }
    }

    const round = (value: number) => Math.round(value * 10) / 10;
    const polygons = (frame?.polygons ?? []).map((polygon) =>
        polygon
            .map((point) => `${round(vertexToPixelX(point.x) - windowLeft)},${round(vertexToPixelY(point.y) - windowTop)}`)
            .join(" ")
    );

    const focus = frame ? frame.focus : fallback!;
    // Le centroïde d'une zone en L peut tomber au bord de la fenêtre : l'icône
    // est ramenée dans les 3-97 % pour rester entièrement visible.
    const clampPct = (value: number) => Math.max(3, Math.min(97, value));

    // Cellule visée par le lien profond : un **sommet** (coin) appartient à la
    // cellule du coin (floor) ; une position de map est déjà un indice (round).
    const centerCellX = frame ? Math.floor(centerGame.x) : Math.round(centerGame.x);
    const centerCellY = frame ? Math.floor(centerGame.y) : Math.round(centerGame.y);
    const zoneQuery = zoneIds.length > 0 ? `&zone=${zoneIds.join(",")}` : "";

    return {
        cols,
        rows,
        tiles,
        polygons,
        widthPx,
        heightPx,
        focusLeftPct: clampPct(((centerToPixelX(focus.x) - windowLeft) / widthPx) * 100),
        focusTopPct: clampPct(((centerToPixelY(focus.y) - windowTop) / heightPx) * 100),
        zoom: -scaleIndex,
        worldId: world.id,
        mapHref: `/carte-du-monde?play=1&x=${centerCellX}&y=${centerCellY}&zoom=${-scaleIndex}&world=${world.id}${zoneQuery}`,
    };
}
