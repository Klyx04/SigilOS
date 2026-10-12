export interface LocalizedString {
    id: string;
    de: string;
    en: string;
    es: string;
    fr: string;
    pt: string;
}

export interface WorldData {
    worlds: WorldInfo[];
    subareas: SubArea[];
    dungeons: Dungeon[];
    maps: MapNode[];
    /**
     * Noms de zones dont le libellé (nom + niveau) ne doit pas être dessiné — liste tenue à la
     * main depuis God (`/game-data/hidden-map-zones.json`, cf. `map-viewer`). Optionnel : sans
     * ce fichier, tous les libellés de zone s'affichent comme avant.
     */
    hiddenZoneLabels?: string[];
}

export interface WorldInfo {
    id: number;
    name: LocalizedString;
    totalWidth: number;
    totalHeight: number;
    mapWidth: number;
    mapHeight: number;
    origineX: number;
    origineY: number;
    zoom: number[];
}

export interface SubArea {
    id: number;
    name: LocalizedString;
    areaId: number;
    level: number;
}

export interface Dungeon {
    id: number;
    name: LocalizedString;
    mapId: number;
    entranceMapId?: number;
    optimalPlayerLevel?: number;
}

export interface MapNode {
    id: number;
    x: number;
    y: number;
    subAreaId: number;
    worldMap: number;
    outdoor: boolean;
    altitude?: number;
}
