import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import type { MinimapWorld } from '@/lib/dungeon-minimap';

/**
 * Géométrie des zones pour les encarts « Localisation » (fiches de boss, avis
 * de recherche, éditeurs admin) — le `worldmap.json` (1,5 Mo) est lu une fois
 * par process, le client ne reçoit que les zones demandées (~2 Ko).
 *
 * Cibles acceptées (cumulables) :
 * - `?zone=1,2` : sous-zones par identifiant (avis de recherche) ;
 * - `?map=1234`  : map du jeu → sa sous-zone (donjon, carte précise) ;
 * - `?world=1`   : monde (défaut 1, le monde des avis de recherche).
 */
export const dynamic = 'force-dynamic';

interface ZoneRow {
    id: number;
    name: string;
    areaId: number | null;
    shape: number[] | null;
}

interface MapRow {
    id: number;
    subAreaId: number | null;
    worldMap: number | null;
}

interface RawZone { id?: unknown; name?: unknown; areaId?: unknown; shape?: unknown }
interface RawMapEntry { id?: unknown; subAreaId?: unknown; worldMap?: unknown }
interface RawWorld {
    id?: unknown; origineX?: unknown; origineY?: unknown; mapWidth?: unknown; mapHeight?: unknown;
    totalWidth?: unknown; totalHeight?: unknown; zoom?: unknown;
}
interface RawWorldmap { subareas?: RawZone[]; maps?: RawMapEntry[] }

const asInt = (value: unknown): number | null => {
    const num = Number(value);
    return Number.isInteger(num) ? num : null;
};

let cache: { zones: Map<number, ZoneRow>; maps: Map<number, MapRow>; worlds: MinimapWorld[] } | null = null;

function loadWorldmap() {
    if (cache) return cache;

    const zones = new Map<number, ZoneRow>();
    const maps = new Map<number, MapRow>();
    let worlds: MinimapWorld[] = [];

    const readJson = <T,>(file: string): T | null => {
        const filePath = path.join(process.cwd(), 'public', 'game-data', file);
        return fs.existsSync(filePath) ? (JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T) : null;
    };

    const worldmap = readJson<RawWorldmap>('worldmap.json');
    if (Array.isArray(worldmap?.subareas)) {
        for (const zone of worldmap.subareas) {
            const id = asInt(zone?.id);
            if (id === null) continue;
            zones.set(id, {
                id,
                name: typeof zone.name === 'string' ? zone.name : '',
                areaId: asInt(zone.areaId),
                shape: Array.isArray(zone.shape) ? (zone.shape as number[]) : null,
            });
        }
    }
    if (Array.isArray(worldmap?.maps)) {
        for (const map of worldmap.maps) {
            const id = asInt(map?.id);
            if (id === null) continue;
            maps.set(id, { id, subAreaId: asInt(map.subAreaId), worldMap: asInt(map.worldMap) });
        }
    }

    const worldsRaw = readJson<RawWorld[]>('worlds.json');
    if (Array.isArray(worldsRaw)) {
        worlds = worldsRaw
            .filter((w) => asInt(w?.id) !== null && Number.isFinite(Number(w?.mapWidth)) && Number.isFinite(Number(w?.mapHeight)))
            .map((w) => ({
                id: asInt(w.id) as number,
                origineX: Number(w.origineX) || 0,
                origineY: Number(w.origineY) || 0,
                mapWidth: Number(w.mapWidth) || 0,
                mapHeight: Number(w.mapHeight) || 0,
                totalWidth: Number(w.totalWidth) || 0,
                totalHeight: Number(w.totalHeight) || 0,
                zoom: Array.isArray(w.zoom) && w.zoom.length > 0 ? (w.zoom as unknown[]).map(Number) : [1],
            }));
    }

    cache = { zones, maps, worlds };
    return cache;
}

export async function GET(req: NextRequest) {
    try {
        const params = req.nextUrl.searchParams;
        const requestedWorld = Number(params.get('world'));
        const worldId = Number.isInteger(requestedWorld) && requestedWorld > 0 ? requestedWorld : 1;

        const { zones, maps, worlds } = loadWorldmap();
        const world = worlds.find((w) => w.id === worldId);
        if (!world) {
            return NextResponse.json({ success: false, error: 'Monde inconnu' }, { status: 404 });
        }

        const wanted = new Set<number>();
        for (const raw of (params.get('zone') ?? '').split(',')) {
            const id = Number(raw);
            if (Number.isInteger(id) && id > 0) wanted.add(id);
        }
        const mapIds = (params.get('map') ?? '').split(',').map(Number).filter((id) => Number.isInteger(id) && id > 0);
        let mapWorldId: number | null = null;
        for (const mapId of mapIds) {
            const map = maps.get(mapId);
            if (map?.subAreaId) wanted.add(map.subAreaId);
            if (map?.worldMap && map.worldMap > 0) mapWorldId = map.worldMap;
        }
        if (wanted.size === 0) {
            return NextResponse.json({ success: false, error: 'Aucune zone demandée' }, { status: 400 });
        }

        const payload = [...wanted]
            .map((id) => zones.get(id))
            .filter((zone): zone is ZoneRow => !!zone)
            .map((zone) => ({ id: zone.id, name: zone.name, shape: zone.shape }));

        return NextResponse.json(
            { success: true, data: { world, zones: payload, mapWorldId } },
            { headers: { 'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800' } }
        );
    } catch {
        return NextResponse.json({ success: false, error: 'Erreur serveur' }, { status: 500 });
    }
}
