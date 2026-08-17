'use client';

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import { useMap } from 'react-leaflet';

/**
 * MapHDOverlay — Vue HD des maps à fort zoom (façon DofusDB) généralisée à TOUS les mondes.
 *
 * Quand on zoome au-delà de l'échelle native (zoom >= 1) :
 * 1. On masque les tuiles génériques du monde (floues en upscale).
 * 2. On charge dynamiquement uniquement les maps HD visibles dans le viewport (`map.getBounds()`).
 * 3. Les maps hors champ sont automatiquement déchargées pour préserver la mémoire et les performances.
 */
export function MapHDOverlay({ activeWorld, mapsByCoords, selectedWorldId }: any) {
    const map = useMap();
    const groupRef = useRef<L.LayerGroup | null>(null);
    const activeOverlaysRef = useRef<Map<string, L.ImageOverlay>>(new Map());

    useEffect(() => {
        if (!activeWorld || !mapsByCoords) return;

        const mw = activeWorld.mapWidth;
        const mh = activeWorld.mapHeight;
        const ox = activeWorld.origineX;
        const oy = activeWorld.origineY;

        const group = new L.LayerGroup();
        group.addTo(map);
        groupRef.current = group;

        const updateOverlays = () => {
            const z = map.getZoom();
            const showHD = z >= 1;
            const tilePane = (map as any).getPane('tilePane');

            if (!showHD) {
                if (tilePane) tilePane.style.opacity = '1';
                group.clearLayers();
                activeOverlaysRef.current.clear();
                return;
            }

            if (tilePane) tilePane.style.opacity = '0';

            const bounds = map.getBounds();
            const minGx = Math.floor((bounds.getWest() - ox) / mw) - 1;
            const maxGx = Math.ceil((bounds.getEast() - ox) / mw) + 1;
            const minGy = Math.floor((-bounds.getNorth() - oy) / mh) - 1;
            const maxGy = Math.ceil((-bounds.getSouth() - oy) / mh) + 1;

            // Sécurité : borner la zone pour éviter les surcharges
            const spanX = Math.min(maxGx - minGx, 25);
            const spanY = Math.min(maxGy - minGy, 25);
            const clampedMaxGx = minGx + spanX;
            const clampedMaxGy = minGy + spanY;

            const currentVisibleKeys = new Set<string>();

            for (let gx = minGx; gx <= clampedMaxGx; gx++) {
                for (let gy = minGy; gy <= clampedMaxGy; gy++) {
                    const key = `${gx},${gy}`;
                    currentVisibleKeys.add(key);

                    if (activeOverlaysRef.current.has(key)) continue;

                    const m = mapsByCoords.get(key);
                    if (!m) continue;
                    if (m.worldMap !== selectedWorldId && !(selectedWorldId === 1 && m.worldMap === -1)) continue;
                    if (m.x === 0 && m.y === 0) continue; // Exclure intérieurs non positionnés

                    const south = -(oy + (gy + 1) * mh);
                    const west = ox + gx * mw;
                    const north = -(oy + gy * mh);
                    const east = ox + (gx + 1) * mw;

                    const overlay = L.imageOverlay(`/game-data/hd_maps/${m.id}.webp`, [[south, west], [north, east]], {
                        interactive: false,
                        className: 'sigil-hd-map',
                    });

                    overlay.addTo(group);
                    activeOverlaysRef.current.set(key, overlay);
                }
            }

            // Décharger les tuiles sorties du champ de vision
            activeOverlaysRef.current.forEach((overlay, key) => {
                if (!currentVisibleKeys.has(key)) {
                    group.removeLayer(overlay);
                    activeOverlaysRef.current.delete(key);
                }
            });
        };

        map.on('zoomend', updateOverlays);
        map.on('moveend', updateOverlays);
        updateOverlays();

        return () => {
            map.off('zoomend', updateOverlays);
            map.off('moveend', updateOverlays);
            map.removeLayer(group);
            const tilePane = (map as any).getPane('tilePane');
            if (tilePane) tilePane.style.opacity = '1';
            activeOverlaysRef.current.clear();
            groupRef.current = null;
        };
    }, [map, activeWorld, mapsByCoords, selectedWorldId]);

    return null;
}
