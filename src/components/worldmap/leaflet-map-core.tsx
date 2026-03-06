'use client';

import React, { useEffect, useState, useMemo, useRef } from 'react';
import { MapContainer, ImageOverlay, Rectangle, Marker, Tooltip, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// -------------------------------------------------------------------------------------
// FIX DE CHARGEMENT : Utilisation des différentes tailles de carte au lieu de charger
// les fichiers UHD en continu.
// -------------------------------------------------------------------------------------
// On crée un CRS (Coordinate Reference System) sur mesure qui mappe les zooms natifs 
// de Leaflet sur les échelles (banks) existantes de l'API Dofus (1, 0.8, 0.6...).
const getActiveWorld = () => (typeof window !== 'undefined' ? (window as any)._activeWorld_for_crs : null);

const sigilCRS = L.extend({}, L.CRS.Simple, {
    scale: function (zoom: number) {
        const w = getActiveWorld();
        const scales = w?.zoom || [1];
        if (zoom > 0) return Math.pow(2, zoom);
        // Map -z to Dofus zoom array scale index
        const idx = -Math.round(zoom);
        if (idx >= 0 && idx < scales.length) return scales[idx];
        return scales[scales.length - 1] * Math.pow(2, zoom + (scales.length - 1));
    },
    zoom: function (scale: number) {
        const w = getActiveWorld();
        const scales = w?.zoom || [1];
        if (scale > 1) return Math.log2(scale);
        for (let i = 0; i < scales.length; i++) {
            if (Math.abs(scales[i] - scale) < 0.01) return -i;
        }
        return Math.log2(scale / scales[scales.length - 1]) - (scales.length - 1);
    }
});

const CUSTOM_DUNGEON_OFFSETS: Record<number, { dx: number, dy: number }> = {};

function SigilTilesLayer({ activeWorld, selectedWorldId }: any) {
    const map = useMap();

    useEffect(() => {
        if (!activeWorld) return;
        const cols = Math.ceil(activeWorld.totalWidth / 256);
        const rows = Math.ceil(activeWorld.totalHeight / 256);

        const customTileLayer = L.TileLayer.extend({
            getTileUrl: function (coords: any) {
                const z = coords.z;
                const scales = activeWorld.zoom || [1];
                const idx = -z;
                let scale = 1;
                let bank = '1';

                const cleanScale = (val: number) => parseFloat(val.toFixed(4)).toString();

                if (idx >= 0 && idx < scales.length) {
                    scale = scales[idx];
                    bank = scale === 1 ? '1' : cleanScale(scale);
                } else if (idx < 0) {
                    scale = 1;
                    bank = '1';
                } else {
                    scale = scales[scales.length - 1];
                    bank = cleanScale(scale);
                }

                // Correction critique : DofusDB segmente ses colonnes selon un diviseur de 250 pour les mondes instanciés
                const tileSize = selectedWorldId === 1 ? 256 : 250;
                const apiCols = Math.ceil((activeWorld.totalWidth * scale) / tileSize);
                if (coords.x < 0 || coords.x >= apiCols || coords.y < 0 || coords.y >= Math.ceil((activeWorld.totalHeight * scale) / tileSize)) {
                    return 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs='; // vide
                }
                const index = coords.y * apiCols + coords.x + 1;
                return `/game-data/tiles/w${selectedWorldId}/${bank}/${index}.webp`;
            }
        });

        const bounds: L.LatLngBoundsExpression = [[-activeWorld.totalHeight, 0], [0, activeWorld.totalWidth]];

        // Définir les limites de résolutions (Native Zooms) en fonction du monde
        const scales = activeWorld.zoom || [1];
        const minZ = -(scales.length - 1);

        // @ts-expect-error Leaflet extended classes don't inherit constructor typings properly
        const layer = new customTileLayer('', {
            tileSize: 256,
            minNativeZoom: minZ,
            maxNativeZoom: 0,
            minZoom: minZ - 1, // On permet de dézoomer un cran de plus même si c'est flou
            maxZoom: 3,
            noWrap: true,
            bounds: bounds,
            errorTileUrl: 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=',
            updateWhenIdle: true,
            keepBuffer: 3 // Garde plus de tuiles en mémoire pour le drag
        });

        map.addLayer(layer);
        map.setMaxBounds(bounds);

        return () => {
            map.removeLayer(layer);
            map.setMaxBounds(null as any);
        };
    }, [map, activeWorld, selectedWorldId]);

    return null;
}

// Suppression de HDMapOverlays pour de meilleures performances

function MapInteractionHandler({ activeWorld, mapsByCoords, subAreasById, dungeonsByMapId, setSelectedPosition, selectedWorldId }: any) {
    const map = useMap();
    const tooltipRef = useRef<L.Tooltip | null>(null);

    useMapEvents({
        mousemove: (e) => {
            if (!activeWorld) return;
            // Coordonnées Dofus
            const mapX = e.latlng.lng;
            const mapY = -e.latlng.lat;
            const gameX = Math.floor((mapX - activeWorld.origineX) / activeWorld.mapWidth);
            const gameY = Math.floor((mapY - activeWorld.origineY) / activeWorld.mapHeight);

            const displayX = gameX;
            const displayY = gameY;

            const foundMap = mapsByCoords.get(`${gameX},${gameY}`);
            const subAreaName = foundMap ? subAreasById.get(foundMap.subAreaId)?.name : null;
            const tooltipContent = `<div class="flex items-center gap-2"><span class="font-bold text-white">${subAreaName || 'Hors Map'}</span><span class="text-white/50 text-[10px] font-mono">[${displayX}, ${displayY}]</span></div>`;

            if (!tooltipRef.current) {
                tooltipRef.current = L.tooltip({
                    className: 'custom-leaflet-tooltip',
                    direction: 'right',
                    offset: [15, 15],
                    permanent: true,
                    opacity: 1
                }).setContent(tooltipContent).setLatLng(e.latlng).addTo(map);
            } else {
                tooltipRef.current.setLatLng(e.latlng).setContent(tooltipContent);
            }
        },
        mouseout: () => {
            if (tooltipRef.current) {
                map.removeLayer(tooltipRef.current);
                tooltipRef.current = null;
            }
        },
        click: (e) => {
            if (!activeWorld) return;
            const mapX = e.latlng.lng;
            const mapY = -e.latlng.lat;
            const gameX = Math.floor((mapX - activeWorld.origineX) / activeWorld.mapWidth);
            const gameY = Math.floor((mapY - activeWorld.origineY) / activeWorld.mapHeight);

            const displayX = gameX;
            const displayY = gameY;
            const foundMap = mapsByCoords.get(`${gameX},${gameY}`);

            setSelectedPosition({ x: gameX, y: gameY, displayX, displayY, mapId: foundMap?.id });
        }
    });

    return null;
}

function ExternalController({ triggerCenterPosition, activeWorld }: any) {
    const map = useMap();

    useEffect(() => {
        if (!triggerCenterPosition || !activeWorld) return;
        const px = activeWorld.origineX + triggerCenterPosition.x * activeWorld.mapWidth + activeWorld.mapWidth / 2;
        const py = activeWorld.origineY + triggerCenterPosition.y * activeWorld.mapHeight + activeWorld.mapHeight / 2;

        map.flyTo([-py, px], -1, { duration: 0.5 });
    }, [triggerCenterPosition, activeWorld, map]);

    return null;
}

export default function LeafletMapCore(props: any) {
    const {
        activeWorld, selectedWorldId, activeMaps, mapsByCoords, subAreasById,
        dungeonsByMapId, groupedDungeons, showDebugGrid, selectedPosition,
        setSelectedPosition, setSelectedDungeon, triggerCenterPosition
    } = props;

    // Calculate initial map bounds/center
    const initialCenter = useMemo(() => {
        if (!activeWorld || activeMaps.length === 0) return [0, 0] as [number, number];

        const hasMapsNearCenter = activeMaps.some((m: any) => Math.abs(m.x) < 5 && Math.abs(m.y) < 5);
        const mapsToCalculate = activeMaps.filter((m: any) => {
            if (m.x === 0 && m.y === 0) return activeMaps.length < 5 || hasMapsNearCenter;
            return true;
        });

        if (mapsToCalculate.length === 0) return [-(activeWorld.totalHeight / 2), activeWorld.totalWidth / 2] as [number, number];

        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        for (const m of mapsToCalculate) {
            if (m.x < minX) minX = m.x;
            if (m.x > maxX) maxX = m.x;
            if (m.y < minY) minY = m.y;
            if (m.y > maxY) maxY = m.y;
        }

        const cX = activeWorld.origineX + ((minX + maxX) / 2) * activeWorld.mapWidth;
        const cY = activeWorld.origineY + ((minY + maxY) / 2) * activeWorld.mapHeight;

        // Leaflet expects [-y, x]
        return [-cY, cX] as [number, number];
    }, [activeWorld, activeMaps]);

    // -------------------------------------------------------------------------------------
    // CORRECTION MAJEURE: Alignement DofusDB Px -> Coordonnées Jeu.
    // L'origine (0, 0) dans les Tiles DofusDB est décalée de -3 cases en X et -2 cases en Y.
    // On doit ré-ajuster l'origine physique pour que les clicks et les Maps tombent 
    // parfaitement sur la bonne tuile visuelle.
    // -------------------------------------------------------------------------------------
    const correctedActiveWorld = useMemo(() => {
        if (!activeWorld) return null;
        if (selectedWorldId === 1) { // 1 = Monde des Douze
            return {
                ...activeWorld,
                origineX: activeWorld.origineX + 2 * activeWorld.mapWidth,
                origineY: activeWorld.origineY + 2 * activeWorld.mapHeight
            };
        }
        return activeWorld; // Autres dimensions Ok
    }, [activeWorld, selectedWorldId]);

    if (!correctedActiveWorld) return null;

    if (typeof window !== 'undefined') {
        (window as any)._activeWorld_for_crs = correctedActiveWorld;
    }

    return (
        <div className="w-full h-full cursor-crosshair">
            <style>{`
                .leaflet-container { background: transparent; }
                .custom-leaflet-tooltip {
                    background: #111822 !important;
                    border: 1px solid rgba(255, 255, 255, 0.05) !important;
                    color: white !important;
                    font-family: inherit;
                    font-size: 12px;
                    border-radius: 8px;
                    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.5);
                    padding: 6px 12px;
                    white-space: nowrap;
                    pointer-events: none;
                }
                .leaflet-tooltip-left::before, .leaflet-tooltip-right::before { display: none; }
                .dungeon-icon-marker { background: none; border: none; }
            `}</style>

            <MapContainer
                crs={sigilCRS}
                center={initialCenter}
                zoom={-1}
                style={{ height: '100%', width: '100%', outline: 'none' }}
                zoomControl={false}
                attributionControl={false}
                minZoom={-(correctedActiveWorld.zoom?.length || 1) - 1}
                maxZoom={3}
                maxBoundsViscosity={0.8}
            >
                {/* 1. Les tuiles par dessus L.CRS.Simple */}
                <SigilTilesLayer activeWorld={correctedActiveWorld} selectedWorldId={selectedWorldId} />

                {/* 3. La grille si activée */}
                {showDebugGrid && (
                    <div className="leaflet-pane leaflet-overlay-pane" style={{ zIndex: 10 }}>
                        <div style={{
                            position: 'absolute',
                            left: 0, top: -correctedActiveWorld.totalHeight,
                            width: correctedActiveWorld.totalWidth, height: correctedActiveWorld.totalHeight,
                            backgroundImage: `
                                linear-gradient(to right, rgba(0,0,0,0.2) 1px, transparent 1px),
                                linear-gradient(to bottom, rgba(0,0,0,0.2) 1px, transparent 1px)`,
                            backgroundSize: `${correctedActiveWorld.mapWidth}px ${correctedActiveWorld.mapHeight}px`,
                            backgroundPosition: `${correctedActiveWorld.origineX}px ${correctedActiveWorld.totalHeight - correctedActiveWorld.origineY}px`,
                            pointerEvents: 'none'
                        }} />
                    </div>
                )}

                {/* 4. Gestion des interactions, clics */}
                <MapInteractionHandler
                    activeWorld={correctedActiveWorld}
                    selectedWorldId={selectedWorldId}
                    mapsByCoords={mapsByCoords}
                    subAreasById={subAreasById}
                    dungeonsByMapId={dungeonsByMapId}
                    setSelectedPosition={setSelectedPosition}
                />

                {/* 5. Highlight Overlay */}
                {
                    selectedPosition && (
                        <Rectangle
                            bounds={[
                                [-(correctedActiveWorld.origineY + (selectedPosition.y + 1) * correctedActiveWorld.mapHeight), correctedActiveWorld.origineX + selectedPosition.x * correctedActiveWorld.mapWidth],
                                [-(correctedActiveWorld.origineY + selectedPosition.y * correctedActiveWorld.mapHeight), correctedActiveWorld.origineX + (selectedPosition.x + 1) * correctedActiveWorld.mapWidth]
                            ]}
                            pathOptions={{
                                color: '#38bdf8', weight: 2, fillColor: '#38bdf8', fillOpacity: 0.25
                            }}
                        />
                    )
                }

                {/* 6. Les Donjons */}
                {
                    groupedDungeons && groupedDungeons.map((group: any) => {
                        const px = correctedActiveWorld.origineX + group.mapNode.x * correctedActiveWorld.mapWidth + correctedActiveWorld.mapWidth / 2;
                        const py = correctedActiveWorld.origineY + group.mapNode.y * correctedActiveWorld.mapHeight + correctedActiveWorld.mapHeight / 2;

                        const dCount = group.dungeons.length;

                        const iconHtml = `
                        <div class="w-7 h-7 rounded-full bg-slate-900/90 border-2 border-amber-500/80 shadow-[0_0_12px_rgba(245,158,11,0.4)] flex items-center justify-center text-amber-400 group-hover:scale-125 group-hover:border-amber-400 transition-all duration-200 relative">
                            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-castle"><path d="M22 20v-9H2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2Z"/><path d="M18 11V4H6v7"/><path d="M15 22v-4a3 3 0 0 0-3-3v0a3 3 0 0 0-3 3v4"/><path d="M22 11V9"/><path d="M2 11V9"/><path d="M6 4V2"/><path d="M18 4V2"/><path d="M10 4V2"/><path d="M14 4V2"/></svg>
                            ${dCount > 1 ? `<div class="absolute -top-2 -right-2 bg-amber-500 text-black text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center border border-slate-900">${dCount}</div>` : ''}
                        </div>
                    `;

                        return (
                            <Marker
                                key={`d-${group.mapId}`}
                                position={[-py, px]}
                                icon={new L.DivIcon({
                                    html: iconHtml,
                                    className: 'dungeon-icon-marker',
                                    iconSize: [28, 28],
                                    iconAnchor: [14, 14]
                                })}
                                eventHandlers={{ click: () => setSelectedDungeon(group.dungeons) }}
                            >
                                <Tooltip direction="top" offset={[0, -10]} opacity={1}>
                                    <div className="text-amber-500 font-bold text-xs">{dCount > 1 ? `${dCount} Donjons` : group.dungeons[0].name}</div>
                                </Tooltip>
                            </Marker>
                        );
                    })
                }

                <ExternalController triggerCenterPosition={triggerCenterPosition} activeWorld={correctedActiveWorld} />
            </MapContainer>
        </div>
    );
}
