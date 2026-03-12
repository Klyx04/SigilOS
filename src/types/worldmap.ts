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
}
