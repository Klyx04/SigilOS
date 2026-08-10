'use client';

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import { useMap } from 'react-leaflet';

/**
 * MapHDOverlay — POC « vue HD des maps à fort zoom » (façon DofusDB).
 *
 * Sur le monde 38 (Village des Brigandins), quand on zoome au-delà de l'échelle
 * native (zoom >= 1), on masque les tuiles du monde (floues en upscale) et on
 * affiche les maps HD individuelles (`/game-data/hd_maps/{id}.webp`) à leur
 * position, recadrées via `object-fit: cover`.
 *
 * Limité au monde 38 pour l'instant (peu de maps). À généraliser plus tard.
 */
export function MapHDOverlay({ activeWorld, mapsByCoords, selectedWorldId }: any) {
    const map = useMap();
    const groupRef = useRef<L.LayerGroup | null>(null);

    useEffect(() => {
        if (!activeWorld) return;
        // POC : uniquement le monde 38 (Village des Brigandins)
        if (selectedWorldId !== 38) return;

        const mw = activeWorld.mapWidth;
        const mh = activeWorld.mapHeight;
        const ox = activeWorld.origineX;
        const oy = activeWorld.origineY;

        const group = new L.LayerGroup();

        // 1. Maps du monde 38 avec une position réelle (x/y != 0)
        const positioned: any[] = [];
        mapsByCoords?.forEach((m: any) => {
            if (!m || m.worldMap !== selectedWorldId) return;
            if (m.x === undefined || m.y === undefined) return;
            if (m.x === 0 && m.y === 0) return; // exclut les donjons/indoor à (0,0)
            positioned.push(m);
        });

        // 2. Déduplique par cellule (x,y) — garde la 1ère map de chaque cellule
        const seen = new Set<string>();
        for (const m of positioned) {
            const key = `${m.x},${m.y}`;
            if (seen.has(key)) continue;
            seen.add(key);

            const gx = m.x;
            const gy = m.y;
            const south = -(oy + (gy + 1) * mh);
            const west = ox + gx * mw;
            const north = -(oy + gy * mh);
            const east = ox + (gx + 1) * mw;

            L.imageOverlay(`/game-data/hd_maps/${m.id}.webp`, [[south, west], [north, east]], {
                interactive: false,
                className: 'sigil-hd-map',
            }).addTo(group);
        }

        if (group.getLayers().length === 0) return;
        group.addTo(map);
        groupRef.current = group;

        const onZoom = () => {
            const z = map.getZoom();
            const show = z >= 1;
            const tilePane = (map as any).getPane('tilePane');
            if (tilePane) tilePane.style.opacity = show ? '0' : '1';
            group.eachLayer((l: any) => {
                if (typeof l.setOpacity === 'function') l.setOpacity(show ? 1 : 0);
            });
        };
        map.on('zoomend', onZoom);
        onZoom();

        return () => {
            map.off('zoomend', onZoom);
            map.removeLayer(group);
            const tilePane = (map as any).getPane('tilePane');
            if (tilePane) tilePane.style.opacity = '1';
            groupRef.current = null;
        };
    }, [map, activeWorld, mapsByCoords, selectedWorldId]);

    return null;
}
