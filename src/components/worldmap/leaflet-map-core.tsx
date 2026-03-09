'use client';

import React, { useEffect, useMemo, useRef, useCallback } from 'react';
import { MapContainer, Rectangle, Marker, Tooltip, useMap, useMapEvents, Polyline } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// -------------------------------------------------------------------------------------
// CRS sur mesure : mappe les zooms Leaflet sur les échelles Dofus (1, 0.8, 0.6...)
// -------------------------------------------------------------------------------------
const getActiveWorld = () => (typeof window !== 'undefined' ? (window as any)._activeWorld_for_crs : null);

const sigilCRS = L.extend({}, L.CRS.Simple, {
    scale: function (zoom: number) {
        const w = getActiveWorld();
        const scales = w?.zoom || [1];
        if (zoom > 0) return Math.pow(2, zoom);
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

// -------------------------------------------------------------------------------------
// TileLayer optimisé
// -------------------------------------------------------------------------------------
function SigilTilesLayer({ activeWorld, selectedWorldId }: any) {
    const map = useMap();

    useEffect(() => {
        if (!activeWorld) return;

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

                const tileSize = selectedWorldId === 1 ? 256 : 250;
                const apiCols = Math.ceil((activeWorld.totalWidth * scale) / tileSize);
                if (coords.x < 0 || coords.x >= apiCols || coords.y < 0 || coords.y >= Math.ceil((activeWorld.totalHeight * scale) / tileSize)) {
                    return 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=';
                }
                const index = coords.y * apiCols + coords.x + 1;
                return `/game-data/tiles/w${selectedWorldId}/${bank}/${index}.webp`;
            }
        });

        const bounds: L.LatLngBoundsExpression = [[-activeWorld.totalHeight, 0], [0, activeWorld.totalWidth]];
        const scales = activeWorld.zoom || [1];
        const minZ = -(scales.length - 1);

        const layerSize = selectedWorldId === 1 ? 256 : 250;

        // @ts-expect-error Leaflet extended classes don't inherit constructor typings
        const layer = new customTileLayer('', {
            tileSize: layerSize,
            minNativeZoom: minZ,
            maxNativeZoom: 0,
            minZoom: minZ - 1,
            maxZoom: 3,
            noWrap: true,
            bounds: bounds,
            errorTileUrl: 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=',
            // ──── PERF ────
            updateWhenIdle: false,
            updateWhenZooming: false,
            updateInterval: 100,
            keepBuffer: 6
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

// -------------------------------------------------------------------------------------
// Grille DofusDB : Canvas overlay attaché au CONTAINER (pas au pane)
// Dessine un contour par position de map existante, highlight sur hover
// -------------------------------------------------------------------------------------
const TOOLTIP_THROTTLE_MS = 100;

function MapGridOverlay({ activeWorld, mapsByCoords, mapsBySubAreaId, showDebugGrid, isMiniMap, guessResult, selectedPosition }: any) {
    const map = useMap();
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const hoveredCellRef = useRef<string | null>(null);
    const hoveredSubAreaIdRef = useRef<number | null>(null);
    const rafRef = useRef<number>(0);

    // Attach canvas directly to the map container (NOT a pane — panes move during pan)
    useEffect(() => {
        if (!activeWorld) return;

        const container = map.getContainer();
        const canvas = document.createElement('canvas');
        canvas.className = 'sigil-grid-canvas';
        canvas.style.position = 'absolute';
        canvas.style.top = '0';
        canvas.style.left = '0';
        canvas.style.width = '100%';
        canvas.style.height = '100%';
        canvas.style.pointerEvents = 'none';
        canvas.style.zIndex = '450'; // Above tiles, below tooltips/markers
        container.appendChild(canvas);
        canvasRef.current = canvas;

        return () => {
            if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
            canvasRef.current = null;
        };
    }, [map, activeWorld]);

    const drawGrid = useCallback(() => {
        const canvas = canvasRef.current;
        const world = activeWorld; // On utilise la version corrigée passée ici
        if (!canvas || !world) return;

        const size = map.getSize();
        const dpr = window.devicePixelRatio || 1;
        canvas.width = size.x * dpr;
        canvas.height = size.y * dpr;
        canvas.style.width = size.x + 'px';
        canvas.style.height = size.y + 'px';

        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.scale(dpr, dpr);
        ctx.clearRect(0, 0, size.x, size.y);

        const mw = world.mapWidth;
        const mh = world.mapHeight;
        const ox = world.origineX;
        const oy = world.origineY;

        // ── 1. Hover Highlight (Toute la zone ou juste la case) ──
        const subAreaId = isMiniMap ? null : hoveredSubAreaIdRef.current;
        const cellKey = hoveredCellRef.current;

        if (subAreaId !== null && mapsBySubAreaId) {
            const mapsInZone = mapsBySubAreaId.get(subAreaId);
            if (mapsInZone) {
                ctx.fillStyle = 'rgba(56, 189, 248, 0.4)';
                ctx.strokeStyle = 'rgba(56, 189, 248, 0.8)';
                ctx.lineWidth = 1.5;

                const painted = new Set<string>();
                mapsInZone.forEach((m: any) => {
                    const key = `${m.x},${m.y}`;
                    if (painted.has(key)) return;
                    painted.add(key);

                    const tl = map.latLngToContainerPoint(L.latLng(-(oy + m.y * mh), ox + m.x * mw));
                    const br = map.latLngToContainerPoint(L.latLng(-(oy + (m.y + 1) * mh), ox + (m.x + 1) * mw));
                    const w = Math.ceil(br.x - tl.x);
                    const h = Math.ceil(br.y - tl.y);
                    ctx.fillRect(Math.round(tl.x), Math.round(tl.y), w, h);
                    ctx.strokeRect(Math.round(tl.x), Math.round(tl.y), w, h);
                });
            }
        } else if (cellKey) {
            const [hx, hy] = cellKey.split(',').map(Number);
            const tl = map.latLngToContainerPoint(L.latLng(-(oy + hy * mh), ox + hx * mw));
            const br = map.latLngToContainerPoint(L.latLng(-(oy + (hy + 1) * mh), ox + (hx + 1) * mw));
            ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
            ctx.fillRect(Math.round(tl.x), Math.round(tl.y), Math.round(br.x - tl.x), Math.round(br.y - tl.y));
        }

        // ── 2. Selection Highlight (Ancisnt Rectangle SVG -> Canvas) ──
        if (selectedPosition) {
            const tl = map.latLngToContainerPoint(L.latLng(-(oy + selectedPosition.y * mh), ox + selectedPosition.x * mw));
            const br = map.latLngToContainerPoint(L.latLng(-(oy + (selectedPosition.y + 1) * mh), ox + (selectedPosition.x + 1) * mw));
            ctx.fillStyle = 'rgba(56, 189, 248, 0.25)';
            ctx.strokeStyle = '#38bdf8';
            ctx.lineWidth = 2;
            ctx.fillRect(Math.round(tl.x), Math.round(tl.y), Math.round(br.x - tl.x), Math.round(br.y - tl.y));
            ctx.strokeRect(Math.round(tl.x), Math.round(tl.y), Math.round(br.x - tl.x), Math.round(br.y - tl.y));
        }

        // ── 3. Guess Result (Trait + Dots) ──
        if (guessResult) {
            const t = guessResult.target;
            const g = guessResult.guess;

            // Si pas de guess (temps écoulé), on ne dessine pas le trait
            if (!g) return;

            const p1 = map.latLngToContainerPoint(L.latLng(-(oy + t.y * mh + mh / 2), ox + t.x * mw + mw / 2));
            const p2 = map.latLngToContainerPoint(L.latLng(-(oy + g.y * mh + mh / 2), ox + g.x * mw + mw / 2));

            // Glow Effect
            ctx.shadowBlur = 10;
            ctx.shadowColor = 'rgba(245, 158, 11, 0.5)';

            // Le trait
            ctx.beginPath();
            ctx.setLineDash([12, 8]);
            ctx.strokeStyle = '#fbbf24';
            ctx.lineWidth = 6;
            ctx.lineCap = 'round';
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
            ctx.setLineDash([]);

            // Points de départ/arrivée
            ctx.shadowBlur = 15;
            ctx.shadowColor = 'rgba(16, 185, 129, 0.8)';
            ctx.fillStyle = '#10b981'; ctx.beginPath(); ctx.arc(p1.x, p1.y, 10, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = 'white'; ctx.lineWidth = 3; ctx.stroke();

            ctx.shadowColor = 'rgba(239, 68, 68, 0.8)';
            ctx.fillStyle = '#ef4444'; ctx.beginPath(); ctx.arc(p2.x, p2.y, 10, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = 'white'; ctx.lineWidth = 3; ctx.stroke();

            ctx.shadowBlur = 0;

            // Label de distance au milieu
            const midX = (p1.x + p2.x) / 2;
            const midY = (p1.y + p2.y) / 2;
            const dx = t.x - g.x;
            const dy = t.y - g.y;
            const dist = Math.round(Math.sqrt(dx * dx + dy * dy));

            const label = `${dist} maps`;
            ctx.font = 'bold 14px Inter, sans-serif';
            const textWidth = ctx.measureText(label).width;

            // Fond du label
            ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
            ctx.beginPath();
            ctx.rect(midX - textWidth / 2 - 10, midY - 15, textWidth + 20, 30);
            ctx.fill();
            ctx.strokeStyle = '#fbbf24';
            ctx.lineWidth = 2;
            ctx.stroke();

            // Texte
            ctx.fillStyle = '#fbbf24';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(label, midX, midY);
        }

        if (!showDebugGrid || isMiniMap) return;

        const bounds = map.getBounds();
        const nw = bounds.getNorthWest();
        const se = bounds.getSouthEast();

        const g1X = (nw.lng - ox) / mw;
        const g2X = (se.lng - ox) / mw;
        const g1Y = (-nw.lat - oy) / mh;
        const g2Y = (-se.lat - oy) / mh;

        const minGX = Math.floor(Math.min(g1X, g2X)) - 1;
        const maxGX = Math.ceil(Math.max(g1X, g2X)) + 1;
        const minGY = Math.floor(Math.min(g1Y, g2Y)) - 1;
        const maxGY = Math.ceil(Math.max(g1Y, g2Y)) + 1;

        ctx.beginPath();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 1;

        for (let gx = minGX; gx <= maxGX + 1; gx++) {
            const p = map.latLngToContainerPoint(L.latLng(0, ox + gx * mw));
            const x = Math.round(p.x);
            ctx.moveTo(x, 0);
            ctx.lineTo(x, size.y);
        }

        for (let gy = minGY; gy <= maxGY + 1; gy++) {
            const p = map.latLngToContainerPoint(L.latLng(-(oy + gy * mh), 0));
            const y = Math.round(p.y);
            ctx.moveTo(0, y);
            ctx.lineTo(size.x, y);
        }
        ctx.stroke();
    }, [map, activeWorld, mapsBySubAreaId, showDebugGrid, isMiniMap, guessResult, selectedPosition]);

    // Redraw on every map movement, zoom and toggle (rAF-throttled)
    useEffect(() => {
        drawGrid();
    }, [showDebugGrid, drawGrid, selectedPosition, guessResult]);

    useMapEvents({
        move: () => {
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
            rafRef.current = requestAnimationFrame(drawGrid);
        },
        moveend: () => drawGrid(),
        zoom: () => {
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
            rafRef.current = requestAnimationFrame(drawGrid);
        },
        zoomend: () => drawGrid(),
        mousemove: (e) => {
            const world = activeWorld;
            if (!world) return;
            const gx = Math.floor((e.latlng.lng - world.origineX) / world.mapWidth);
            const gy = Math.floor((-e.latlng.lat - world.origineY) / world.mapHeight);
            const key = `${gx},${gy}`;
            const mapData = mapsByCoords?.get(key);
            const subAreaId = mapData ? mapData.subAreaId : null;

            if (key !== hoveredCellRef.current || subAreaId !== hoveredSubAreaIdRef.current) {
                hoveredCellRef.current = key;
                hoveredSubAreaIdRef.current = subAreaId;
                if (rafRef.current) cancelAnimationFrame(rafRef.current);
                rafRef.current = requestAnimationFrame(drawGrid);
            }
        },
        mouseout: () => {
            if (hoveredCellRef.current || hoveredSubAreaIdRef.current) {
                hoveredCellRef.current = null;
                hoveredSubAreaIdRef.current = null;
                drawGrid();
            }
        }
    });

    // Initial draw + redraw on world change
    useEffect(() => {
        const t = setTimeout(drawGrid, 100);
        return () => clearTimeout(t);
    }, [drawGrid]);

    return null;
}

// -------------------------------------------------------------------------------------
// Fix Resize Issue & Autocenter Result
// -------------------------------------------------------------------------------------
function MapViewHandler({ isMiniMap, guessResult, activeWorld, minimapZoomLevel, minimapRecenterTrigger }: any) {
    const map = useMap();

    useEffect(() => {
        const timer = setInterval(() => map.invalidateSize(), 500);
        return () => clearInterval(timer);
    }, [map]);

    // Recenter map automatically when the active world changes
    useEffect(() => {
        if (activeWorld && map) {
            const world = activeWorld;
            const targetLat = -(world.totalHeight / 2);
            const targetLng = world.totalWidth / 2;

            // SetView is immediate which feels better when switching worlds than flyTo
            map.setView([targetLat, targetLng], isMiniMap ? -3 : 0, { animate: false });
        }
    }, [activeWorld, map, isMiniMap]);

    // Manual Zoom Control for MiniMap
    useEffect(() => {
        if (isMiniMap && minimapZoomLevel !== undefined) {
            map.setZoom(minimapZoomLevel);
        }
    }, [isMiniMap, minimapZoomLevel, map]);

    // Recenter (Home) logic
    useEffect(() => {
        if (isMiniMap && minimapRecenterTrigger && activeWorld) {
            const world = activeWorld;
            // Recenter on target if exists, else on origin
            if (guessResult?.target) {
                const { target } = guessResult;
                map.flyTo([-(world.origineY + target.y * world.mapHeight + world.mapHeight / 2), world.origineX + target.x * world.mapWidth + world.mapWidth / 2], -2);
            } else {
                map.flyTo([-(world.origineY + world.totalHeight / 2), world.origineX + world.totalWidth / 2], -3);
            }
        }
    }, [minimapRecenterTrigger, isMiniMap, map, activeWorld, guessResult]);

    useEffect(() => {
        if (guessResult && isMiniMap && activeWorld) {
            const { target, guess } = guessResult;
            if (!guess) return; // Don't fly if no guess made (timeout)
            const world = activeWorld;

            const p1 = L.latLng(-(world.origineY + target.y * world.mapHeight + world.mapHeight / 2), world.origineX + target.x * world.mapWidth + world.mapWidth / 2);
            const p2 = L.latLng(-(world.origineY + guess.y * world.mapHeight + world.mapHeight / 2), world.origineX + guess.x * world.mapWidth + world.mapWidth / 2);

            const bounds = L.latLngBounds([p1, p2]);
            // Petit timeout pour s'assurer que Leaflet a fini son rendu initial
            setTimeout(() => {
                map.flyToBounds(bounds, { padding: [80, 80], duration: 1.5, easeLinearity: 0.25 });
            }, 100);
        }
    }, [guessResult, isMiniMap, map, activeWorld]);

    return null;
}

// Tooltip + click interactions (throttled)
// -------------------------------------------------------------------------------------
function MapInteractionHandler({ activeWorld, mapsByCoords, subAreasById, dungeonsByMapId, setSelectedPosition, isMiniMap }: any) {
    const map = useMap();
    const tooltipRef = useRef<L.Tooltip | null>(null);
    const lastTooltipTime = useRef(0);

    useMapEvents({
        mousemove: (e) => {
            if (!activeWorld || isMiniMap) return; // Hide tooltip on minimap (no spoilers!)

            const now = performance.now();
            if (now - lastTooltipTime.current < TOOLTIP_THROTTLE_MS) {
                if (tooltipRef.current) tooltipRef.current.setLatLng(e.latlng);
                return;
            }
            lastTooltipTime.current = now;

            const mapX = e.latlng.lng;
            const mapY = -e.latlng.lat;
            const gameX = Math.floor((mapX - activeWorld.origineX) / activeWorld.mapWidth);
            const gameY = Math.floor((mapY - activeWorld.origineY) / activeWorld.mapHeight);

            const foundMap = mapsByCoords.get(`${gameX},${gameY}`);
            const subAreaName = foundMap ? subAreasById.get(foundMap.subAreaId)?.name : null;
            const tooltipContent = `<div class="flex items-center gap-2"><span class="font-bold text-white">${subAreaName || 'Hors Map'}</span><span class="text-white/50 text-[10px] font-mono">[${gameX}, ${gameY}]</span></div>`;

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
            const world = activeWorld;
            if (!world) return;
            const mapX = e.latlng.lng;
            const mapY = -e.latlng.lat;
            const gameX = Math.floor((mapX - world.origineX) / world.mapWidth);
            const gameY = Math.floor((mapY - world.origineY) / world.mapHeight);
            const foundMap = mapsByCoords.get(`${gameX},${gameY}`);

            setSelectedPosition({ x: gameX, y: gameY, displayX: gameX, displayY: gameY, mapId: foundMap?.id });
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

// -------------------------------------------------------------------------------------
// Main Component
// -------------------------------------------------------------------------------------
interface LeafletMapCoreProps {
    activeWorld: any | null; // Assuming WorldInfo is a type, using 'any' for simplicity if not defined elsewhere
    selectedWorldId: number;
    activeMaps: any[];
    mapsByCoords: Map<string, any>;
    subAreasById: Map<number, any>;
    dungeonsByMapId: Map<number, any[]>;
    groupedDungeons: any[];
    showDebugGrid: boolean;
    selectedPosition: any;
    setSelectedPosition: (pos: any) => void;
    setSelectedDungeon: (dungeons: any[] | null) => void;
    triggerCenterPosition?: { x: number, y: number } | null;
    isMiniMap?: boolean;
    guessResult?: { target: any, guess: any } | null;
    mapsBySubAreaId?: Map<number, any[]>;
    minimapZoomLevel?: number;
    minimapRecenterTrigger?: number;
}
export default function LeafletMapCore(props: LeafletMapCoreProps) {
    const {
        activeWorld, selectedWorldId, activeMaps, mapsByCoords, subAreasById,
        dungeonsByMapId, groupedDungeons, showDebugGrid, selectedPosition,
        mapsBySubAreaId, setSelectedPosition, setSelectedDungeon, triggerCenterPosition,
        isMiniMap, guessResult, minimapZoomLevel, minimapRecenterTrigger
    } = props;

    // Correction Alignement : Décalage manuel de +2 cases à droite spécifique au Monde des Douze
    const correctedActiveWorld = useMemo(() => {
        if (!activeWorld) return null;
        if (selectedWorldId === 1) {
            const mw = activeWorld.mapWidth || 69.5;
            const mh = activeWorld.mapHeight || 49.7;
            return {
                ...activeWorld,
                origineX: (activeWorld.origineX || 0) + (2.5 * mw),
                origineY: (activeWorld.origineY || 0) + (2.0 * mh)
            };
        }
        return activeWorld;
    }, [activeWorld, selectedWorldId]);

    if (!correctedActiveWorld) return null;

    if (typeof window !== 'undefined') {
        (window as any)._activeWorld_for_crs = correctedActiveWorld;
    }

    // Dimension des tuiles du monde en cours pour combler parfaitement les trous
    const tileSize = selectedWorldId === 1 ? 256 : 250;

    return (
        <div className="w-full h-full cursor-crosshair">
            <style>{`
                /* ── Fix jointures de tuiles ABSOLU ──
                   Force la taille exacte des tuiles du monde ciblé + 1 pixel
                   pour un recouvrement garanti qui annule les lignes blanches */
                .leaflet-tile {
                    width: ${tileSize + 1}px !important;
                    height: ${tileSize + 1}px !important;
                    margin-right: -1px;
                    margin-bottom: -1px;
                    -webkit-backface-visibility: hidden;
                    backface-visibility: hidden;
                    image-rendering: auto;
                    /* Supprime les bordures noires/vides entre les images */
                    outline: none !important;
                    border: none !important;
                    box-shadow: none !important;
                    /* Fix flickering (lignes blanches) spécifique Chromium/WebKit */
                    margin: -1px !important;
                    padding: 1px !important;
                }
                .leaflet-container {
                    background: #080b12 !important;
                    will-change: transform;
                }
                .leaflet-tile-pane {
                    will-change: transform;
                }
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
                .sigil-grid-canvas { pointer-events: none; }
            `}</style>

            <MapContainer
                key={`${selectedWorldId}-${isMiniMap}`}
                crs={sigilCRS}
                center={[-correctedActiveWorld.totalHeight / 2, correctedActiveWorld.totalWidth / 2]}
                zoom={isMiniMap ? -3 : 0}
                style={{ height: '100%', width: '100%', outline: 'none' }}
                zoomControl={false}
                attributionControl={false}
                minZoom={isMiniMap ? -6 : (-(correctedActiveWorld.zoom?.length || 1) - 1)}
                maxZoom={3}
                maxBoundsViscosity={0.8}
                zoomSnap={0.1}
                zoomDelta={1}
                preferCanvas={true}
            >
                <MapViewHandler
                    isMiniMap={isMiniMap}
                    guessResult={guessResult}
                    activeWorld={correctedActiveWorld}
                    minimapZoomLevel={minimapZoomLevel}
                    minimapRecenterTrigger={minimapRecenterTrigger}
                />
                {/* 1. Tuiles */}
                <SigilTilesLayer activeWorld={correctedActiveWorld} selectedWorldId={selectedWorldId} />

                {/* 2. Grille DofusDB canvas (contour par position), contrôlée par showDebugGrid */}
                <MapGridOverlay
                    activeWorld={correctedActiveWorld}
                    mapsByCoords={mapsByCoords}
                    mapsBySubAreaId={mapsBySubAreaId}
                    showDebugGrid={showDebugGrid}
                    isMiniMap={isMiniMap}
                    guessResult={guessResult}
                    selectedPosition={selectedPosition}
                />

                {/* 4. Interactions */}
                <MapInteractionHandler
                    activeWorld={correctedActiveWorld}
                    selectedWorldId={selectedWorldId}
                    mapsByCoords={mapsByCoords}
                    subAreasById={subAreasById}
                    dungeonsByMapId={dungeonsByMapId}
                    setSelectedPosition={setSelectedPosition}
                    isMiniMap={isMiniMap}
                />

                {/* 5. Highlight overlay (click selection) */}

                {/* 6. Dungeon markers (Uniquement si pas mini-map) */}
                {!isMiniMap && groupedDungeons && groupedDungeons.map((group: any) => {
                    const px = correctedActiveWorld.origineX + group.mapNode.x * correctedActiveWorld.mapWidth + correctedActiveWorld.mapWidth / 2;
                    const py = correctedActiveWorld.origineY + group.mapNode.y * correctedActiveWorld.mapHeight + correctedActiveWorld.mapHeight / 2;
                    const dCount = group.dungeons.length;

                    const iconHtml = `
                    <div class="w-7 h-7 rounded-full bg-slate-900/90 border-2 border-amber-500/80 shadow-[0_0_12px_rgba(245,158,11,0.4)] flex items-center justify-center text-amber-400 group-hover:scale-125 group-hover:border-amber-400 transition-all duration-200 relative">
                        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 20v-9H2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2Z"/><path d="M18 11V4H6v7"/><path d="M15 22v-4a3 3 0 0 0-3-3v0a3 3 0 0 0-3 3v4"/><path d="M22 11V9"/><path d="M2 11V9"/><path d="M6 4V2"/><path d="M18 4V2"/><path d="M10 4V2"/><path d="M14 4V2"/></svg>
                        ${dCount > 1 ? `<div class="absolute -top-2 -right-2 bg-amber-500 text-black text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center border border-slate-900">${dCount}</div>` : ''}
                    </div>`;

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
                                <div className="text-amber-500 font-bold text-xs">{dCount > 1 ? `${dCount} Donjons` : group.dungeons[0].name.fr}</div>
                            </Tooltip>
                        </Marker>
                    );
                })}

                <ExternalController triggerCenterPosition={triggerCenterPosition} activeWorld={correctedActiveWorld} />
            </MapContainer>
        </div>
    );
}
