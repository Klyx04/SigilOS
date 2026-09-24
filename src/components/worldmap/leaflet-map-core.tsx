'use client';
// dark-locked — module volontairement sombre (V2 Dual-Theme Phase 2C) : ne PAS utiliser les tokens thème-aware ici (voir memo 21/08 + prompt 22/08).

import React, { useEffect, useMemo, useRef, useCallback } from 'react';
import { MapContainer, Rectangle, Marker, Tooltip, useMap, useMapEvents, Polyline } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Plus, Minus, Copy, Flag, CornerUpRight, Rocket, Smartphone, Layers, Compass, Pin, X } from 'lucide-react';
import { toast } from 'sonner';
import { mergeCellEdges } from '@/lib/map-utils';
import { resolveTileBank, findNearestMap, MAP_OCEAN_TONE } from '@/lib/worldmap-tiles';
import { HarvestRouteOverlay } from './harvest-route-overlay';
import { SecretPassagesOverlay } from './secret-passages-overlay';
import { cn } from '@/lib/utils';

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

// Cache d'icônes donjons : évite `new L.DivIcon` à chaque render React
// (Monde des Douze = ~100 marqueurs recréés à chaque survol/re-render).
const dungeonIconCache = new Map<string, L.DivIcon>();
function getDungeonIcon(isOcre: boolean, dCount: number): L.DivIcon {
    const key = `${isOcre ? 1 : 0}:${dCount > 1 ? dCount : 1}`;
    let icon = dungeonIconCache.get(key);
    if (!icon) {
        icon = new L.DivIcon({
            html: `
            <div class="w-7 h-7 rounded-full bg-surface/90 border-2 border-amber-500/80 flex items-center justify-center group-hover:scale-125 group-hover:border-amber-400 transition-all duration-200 relative">
                <img src="/assets/worldmap/dungeon-boss.png" alt="Donjon" class="w-5 h-5 object-contain" draggable="false" />
                ${isOcre ? `<img src="/module-dofus/Dofus_Ocre.png" alt="Quête Ocre" class="absolute -top-5 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full object-contain border border-border-strong bg-background" title="Donjon Quête Ocre" />` : ''}
                ${dCount > 1 ? `<div class="absolute -top-2 -right-2 bg-amber-500 text-warning-foreground text-caption font-bold w-4 h-4 rounded-full flex items-center justify-center border border-slate-900">${dCount}</div>` : ''}
            </div>`,
            className: 'dungeon-icon-marker',
            iconSize: [28, 28],
            iconAnchor: [14, 14]
        });
        dungeonIconCache.set(key, icon);
    }
    return icon;
}

// -------------------------------------------------------------------------------------
// TileLayer optimisé
// -------------------------------------------------------------------------------------
function SigilTilesLayer({ activeWorld, selectedWorldId }: any) {
    const map = useMap();

    useEffect(() => {
        if (!activeWorld) return;

        const customTileLayer = L.TileLayer.extend({
            getTileUrl: function (coords: any) {
                // Lib testée (worldmap-tiles.ts) : arrondit le zoom et borne sur
                // une échelle connue — jamais de banque undefined = jamais de
                // tuiles transparentes (carrés noirs). Le snap décimal de la
                // grille est appliqué plus bas (gridScale).
                const { scale, bank } = resolveTileBank(activeWorld.zoom || [1], coords.z);

                const tileSize = selectedWorldId === 1 ? 256 : 250;
                // Grille TOUJOURS au ceil, sur échelle SNAPPÉE (4 décimales) : le
                // générateur de tuiles émet la rangée/colonne partielle (ex: w1/0.2 =
                // 8×7=56 tuiles, pas 8×6 — avec Math.round la dernière rangée était
                // déclarée hors-limites → trou noir permanent au dézoom). Le snap est
                // obligatoire car worlds.json stocke des floats bruités (0.8000000119…) :
                // sans lui, 10240*0.8000000119/256 = 32.0000004… et ceil ajoute une
                // colonne fantôme (404 → trou noir au bord droit).
                const gridScale = parseFloat(scale.toFixed(4));
                const apiCols = Math.ceil((activeWorld.totalWidth * gridScale) / tileSize);
                const apiRows = Math.ceil((activeWorld.totalHeight * gridScale) / tileSize);
                
                if (coords.x < 0 || coords.x >= apiCols || coords.y < 0 || coords.y >= apiRows) {
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
            // ──── PERF / ANTI-FLICKER (Chromium, Opera GX) ────
            // updateWhenZooming:true → les tuiles suivent le zoom au lieu de laisser
            // le fond noir pendant l'animation. keepBuffer:2 (défaut) au lieu de 6 :
            // 6 anneaux = centaines d'images/GPU textures → le compositeur (surtout
            // avec le limiteur RAM/VRAM d'Opera GX) droppe des textures = tuiles noires.
            // updateWhenIdle:false (défaut desktop Leaflet) → les tuiles sont demandées
            // PENDANT le pan (et non au moveend) : plus de bandes océan/bleues au bord
            // d'attaque quand on déplace la carte.
            updateWhenIdle: false,
            updateWhenZooming: true,
            updateInterval: 200,
            keepBuffer: 2
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

function MapGridOverlay({ activeWorld, mapsByCoords, mapsBySubAreaId, subAreasById, showDebugGrid, isMiniMap, guessResult, selectedPosition, participants, currentUserId, highlightSubareaIds, zoneHighlight, zaaps, onOpenZoneDetails, setSelectedPosition, isOverHudRef, mouseoutTimerRef }: any) {
    const map = useMap();
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const hoveredCellRef = useRef<string | null>(null);
    const hoveredSubAreaIdRef = useRef<number | null>(null);
    const rafRef = useRef<number>(0);
    const highlightSubareaIdsRef = useRef<number[]>([]);

    // ────────────────────────────────────────────────────────────────
    // Attache le canvas DIRECTEMENT sur le container du map (position fixe)
    // ────────────────────────────────────────────────────────────────
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
        canvas.style.zIndex = '450';
        container.appendChild(canvas);
        canvasRef.current = canvas;

        return () => {
            if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
            canvasRef.current = null;
        };
    }, [map, activeWorld]);

    // ────────────────────────────────────────────────────────────────
    // Rendu canvas — système de coordonnées unique : containerPoint
    // Le canvas est fixe sur le container, donc containerPoint = coordonnées canvas
    // ────────────────────────────────────────────────────────────────
    const drawGrid = useCallback(() => {
        const canvas = canvasRef.current;
        const world = activeWorld;
        if (!canvas || !world) return;
        // POC : le shape officiel de la sous-zone 76 (Village des Brigandins) est décalé →
        // on force le fallback "cellules des maps" pour couvrir toutes les maps.
        const forceCellFallback = world?.id === 38;

        const size = map.getSize();
        // DPR plafonné à 2 : en 4K (dpr 2-3) le canvas plein écran réalloué à chaque
        // frame sature l'upload GPU → saccades + clignotement global (navbar incluse
        // sur Opera GX). On ne réalloue QUE si la taille a réellement changé :
        // assigner canvas.width/height vide le canvas et recrée la texture GPU.
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const targetW = Math.max(1, Math.round(size.x * dpr));
        const targetH = Math.max(1, Math.round(size.y * dpr));
        if (canvas.width !== targetW || canvas.height !== targetH) {
            canvas.width = targetW;
            canvas.height = targetH;
        }
        canvas.style.width = size.x + 'px';
        canvas.style.height = size.y + 'px';

        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.scale(dpr, dpr);
        ctx.clearRect(0, 0, size.x, size.y);

        const mw = world.mapWidth;
        const mh = world.mapHeight;
        const ox = world.origineX;
        const oy = world.origineY;

        // ── Helper : coordonnées logiques (gx, gy) → point canvas ──
        const toCP = (gx: number, gy: number) =>
            map.latLngToContainerPoint(L.latLng(-(oy + gy * mh), ox + gx * mw));

        // ── 1. Hover SubArea (surbrillance de zone au survol) ──
        const subAreaId = hoveredSubAreaIdRef.current;
        const cellKey = hoveredCellRef.current;
        const activeSubArea = subAreaId ? subAreasById?.get(subAreaId) : null;

        if (zoneHighlight && subAreaId !== null && mapsBySubAreaId && subAreasById) {
            const subArea = subAreasById.get(subAreaId);
            const mapsInZone = mapsBySubAreaId.get(subAreaId);
            
            ctx.save();
            // Rendu clean style Dofus / Duffus : voile sombre transparent + contour noir franc
            ctx.fillStyle = 'rgba(15, 23, 42, 0.32)';
            ctx.strokeStyle = 'rgba(15, 23, 42, 0.95)';
            ctx.lineWidth = 2;
            ctx.lineJoin = 'round';
            ctx.shadowBlur = 0;
            ctx.shadowColor = 'transparent';

            if (!forceCellFallback && subArea && subArea.shape && subArea.shape.length > 2) {
                // Rendu Doflex Pixel-Perfect via Shape officielle
                const shape = subArea.shape;
                let isFirstPoint = true;
                
                ctx.beginPath();
                for (let i = 0; i < shape.length; i += 2) {
                    const gx = shape[i];
                    const gy = shape[i+1];
                    
                    // Délimitation de nouveau polygone si header massif
                    if (Math.abs(gx) > 1000 || Math.abs(gy) > 1000) {
                        if (!isFirstPoint) {
                            ctx.closePath();
                            ctx.fill();
                            ctx.stroke();
                        }
                        ctx.beginPath();
                        isFirstPoint = true;
                        continue;
                    }
                    
                    const pt = toCP(gx, gy);
                    if (isFirstPoint) {
                        ctx.moveTo(pt.x, pt.y);
                        isFirstPoint = false;
                    } else {
                        ctx.lineTo(pt.x, pt.y);
                    }
                }
                if (!isFirstPoint) {
                    ctx.closePath();
                    ctx.fill();
                    ctx.stroke();
                }
            } else {
                // Fallback polygons
                if (mapsInZone) {
                    const polygons = mergeCellEdges(mapsInZone);
                    polygons.forEach(poly => {
                        if (poly.length < 3) return;
                        ctx.beginPath();
                        const first = toCP(poly[0].x, poly[0].y);
                        ctx.moveTo(first.x, first.y);
                        for (let i = 1; i < poly.length; i++) {
                            const pt = toCP(poly[i].x, poly[i].y);
                            ctx.lineTo(pt.x, pt.y);
                        }
                        ctx.closePath();
                        ctx.fill();
                        ctx.stroke();
                    });
                }
            }

            // Quadrillage fin interne à la zone (exactement comme le concurrent Duffus)
            if (mapsInZone && mapsInZone.length > 0) {
                ctx.beginPath();
                ctx.strokeStyle = 'rgba(15, 23, 42, 0.25)';
                ctx.lineWidth = 1;
                for (const m of mapsInZone) {
                    const ctl = toCP(m.x, m.y);
                    const cbr = toCP(m.x + 1, m.y + 1);
                    ctx.strokeRect(Math.round(ctl.x), Math.round(ctl.y), Math.round(cbr.x - ctl.x), Math.round(cbr.y - ctl.y));
                }
            }
            ctx.restore();
        }

        // ── 1b. Archimonstre Highlight (pulsing orange for searched monsters) ──
        const activeHighlights = highlightSubareaIdsRef.current;
        if (activeHighlights.length > 0 && mapsBySubAreaId && subAreasById) {
            const pulse = (Math.sin(Date.now() / 400) + 1) / 2; // 0..1, ~1.25Hz
            const alpha = 0.25 + pulse * 0.35; // 0.25..0.60
            ctx.save();
            ctx.fillStyle = `rgba(251, 146, 60, ${alpha})`;
            ctx.strokeStyle = `rgba(251, 146, 60, ${0.7 + pulse * 0.3})`;
            ctx.lineWidth = 2;
            ctx.lineJoin = 'round';
            ctx.shadowBlur = 12 + pulse * 8;
            ctx.shadowColor = 'rgba(251, 146, 60, 0.8)';

            activeHighlights.forEach((highlightId: number) => {
                const subArea = subAreasById.get(highlightId);
                if (!forceCellFallback && subArea && subArea.shape && subArea.shape.length > 2) {
                    const shape = subArea.shape;
                    let isFirstPoint = true;
                    ctx.beginPath();
                    for (let i = 0; i < shape.length; i += 2) {
                        const gx = shape[i];
                        const gy = shape[i + 1];
                        if (Math.abs(gx) > 1000 || Math.abs(gy) > 1000) {
                            if (!isFirstPoint) { ctx.closePath(); ctx.fill(); ctx.stroke(); }
                            ctx.beginPath();
                            isFirstPoint = true;
                            continue;
                        }
                        const pt = toCP(gx, gy);
                        if (isFirstPoint) { ctx.moveTo(pt.x, pt.y); isFirstPoint = false; }
                        else ctx.lineTo(pt.x, pt.y);
                    }
                    if (!isFirstPoint) { ctx.closePath(); ctx.fill(); ctx.stroke(); }
                } else {
                    const mapsInZone = mapsBySubAreaId.get(highlightId);
                    if (mapsInZone) {
                        const polygons = mergeCellEdges(mapsInZone);
                        polygons.forEach((poly: any) => {
                            if (poly.length < 3) return;
                            ctx.beginPath();
                            const first = toCP(poly[0].x, poly[0].y);
                            ctx.moveTo(first.x, first.y);
                            for (let i = 1; i < poly.length; i++) {
                                const pt = toCP(poly[i].x, poly[i].y);
                                ctx.lineTo(pt.x, pt.y);
                            }
                            ctx.closePath(); ctx.fill(); ctx.stroke();
                        });
                    }
                }
            });
            ctx.restore();
        }

        // ── 1c. Hover cellule individuelle (crochets + badge coordonnées style Duffus) ──
        if (cellKey) {
            const [hx, hy] = cellKey.split(',').map(Number);
            const tl = toCP(hx, hy);
            const br = toCP(hx + 1, hy + 1);
            
            // Dessin des crochets (brackets) aux 4 coins
            const len = 6;
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.95)';
            ctx.lineWidth = 3;
            ctx.beginPath();
            
            // Top Left
            ctx.moveTo(tl.x, tl.y + len); ctx.lineTo(tl.x, tl.y); ctx.lineTo(tl.x + len, tl.y);
            // Top Right
            ctx.moveTo(br.x - len, tl.y); ctx.lineTo(br.x, tl.y); ctx.lineTo(br.x, tl.y + len);
            // Bottom Right
            ctx.moveTo(br.x, br.y - len); ctx.lineTo(br.x, br.y); ctx.lineTo(br.x - len, br.y);
            // Bottom Left
            ctx.moveTo(tl.x + len, br.y); ctx.lineTo(tl.x, br.y); ctx.lineTo(tl.x, br.y - len);
            
            ctx.stroke();
            
            // Légère surbrillance intérieure
            ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
            ctx.fillRect(Math.round(tl.x), Math.round(tl.y), Math.round(br.x - tl.x), Math.round(br.y - tl.y));

            // Badge de coordonnées noir flottant style Duffus
            const coordLabel = `[${hx}, ${hy}]`;
            ctx.font = 'bold 11px Inter, sans-serif';
            const tw = ctx.measureText(coordLabel).width;
            const badgeW = tw + 12;
            const badgeH = 20;
            const badgeX = Math.round(tl.x + (br.x - tl.x) / 2 - badgeW / 2);
            const badgeY = Math.round(tl.y - badgeH - 6);

            ctx.save();
            ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
            ctx.beginPath();
            ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 5);
            ctx.fill();
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
            ctx.lineWidth = 1;
            ctx.stroke();
            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(coordLabel, badgeX + badgeW / 2, badgeY + badgeH / 2 + 1);
            ctx.restore();
        }

        // ── 2. Selection Highlight ──
        if (selectedPosition) {
            const tl = toCP(selectedPosition.x, selectedPosition.y);
            const br = toCP(selectedPosition.x + 1, selectedPosition.y + 1);
            
            // Dessin des crochets (brackets) aux 4 coins
            const len = 5; // longueur du crochet
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.9)';
            ctx.lineWidth = 3;
            ctx.beginPath();
            
            // Top Left
            ctx.moveTo(tl.x, tl.y + len); ctx.lineTo(tl.x, tl.y); ctx.lineTo(tl.x + len, tl.y);
            // Top Right
            ctx.moveTo(br.x - len, tl.y); ctx.lineTo(br.x, tl.y); ctx.lineTo(br.x, tl.y + len);
            // Bottom Right
            ctx.moveTo(br.x, br.y - len); ctx.lineTo(br.x, br.y); ctx.lineTo(br.x - len, br.y);
            // Bottom Left
            ctx.moveTo(tl.x + len, br.y); ctx.lineTo(tl.x, br.y); ctx.lineTo(tl.x, br.y - len);
            
            ctx.stroke();

            ctx.fillStyle = 'rgba(56, 189, 248, 0.25)';
            ctx.fillRect(Math.round(tl.x), Math.round(tl.y), Math.round(br.x - tl.x), Math.round(br.y - tl.y));
        }

        // ── 3. Guess Results ──
        if (guessResult?.target && guessResult.target.worldMap === world.id) {
            const t = guessResult.target;
            const targetTL = toCP(t.x, t.y);
            const targetBR = toCP(t.x + 1, t.y + 1);
            const p1 = { x: (targetTL.x + targetBR.x) / 2, y: (targetTL.y + targetBR.y) / 2 };

            const markerSize = isMiniMap ? 12 : 2;
            ctx.shadowBlur = 15;
            ctx.shadowColor = 'rgba(239, 68, 68, 0.9)';
            ctx.strokeStyle = '#ef4444';
            ctx.lineWidth = isMiniMap ? 4 : 2;

            if (isMiniMap) {
                const pulse = (Math.sin(Date.now() / 200) + 1) / 2;
                const sz = markerSize + (pulse * 4);
                ctx.beginPath();
                ctx.moveTo(p1.x - sz, p1.y); ctx.lineTo(p1.x + sz, p1.y);
                ctx.moveTo(p1.x, p1.y - sz); ctx.lineTo(p1.x, p1.y + sz);
                ctx.stroke();
                ctx.lineWidth = 2;
                ctx.beginPath(); ctx.arc(p1.x, p1.y, sz * 0.7, 0, Math.PI * 2); ctx.stroke();
            } else {
                ctx.strokeRect(Math.round(targetTL.x), Math.round(targetTL.y), Math.round(targetBR.x - targetTL.x), Math.round(targetBR.y - targetTL.y));
                ctx.fillStyle = 'rgba(239, 68, 68, 0.2)';
                ctx.fillRect(Math.round(targetTL.x), Math.round(targetTL.y), Math.round(targetBR.x - targetTL.x), Math.round(targetBR.y - targetTL.y));
            }

            ctx.font = 'bold 10px Inter, sans-serif';
            const tLabel = `(${t.x}, ${t.y})`;
            const tTw = ctx.measureText(tLabel).width;
            ctx.shadowBlur = 5; ctx.shadowColor = 'black';
            ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
            const tMargin = isMiniMap ? 14 : Math.round((targetBR.y - targetTL.y) / 2) + 4;
            const tDrawBelow = (p1.y + tMargin + 18) <= size.y - 10;
            const tRectY = tDrawBelow ? p1.y + tMargin : p1.y - tMargin - 18;
            ctx.beginPath(); ctx.roundRect(p1.x - tTw / 2 - 6, tRectY, tTw + 12, 18, 4); ctx.fill();
            ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 1; ctx.stroke();
            ctx.fillStyle = '#ef4444'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText(tLabel, p1.x, tRectY + 9);

            const drawGuessLine = (g: any, isMe: boolean, playerName?: string) => {
                const guessWorldId = g.worldId || g.worldMap;
                if (guessWorldId !== undefined && guessWorldId !== world.id && guessWorldId !== world.worldMap) return;

                const guessTL = toCP(g.x, g.y);
                const guessBR = toCP(g.x + 1, g.y + 1);
                const p2 = { x: (guessTL.x + guessBR.x) / 2, y: (guessTL.y + guessBR.y) / 2 };

                if (isMe) {
                    // Ligne dorée et badge de distance uniquement pour le joueur local (évite la toile d'araignée)
                    ctx.save();
                    ctx.shadowBlur = 20;
                    ctx.shadowColor = 'rgba(251, 191, 36, 0.9)';
                    ctx.beginPath();
                    ctx.setLineDash([6, 4]);
                    ctx.strokeStyle = '#fbbf24';
                    ctx.lineWidth = 4;
                    ctx.moveTo(p1.x, p1.y);
                    ctx.lineTo(p2.x, p2.y);
                    ctx.stroke();
                    ctx.restore();

                    // Point central & marqueur
                    ctx.fillStyle = '#10b981';
                    ctx.beginPath(); ctx.arc(p2.x, p2.y, 6, 0, Math.PI * 2); ctx.fill();
                    ctx.strokeStyle = 'white'; ctx.lineWidth = 2; ctx.stroke();

                    // Badge de distance au milieu de la ligne
                    const dist = Math.round(g.distance || 0);
                    const label = `${dist} maps`;
                    ctx.font = 'bold 12px Inter, sans-serif';
                    const tw = ctx.measureText(label).width;
                    const mx = (p1.x + p2.x) / 2;
                    const my = (p1.y + p2.y) / 2;
                    ctx.shadowBlur = 10; ctx.shadowColor = 'black';
                    ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
                    ctx.beginPath(); ctx.roundRect(mx - tw / 2 - 8, my - 12, tw + 16, 24, 6); ctx.fill();
                    ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 1.5; ctx.stroke();
                    ctx.fillStyle = '#fbbf24'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                    ctx.fillText(label, mx, my + 1);

                    // Coordonnées du choix
                    ctx.font = 'bold 10px Inter, sans-serif';
                    const gLabel = `(${g.x}, ${g.y})`;
                    const gTw = ctx.measureText(gLabel).width;
                    const gMargin = isMiniMap ? 14 : Math.round((guessBR.y - guessTL.y) / 2) + 4;
                    const gDrawBelow = (p2.y + gMargin + 18) <= size.y - 10;
                    const gRectY = gDrawBelow ? p2.y + gMargin : p2.y - gMargin - 18;
                    ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
                    ctx.beginPath(); ctx.roundRect(p2.x - gTw / 2 - 6, gRectY, gTw + 12, 18, 4); ctx.fill();
                    ctx.strokeStyle = '#10b981'; ctx.lineWidth = 1; ctx.stroke();
                    ctx.fillStyle = '#10b981'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                    ctx.fillText(gLabel, p2.x, gRectY + 9);
                } else {
                    // Autres joueurs : pastille élégante avec nom sans tracer de ligne traversante
                    ctx.save();
                    ctx.fillStyle = 'rgba(99, 102, 241, 0.9)';
                    ctx.shadowBlur = 8;
                    ctx.shadowColor = 'rgba(99, 102, 241, 0.6)';
                    ctx.beginPath(); ctx.arc(p2.x, p2.y, 5, 0, Math.PI * 2); ctx.fill();
                    ctx.strokeStyle = 'white'; ctx.lineWidth = 1.5; ctx.stroke();
                    ctx.restore();

                    const otherLabel = playerName ? `${playerName} (${g.x}, ${g.y})` : `(${g.x}, ${g.y})`;
                    ctx.font = 'bold 9px Inter, sans-serif';
                    const oTw = ctx.measureText(otherLabel).width;
                    const oRectY = p2.y - 20;
                    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
                    ctx.beginPath(); ctx.roundRect(p2.x - oTw / 2 - 5, oRectY, oTw + 10, 16, 4); ctx.fill();
                    ctx.strokeStyle = 'rgba(99, 102, 241, 0.6)'; ctx.lineWidth = 1; ctx.stroke();
                    ctx.fillStyle = '#a5b4fc'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                    ctx.fillText(otherLabel, p2.x, oRectY + 8);
                }
            };

            if (participants && participants.length > 0) {
                // 1. D'abord les autres joueurs
                participants.forEach((p: any) => {
                    const isMe = String(p.userId) === String(currentUserId);
                    if (!isMe && p.lastGuess && !p.lastGuess.hidden) {
                        drawGuessLine(p.lastGuess, false, p.userName);
                    }
                });
                // 2. Ensuite le joueur local par-dessus
                const me = participants.find((p: any) => String(p.userId) === String(currentUserId));
                if (me?.lastGuess && !me.lastGuess.hidden) {
                    drawGuessLine(me.lastGuess, true, me.userName);
                } else if (guessResult.guess) {
                    drawGuessLine(guessResult.guess, true);
                }
            } else if (guessResult.guess) {
                drawGuessLine(guessResult.guess, true);
            }
        }

        // ── 4. Debug Grid (cases individuelles, seulement si showDebugGrid) ──
        if (!showDebugGrid || isMiniMap) {
            // No grid drawing, but clear has already been done above
            return;
        }

        const geoBounds = map.getBounds();
        const nw = geoBounds.getNorthWest();
        const se = geoBounds.getSouthEast();

        const g1X = (nw.lng - ox) / mw;
        const g2X = (se.lng - ox) / mw;
        const g1Y = (-nw.lat - oy) / mh;
        const g2Y = (-se.lat - oy) / mh;

        const minGX = Math.floor(Math.min(g1X, g2X)) - 1;
        const maxGX = Math.ceil(Math.max(g1X, g2X)) + 1;
        const minGY = Math.floor(Math.min(g1Y, g2Y)) - 1;
        const maxGY = Math.ceil(Math.max(g1Y, g2Y)) + 1;

        ctx.beginPath();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
        ctx.lineWidth = 1.5;

        for (let gx = minGX; gx <= maxGX + 1; gx++) {
            const p = toCP(gx, 0);
            ctx.moveTo(Math.round(p.x), 0);
            ctx.lineTo(Math.round(p.x), size.y);
        }

        for (let gy = minGY; gy <= maxGY + 1; gy++) {
            const p = toCP(0, gy);
            ctx.moveTo(0, Math.round(p.y));
            ctx.lineTo(size.x, Math.round(p.y));
        }
        ctx.stroke();

        // Labels de coordonnées sur la grille debug
        ctx.font = 'bold 9px Inter, sans-serif';
        // L'affichage du texte des coordonnées en mode debug a été supprimé à la demande de l'utilisateur.
    }, [map, activeWorld, mapsByCoords, mapsBySubAreaId, subAreasById, showDebugGrid, isMiniMap, guessResult, selectedPosition, participants, currentUserId, highlightSubareaIds, zoneHighlight]);

    // ── Sync highlight ref : pulsation à 4 Hz (avant : RAF à 60 fps en continu
    // dès qu'une recherche surlignait des zones → main thread saturé en permanence).
    useEffect(() => {
        const ids: number[] = highlightSubareaIds || [];
        highlightSubareaIdsRef.current = ids;

        if (ids.length > 0) {
            drawGrid();
            const timer = setInterval(drawGrid, 250);
            return () => clearInterval(timer);
        }
        drawGrid(); // Clear the highlight
    }, [highlightSubareaIds, drawGrid]);



    // Redessine sur les mouvements de carte — UN SEUL handler rAF-throttled.
    // (Avant : deux useMapEvents move/zoom en parallèle, dont un synchrone →
    // 2-3 drawGrid par frame pendant pan/zoom + réallocation canvas à chaque fois,
    // ce qui affamait le compositeur et faisait clignoter toute la page sur Opera GX.)
    const scheduleDraw = useCallback(() => {
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        rafRef.current = requestAnimationFrame(() => {
            rafRef.current = 0;
            drawGrid();
        });
    }, [drawGrid]);

    // Annule le rAF pendant à la sortie (anti-fuite + anti-dessin sur canvas détaché)
    useEffect(() => {
        return () => {
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
        };
    }, []);

    useEffect(() => {
        drawGrid();
    }, [showDebugGrid, drawGrid, selectedPosition, guessResult, participants, currentUserId]);

    useMapEvents({
        move: scheduleDraw,
        zoom: scheduleDraw,
        resize: scheduleDraw,
        moveend: () => drawGrid(),
        zoomend: () => drawGrid(),
    });

    // Helper Zaap le plus proche
    const getClosestZaap = useCallback((gx: number, gy: number) => {
        if (!zaaps || zaaps.length === 0) return null;
        let closest = null;
        let minDist = Infinity;
        for (const z of zaaps) {
            const d = Math.abs(z.x - gx) + Math.abs(z.y - gy);
            if (d < minDist) {
                minDist = d;
                closest = { ...z, dist: d };
            }
        }
        return closest;
    }, [zaaps]);

    // Mise à jour directe du HUD DOM (zéro re-render React pour les perfs)
    const updateHudDOM = useCallback((mapData: any, subArea: any, gx: number, gy: number, isPinned: boolean) => {
        const zoneName = subArea ? (subArea.name?.fr || subArea.name || 'Zone Inconnue') : 'Zone Inconnue';

        // ── Support Overlay HUD (composant discret centré en bas) ──
        const overlayHud = document.getElementById('sigil-overlay-hover-hud');
        if (overlayHud) {
            const overlayZone = document.getElementById('sigil-overlay-hover-zone');
            const overlayCoords = document.getElementById('sigil-overlay-hover-coords');
            const overlayPin = document.getElementById('sigil-overlay-hover-pin');
            if (overlayZone) overlayZone.innerText = zoneName;
            if (overlayCoords) overlayCoords.innerText = `[${gx}, ${gy}]`;
            if (overlayPin) overlayPin.style.display = isPinned ? 'inline' : 'none';
            overlayHud.style.display = 'flex';
        }

        // ── Support Mode Normal : Grand bandeau HD centré en bas ──
        const hud = document.getElementById('sigil-map-hover-hud');
        if (!hud) return;

        const zoneSpan = document.getElementById('sigil-map-hover-zone');
        const coordsSpan = document.getElementById('sigil-map-hover-coords');
        const worldSpan = document.getElementById('sigil-map-hover-world');
        const imgEl = document.getElementById('sigil-map-hover-img') as HTMLImageElement | null;
        const zaapContainer = document.getElementById('sigil-map-hover-zaap-container');
        const zaapNameEl = document.getElementById('sigil-map-hover-zaap-name');
        const zaapDistEl = document.getElementById('sigil-map-hover-zaap-dist');
        const zaapBtn = document.getElementById('sigil-map-hover-zaap-btn') as HTMLButtonElement | null;
        const analyzeBtn = document.getElementById('sigil-map-hover-analyze-btn') as HTMLButtonElement | null;
        const pinnedBadge = document.getElementById('sigil-map-hover-pinned-badge');
        const closeBtn = document.getElementById('sigil-map-hover-close-btn');

        // 1. Textes de zone et coordonnées
        if (zoneSpan) zoneSpan.innerText = zoneName;
        if (worldSpan) worldSpan.innerText = activeWorld?.name?.fr || activeWorld?.name || 'Monde des Douze';
        if (coordsSpan) coordsSpan.innerText = `[${gx}, ${gy}]`;

        // 2. Miniature HD
        if (imgEl && mapData?.id) {
            imgEl.src = `/game-data/hd_maps/${mapData.id}.webp`;
        }

        // 3. Zaap le plus proche
        const closestZaap = getClosestZaap(gx, gy);
        if (closestZaap && zaapContainer && zaapNameEl && zaapDistEl && zaapBtn) {
            zaapContainer.style.display = 'flex';
            zaapNameEl.innerText = `${closestZaap.name} [${closestZaap.x}, ${closestZaap.y}]`;
            zaapDistEl.innerText = `(${closestZaap.dist} ${closestZaap.dist <= 1 ? 'map' : 'maps'})`;
            zaapBtn.dataset.zaapX = String(closestZaap.x);
            zaapBtn.dataset.zaapY = String(closestZaap.y);
        } else if (zaapContainer) {
            zaapContainer.style.display = 'none';
        }

        // 4. Bouton Analyser (stockage des coordonnées pour le clic)
        if (analyzeBtn) {
            analyzeBtn.dataset.x = String(gx);
            analyzeBtn.dataset.y = String(gy);
            analyzeBtn.dataset.mapId = String(mapData?.id || '');
            analyzeBtn.dataset.subAreaId = String(mapData?.subAreaId || '');
        }

        // 5. Badge "Case fixée" & Bouton Détacher (✕)
        if (pinnedBadge) {
            pinnedBadge.style.display = isPinned ? 'inline-flex' : 'none';
        }
        if (closeBtn) {
            closeBtn.style.display = isPinned ? 'flex' : 'none';
        }

        hud.style.display = 'flex';
    }, [activeWorld, getClosestZaap]);

    // Ref pour éviter les re-renders pendant le survol
    const selectedPositionRef = useRef(selectedPosition);
    useEffect(() => {
        selectedPositionRef.current = selectedPosition;
        if (selectedPosition && !isMiniMap) {
            const exactMap = selectedPosition.mapId
                ? (mapsByCoords?.get(`${selectedPosition.x},${selectedPosition.y}`) || { id: selectedPosition.mapId, subAreaId: selectedPosition.subAreaId })
                : mapsByCoords?.get(`${selectedPosition.x},${selectedPosition.y}`);
            const subArea = exactMap?.subAreaId ? subAreasById?.get(exactMap.subAreaId) : null;
            updateHudDOM(exactMap, subArea, selectedPosition.x, selectedPosition.y, true);
        } else {
            const pinnedBadge = document.getElementById('sigil-map-hover-pinned-badge');
            const closeBtn = document.getElementById('sigil-map-hover-close-btn');
            if (pinnedBadge) pinnedBadge.style.display = 'none';
            if (closeBtn) closeBtn.style.display = 'none';
            const overlayPin = document.getElementById('sigil-overlay-hover-pin');
            if (overlayPin) overlayPin.style.display = 'none';
            if (!hoveredCellRef.current && (!isOverHudRef || !isOverHudRef.current)) {
                const hud = document.getElementById('sigil-map-hover-hud');
                if (hud) hud.style.display = 'none';
                const overlayHud = document.getElementById('sigil-overlay-hover-hud');
                if (overlayHud) overlayHud.style.display = 'none';
            }
        }
        drawGrid();
    }, [selectedPosition, isMiniMap, mapsByCoords, subAreasById, updateHudDOM, isOverHudRef, drawGrid]);

    // Raccourci Échap pour déverrouiller la case sélectionnée
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && selectedPositionRef.current) {
                if (setSelectedPosition) setSelectedPosition(null);
                const hud = document.getElementById('sigil-map-hover-hud');
                if (hud && (!isOverHudRef || !isOverHudRef.current)) hud.style.display = 'none';
                const overlayHud = document.getElementById('sigil-overlay-hover-hud');
                if (overlayHud && (!isOverHudRef || !isOverHudRef.current)) overlayHud.style.display = 'none';
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [setSelectedPosition, isOverHudRef]);

    // Survol (HUD DOM direct, zéro setState React)
    useMapEvents({
        mousemove: (e) => {
            // Si un timer de masquage était en cours suite à une sortie de map, on l'annule immédiatement
            if (mouseoutTimerRef.current) {
                clearTimeout(mouseoutTimerRef.current);
                mouseoutTimerRef.current = null;
            }

            // Si la souris est au-dessus du bandeau HUD lui-même : NE RIEN ÉCRASER
            if (isOverHudRef && isOverHudRef.current) return;

            const world = activeWorld;
            if (!world) return;
            const gx0 = Math.floor((e.latlng.lng - world.origineX) / world.mapWidth);
            const gy0 = Math.floor((-e.latlng.lat - world.origineY) / world.mapHeight);

            // Sur la carte normale (exploration), aucun snap dans le vide ! On teste la case exacte.
            // En minimap (Geoguesser), tolérance courte (maxR = 2).
            const mapData = isMiniMap
                ? findNearestMap(mapsByCoords, gx0, gy0, 2).foundMap
                : mapsByCoords?.get(`${gx0},${gy0}`);

            const subArea = mapData?.subAreaId ? subAreasById?.get(mapData.subAreaId) : null;
            const isValidZone = !!mapData && !!subArea;

            const mapContainer = map.getContainer();

            // Si hors zone identifiée (océan, vide, hors map)
            if (!isValidZone) {
                if (hoveredCellRef.current !== null) {
                    hoveredCellRef.current = null;
                    hoveredSubAreaIdRef.current = null;
                    drawGrid();
                }
                // Si aucune case n'est fixée et qu'on n'est pas sur le HUD, on masque
                if (!selectedPositionRef.current && (!isOverHudRef || !isOverHudRef.current)) {
                    const hud = document.getElementById('sigil-map-hover-hud');
                    if (hud) hud.style.display = 'none';
                    const overlayHud = document.getElementById('sigil-overlay-hover-hud');
                    if (overlayHud) overlayHud.style.display = 'none';
                }
                if (mapContainer && !isMiniMap) {
                    mapContainer.style.cursor = '';
                }
                return;
            }

            if (mapContainer && !isMiniMap) {
                mapContainer.style.cursor = 'pointer';
            }

            const gx = gx0;
            const gy = gy0;
            const key = `${gx},${gy}`;
            const subAreaId = mapData.subAreaId;

            if (key !== hoveredCellRef.current || subAreaId !== hoveredSubAreaIdRef.current) {
                hoveredCellRef.current = key;
                hoveredSubAreaIdRef.current = subAreaId;
                if (rafRef.current) cancelAnimationFrame(rafRef.current);
                rafRef.current = requestAnimationFrame(drawGrid);
                
                // IMPORTANT : Si une case est verrouillée / sélectionnée, le HUD reste fixé dessus
                // pour permettre à l'utilisateur de déplacer sa souris tranquillement jusqu'au bouton Analyser !
                if (selectedPositionRef.current) return;

                // Mode survol libre
                updateHudDOM(mapData, subArea, gx, gy, false);
            }
        },
        mouseout: () => {
            // Débounce de 180ms pour éviter le clignotement / disparition quand le curseur
            // transite de la carte vers le bandeau HUD ou franchit les bordures
            if (mouseoutTimerRef.current) clearTimeout(mouseoutTimerRef.current);
            mouseoutTimerRef.current = setTimeout(() => {
                mouseoutTimerRef.current = null;
                // Ne pas masquer si la souris est en train de survoler le bandeau HUD !
                if (isOverHudRef && isOverHudRef.current) return;
                // Ne pas masquer si une case est fixée !
                if (selectedPositionRef.current) return;

                if (hoveredCellRef.current !== null) {
                    hoveredCellRef.current = null;
                    hoveredSubAreaIdRef.current = null;
                    drawGrid();
                }
                const hud = document.getElementById('sigil-map-hover-hud');
                if (hud) hud.style.display = 'none';
                const overlayHud = document.getElementById('sigil-overlay-hover-hud');
                if (overlayHud) overlayHud.style.display = 'none';
                const mapContainer = map.getContainer();
                if (mapContainer && !isMiniMap) {
                    mapContainer.style.cursor = '';
                }
            }, 180);
        }
    });

    // Initial draw + redraw on world change
    useEffect(() => {
        const t = setTimeout(drawGrid, 100);
        return () => clearTimeout(t);
    }, [drawGrid]);

    return null;
}

function MapNarrativeGPS({ activeWorld, triggerCoords, triggerWorldId, currentWorldId }: any) {
    const map = useMap();
    if (!triggerCoords || !activeWorld) return null;
    
    // Only show pulse if we are on the correct world for this trigger
    if (triggerWorldId !== undefined && triggerWorldId !== currentWorldId) return null;

    const lat = -(activeWorld.origineY + triggerCoords.y * activeWorld.mapHeight + activeWorld.mapHeight / 2);
    const lng = activeWorld.origineX + triggerCoords.x * activeWorld.mapWidth + activeWorld.mapWidth / 2;

    const icon = L.divIcon({
        className: 'gps-pulse-marker',
        html: `
            <div class="relative flex items-center justify-center w-12 h-12">
                <div class="absolute w-12 h-12 bg-emerald-500/40 rounded-full gps-pulse-outer"></div>
                <div class="absolute w-8 h-8 bg-emerald-500/60 rounded-full animate-pulse blur-sm"></div>
                <div class="relative w-3.5 h-3.5 bg-emerald-400 rounded-full border-2 border-border "></div>
            </div>
        `,
        iconSize: [48, 48],
        iconAnchor: [24, 24]
    });

    return <Marker position={[lat, lng]} icon={icon} interactive={false} />;
}

// -------------------------------------------------------------------------------------
// Fix Resize Issue & Autocenter Result
// -------------------------------------------------------------------------------------
// Pré-charge les tuiles de la zone cible (réduit le flash au dézoom du rendu de distance)
function prefetchTilesForBounds(map: any, world: any, bounds: any) {
    if (!world || !bounds || typeof window === 'undefined') return;
    const tileSize = world.id === 1 ? 256 : 250;
    const zoom = Math.round(map.getBoundsZoom(bounds, false));
    const { scale, bank } = resolveTileBank(world.zoom || [1], zoom);
    const apiCols = world.id === 1 ? Math.round((world.totalWidth * scale) / tileSize) : Math.ceil((world.totalWidth * scale) / tileSize);
    const apiRows = world.id === 1 ? Math.round((world.totalHeight * scale) / tileSize) : Math.ceil((world.totalHeight * scale) / tileSize);

    const nw = bounds.getNorthWest();
    const se = bounds.getSouthEast();
    const nwPx = map.project(nw, zoom);
    const sePx = map.project(se, zoom);
    const minX = Math.floor(nwPx.x / tileSize);
    const maxX = Math.floor(sePx.x / tileSize);
    const minY = Math.floor(nwPx.y / tileSize);
    const maxY = Math.floor(sePx.y / tileSize);

    for (let ty = minY; ty <= maxY; ty++) {
        for (let tx = minX; tx <= maxX; tx++) {
            if (tx < 0 || tx >= apiCols || ty < 0 || ty >= apiRows) continue;
            const index = ty * apiCols + tx + 1;
            const url = `/game-data/tiles/w${world.id}/${bank}/${index}.webp`;
            const img = new window.Image();
            img.src = url;
        }
    }
}

function MapViewHandler({ isMiniMap, guessResult, activeWorld, minimapZoomLevel, minimapRecenterTrigger, participants }: any) {
    const map = useMap();

    const lastFittedKeyRef = useRef<string>("");

    useEffect(() => {
        const handleResize = () => map.invalidateSize();
        const t1 = setTimeout(handleResize, 100);
        const t2 = setTimeout(handleResize, 450);
        window.addEventListener('resize', handleResize);

        // ResizeObserver : recalcule la taille de la carte dès que son conteneur change de
        // dimensions (bascule plein écran ↔ mode normal de #worldmap-page, panneau latéral
        // Opti-Farm qui s'ouvre/ferme, etc.). Sans cela, Leaflet conserve les tuiles
        // dimensionnées pour l'ancien conteneur → fragments « micro aperçu » / tuiles
        // décalées après avoir quitté le plein écran.
        const container = map.getContainer();
        let raf = 0;
        const ro = typeof ResizeObserver !== 'undefined'
            ? new ResizeObserver(() => {
                cancelAnimationFrame(raf);
                raf = requestAnimationFrame(() => map.invalidateSize());
            })
            : null;
        if (ro && container) ro.observe(container);

        return () => {
            clearTimeout(t1);
            clearTimeout(t2);
            window.removeEventListener('resize', handleResize);
            if (ro) {
                ro.disconnect();
                cancelAnimationFrame(raf);
            }
        };
    }, [map]);

    // Recenter map automatically when the active world changes
    // BUT only if we don't have a specific quest/trigger position to focus on
    useEffect(() => {
        if (activeWorld && map && !participants) { 
            // If we have a triggerCenterPosition pending, we let that handler or initial mount take care of it
            const hasTrigger = (map as any)._hasTriggeredOnce;
            if (hasTrigger) return;

            const world = activeWorld;
            const targetLat = -(world.totalHeight / 2);
            const targetLng = world.totalWidth / 2;

            // SetView is immediate which feels better when switching worlds than flyTo
            map.setView([targetLat, targetLng], isMiniMap ? -3 : 0, { animate: false });
        }
    }, [activeWorld, map, isMiniMap, participants]);

    // Manual Zoom Control for MiniMap
    useEffect(() => {
        if (isMiniMap && minimapZoomLevel !== undefined) {
            map.setZoom(minimapZoomLevel);
        }
    }, [isMiniMap, minimapZoomLevel, map]);

    // Recenter (Home) logic
    useEffect(() => {
        if (minimapRecenterTrigger && activeWorld) {
            const world = activeWorld;
            // Recenter on target if exists, else on origin
            if (guessResult?.target) {
                const { target } = guessResult;
                map.flyTo([-(world.origineY + target.y * world.mapHeight + world.mapHeight / 2), world.origineX + target.x * world.mapWidth + world.mapWidth / 2], -2);
            } else {
                // Correct center: absolute middle of the world image
                map.flyTo([-world.totalHeight / 2, world.totalWidth / 2], -3);
            }
        }
    }, [minimapRecenterTrigger, map, activeWorld, guessResult]);

    useEffect(() => {
        if (!isMiniMap || !activeWorld || !map) return;
        
        const world = activeWorld;
        const target = guessResult?.target;
        if (!target) return;

        // Clé unique pour n'ajuster la vue qu'une seule fois par round (évite le clignotement noir répétitif)
        const fitKey = `${target.worldMap || world.id}_${target.x}_${target.y}_${participants?.length || 0}`;
        if (lastFittedKeyRef.current === fitKey) return;
        lastFittedKeyRef.current = fitKey;

        const points: L.LatLng[] = [];
        points.push(L.latLng(-(world.origineY + target.y * world.mapHeight + world.mapHeight / 2), world.origineX + target.x * world.mapWidth + world.mapWidth / 2));

        if (participants && participants.length > 0) {
            participants.forEach((p: any) => {
                if (p.lastGuess && !p.lastGuess.hidden) {
                    points.push(L.latLng(-(world.origineY + p.lastGuess.y * world.mapHeight + world.mapHeight / 2), world.origineX + p.lastGuess.x * world.mapWidth + world.mapWidth / 2));
                }
            });
        } else if (guessResult?.guess) {
            points.push(L.latLng(-(world.origineY + guessResult.guess.y * world.mapHeight + world.mapHeight / 2), world.origineX + guessResult.guess.x * world.mapWidth + world.mapWidth / 2));
        }

        if (points.length >= 2) {
            const bounds = L.latLngBounds(points);
            // #182 fix: centrer d'abord sur la cible pour pré-charger les tiles,
            // puis ajuster la vue. Sans ça, un fitBounds sur grande distance
            // dézoome trop → fond noir car tiles non chargées.
            const targetLatLng = L.latLng(-(world.origineY + target.y * world.mapHeight + world.mapHeight / 2), world.origineX + target.x * world.mapWidth + world.mapWidth / 2);
            map.setView(targetLatLng, -2, { animate: false });
            setTimeout(() => {
                if (isMiniMap) {
                    // minZoom=-4 : évite le dézoom excessif sur grande distance
                    map.fitBounds(bounds, { padding: [40, 40], maxZoom: -1, animate: false });
                    const curZoom = map.getZoom();
                    if (curZoom < -4) map.setZoom(-4);
                } else {
                    map.flyToBounds(bounds, { padding: [100, 100], duration: 1.2, easeLinearity: 0.25, maxZoom: -1 });
                }
            }, 80);
        } else if (points.length === 1) {
            // Seul point (pas de guess) : centrer sur la cible avec zoom fixe
            setTimeout(() => {
                map.setView(points[0], -2, { animate: false });
            }, 50);
        }
    }, [guessResult, isMiniMap, map, activeWorld, participants]);

    return null;
}

// Tooltip + click interactions (throttled)
// -------------------------------------------------------------------------------------
function MapInteractionHandler({ activeWorld, mapsByCoords, subAreasById, dungeonsByMapId, setSelectedPosition, isMiniMap, isSpectator, hideUI, interactive = true, autoCopyTravel = false, isOverlay = false, onHoverMap, activeCircuit, onOpenZoneDetails }: any) {
    const map = useMap();
    const lastTooltipTime = useRef(0);

    useMapEvents(!interactive ? {} : {
        dblclick: (e) => {
            if (isSpectator || hideUI) return; 
            const world = activeWorld;
            if (!world) return;
            const mapX = e.latlng.lng;
            const mapY = -e.latlng.lat;
            const gameX0 = Math.floor((mapX - world.origineX) / world.mapWidth);
            const gameY0 = Math.floor((mapY - world.origineY) / world.mapHeight);

            const exactMap = mapsByCoords?.get(`${gameX0},${gameY0}`);
            const subArea = exactMap?.subAreaId ? subAreasById?.get(exactMap.subAreaId) : null;
            if (exactMap && subArea && onOpenZoneDetails) {
                onOpenZoneDetails({
                    x: gameX0,
                    y: gameY0,
                    mapId: exactMap.id,
                    subAreaId: exactMap.subAreaId
                });
            }
        },
        mousemove: (e) => {
            if (!activeWorld) return; 

            const now = performance.now();
            if (now - lastTooltipTime.current < TOOLTIP_THROTTLE_MS) {
                return;
            }
            lastTooltipTime.current = now;

            const world = activeWorld;
            const mapX = e.latlng.lng;
            const mapY = -e.latlng.lat;
            const gameX0 = Math.floor((mapX - world.origineX) / world.mapWidth);
            const gameY0 = Math.floor((mapY - world.origineY) / world.mapHeight);

            const mapData = isMiniMap
                ? findNearestMap(mapsByCoords, gameX0, gameY0, 2).foundMap
                : mapsByCoords?.get(`${gameX0},${gameY0}`);
            const subArea = mapData?.subAreaId ? subAreasById?.get(mapData.subAreaId) : null;
            const isValid = !!mapData && !!subArea;

            // Dispatch specifically for HUD if callback exists
            if (onHoverMap) {
                onHoverMap(isValid ? { x: gameX0, y: gameY0, found: true } : null);
            }

            if (!isValid) return;
        },
        mouseout: () => {
            if (onHoverMap) onHoverMap(null);
        },
        click: (e) => {
            if (isSpectator || hideUI) return; 

            const world = activeWorld;
            if (!world) return;
            const mapX = e.latlng.lng;
            const mapY = -e.latlng.lat;
            const gameX0 = Math.floor((mapX - world.origineX) / world.mapWidth);
            const gameY0 = Math.floor((mapY - world.origineY) / world.mapHeight);

            // ── En mode MiniMap (Geoguesser) : snap court (rayon 3) ──
            if (isMiniMap) {
                const { foundMap, gx: gameX, gy: gameY } = findNearestMap(mapsByCoords, gameX0, gameY0, 3);
                if (!foundMap) {
                    toast.error("Position hors carte — Veuillez viser une zone valide du monde !", {
                        id: "geoguesser-void-click",
                        duration: 2000,
                        icon: <Flag className="w-4 h-4 text-rose-500" />
                    });
                    return;
                }
                if (setSelectedPosition) {
                    setSelectedPosition({ x: gameX, y: gameY, displayX: gameX, displayY: gameY, mapId: foundMap.id });
                }
                return;
            }

            // ── En mode Exploration normale : AUCUN clic hors zone identifiée ! ──
            const exactMap = mapsByCoords?.get(`${gameX0},${gameY0}`);
            const subArea = exactMap?.subAreaId ? subAreasById?.get(exactMap.subAreaId) : null;
            const isIdentifiedZone = !!exactMap && !!subArea;

            if (!isIdentifiedZone) {
                // Clic sur l'océan ou zone vide non identifiée : on ferme la sélection si ouverte
                if (setSelectedPosition) {
                    setSelectedPosition(null);
                }
                return;
            }

            // ── Fixer la case pour analyse HD et Zaap dans le bandeau ──
            if (setSelectedPosition) {
                setSelectedPosition({
                    x: gameX0,
                    y: gameY0,
                    displayX: gameX0,
                    displayY: gameY0,
                    mapId: exactMap.id,
                    subAreaId: exactMap.subAreaId
                });
            }

            // ── Copie de la commande /travel si activée ──
            if (activeCircuit || autoCopyTravel) {
                const command = `/travel ${gameX0} ${gameY0}`;
                navigator.clipboard.writeText(command)
                    .then(() => {
                        if (isOverlay) {
                            toast.success(`${command}`, {
                                icon: '📍',
                                duration: 1200,
                                position: 'bottom-right',
                                className: 'text-xs !py-2 !px-3 !min-h-0',
                                description: undefined,
                            });
                        } else {
                            toast.success(`${command} copié !`, {
                                icon: <Rocket className="w-4 h-4 text-emerald-400" />,
                                duration: 1500
                            });
                        }
                    })
                    .catch(() => {
                        toast.error("Échec de la copie au presse-papier.");
                    });
            }
        }
    });

    return null;
}

function ExternalController({ triggerCenterPosition, activeWorld, minimapRecenterTrigger, interactive, initialZoom }: any) {
    const map = useMap();
    const prevTrigger = useRef(minimapRecenterTrigger);
    const hasCentered = useRef(false);

    useEffect(() => {
        if (!triggerCenterPosition || !activeWorld) return;
        const px = activeWorld.origineX + triggerCenterPosition.x * activeWorld.mapWidth + activeWorld.mapWidth / 2;
        const py = activeWorld.origineY + triggerCenterPosition.y * activeWorld.mapHeight + activeWorld.mapHeight / 2;
        
        if (interactive === false) {
            // Mode photo/rendu : setView immédiat sans animation
            const zoom = initialZoom !== undefined ? initialZoom : -1;
            map.setView([-py, px], zoom, { animate: false });
        } else {
            // Mode interactif : flyTo animé
            map.flyTo([-py, px], -1, { duration: 0.5 });
        }
    }, [triggerCenterPosition, activeWorld, map, interactive, initialZoom]);

    useEffect(() => {
        if (minimapRecenterTrigger !== undefined && minimapRecenterTrigger !== prevTrigger.current) {
            const diff = minimapRecenterTrigger - (prevTrigger.current || 0);
            prevTrigger.current = minimapRecenterTrigger;
            
            if (activeWorld) {
                if (Math.abs(diff) > 500) {
                    // It's a zoom command
                    if (diff > 0) {
                        map.setZoom(Math.min(map.getZoom() + 1, map.getMaxZoom()), { animate: true });
                    } else {
                        map.setZoom(Math.max(map.getZoom() - 1, map.getMinZoom()), { animate: true });
                    }
                } else if (triggerCenterPosition) {
                    // Recenter command
                    const px = activeWorld.origineX + triggerCenterPosition.x * activeWorld.mapWidth + activeWorld.mapWidth / 2;
                    const py = activeWorld.origineY + triggerCenterPosition.y * activeWorld.mapHeight + activeWorld.mapHeight / 2;
                    if (interactive === false) {
                        const zoom = initialZoom !== undefined ? initialZoom : -1;
                        map.setView([-py, px], zoom, { animate: false });
                    } else {
                        map.flyTo([-py, px], -1, { duration: 0.5 });
                    }
                }
            }
        }
    }, [minimapRecenterTrigger, map, interactive, initialZoom]);

    return null;
}

function ZoomControls() {
    const map = useMap();
    
    return (
        <div className="absolute bottom-6 right-6 z-[1000] flex flex-col gap-2">
            <button 
                onClick={(e) => {
                    e.stopPropagation();
                    map.setZoom(Math.min(map.getZoom() + 1, map.getMaxZoom()), { animate: true });
                }}
                className="w-10 h-10 rounded-xl bg-surface/80 backdrop-blur-md border border-border flex items-center justify-center text-foreground/40 hover:text-foreground hover:bg-elevated transition-all shadow-xl active:scale-95 group pointer-events-auto"
                title="Zoomer (x2)"
            >
                <Plus size={18} className="group- transition-transform" />
            </button>
            <button 
                onClick={(e) => {
                    e.stopPropagation();
                    map.setZoom(Math.max(map.getZoom() - 1, map.getMinZoom()), { animate: true });
                }}
                className="w-10 h-10 rounded-xl bg-surface/80 backdrop-blur-md border border-border flex items-center justify-center text-foreground/40 hover:text-foreground hover:bg-elevated transition-all shadow-xl active:scale-95 group pointer-events-auto"
                title="Dézoomer (/2)"
            >
                <Minus size={18} className="group- transition-transform" />
            </button>
        </div>
    );
}

// -------------------------------------------------------------------------------------
// Main Component
// -------------------------------------------------------------------------------------
interface LeafletMapCoreProps {
    activeWorld: any | null;
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
    triggerWorldId?: number;
    isMiniMap?: boolean;
    guessResult?: { target: any, guess: any } | null;
    mapsBySubAreaId?: Map<number, any[]>;
    minimapZoomLevel?: number;
    minimapRecenterTrigger?: number;
    participants?: any[];
    currentUserId?: string;
    isSpectator?: boolean;
    hideUI?: boolean;
    interactive?: boolean;
    initialZoom?: number;
    autoCopyTravel?: boolean;
    onHoverMap?: (pos: { x: number, y: number, found: boolean } | null) => void;
    highlightSubareaIds?: number[];
    zoneHighlight?: boolean;
    minZoom?: number;
    zaaps?: any[];
    showZaaps?: boolean;
    selectedHarvestResources?: any[];
    activeCircuit?: any;
    completedHarvestSteps?: Set<number>;
    onToggleHarvestStep?: (stepIdx: number) => void;
    showPassages?: boolean;
    onOpenZoneDetails?: (pos?: { x: number; y: number; mapId?: number; subAreaId?: number }) => void;
    isOverlay?: boolean;
}
export default function LeafletMapCore(props: LeafletMapCoreProps) {
    // Note : le survol met à jour le HUD via DOM direct (pas de setState ici —
    // un état à 10 Hz re-rendait tous les marqueurs donjons à chaque mousemove).

    const {
        activeWorld, selectedWorldId, activeMaps, mapsByCoords, subAreasById,
        dungeonsByMapId, groupedDungeons, showDebugGrid, selectedPosition,
        mapsBySubAreaId, setSelectedPosition, setSelectedDungeon, triggerCenterPosition,
        triggerWorldId, isMiniMap, guessResult, minimapZoomLevel, minimapRecenterTrigger,
         participants, currentUserId, isSpectator, hideUI, interactive = true, 
        autoCopyTravel = false, highlightSubareaIds, initialZoom: initialZoomProp, zoneHighlight,
        zaaps, showZaaps, selectedHarvestResources, activeCircuit, completedHarvestSteps, onToggleHarvestStep,
        showPassages = false, onOpenZoneDetails, isOverlay = false
    } = props;

    const correctedActiveWorld = useMemo(() => {
        if (!activeWorld) return null;
        // Calibration précise du Monde des Douze (id=1) :
        // Le dataset DofusDB calcule mapWidth/mapHeight sur base d'un canevas 10000x8000
        // Mais comme nous affichons des tuiles à 256px (40x32 tiles),
        // Le canevas final est étiré par un facteur de (256/250) = 1.024
        // Il FAUT appliquer ce facteur multiplicatif brut sur TOUTES les constantes de base :
        if (activeWorld.id === 1) {
            return {
                ...activeWorld,
                origineX: activeWorld.origineX * 1.024,
                origineY: activeWorld.origineY * 1.024,
                mapWidth: activeWorld.mapWidth * 1.024,
                mapHeight: activeWorld.mapHeight * 1.024,
                totalWidth: activeWorld.totalWidth * 1.024,
                totalHeight: Math.ceil(activeWorld.totalHeight * 1.024)
            };
        }
        return activeWorld;
    }, [activeWorld]);

    if (!correctedActiveWorld) return null;

    if (typeof window !== 'undefined') {
        (window as any)._activeWorld_for_crs = correctedActiveWorld;
    }

    // Dimension des tuiles du monde en cours pour combler parfaitement les trous
    const tileSize = selectedWorldId === 1 ? 256 : 250;

    // Calculate initial center: quest target if exists, else world center
    const initialCenter = useMemo(() => {
        if (triggerCenterPosition && correctedActiveWorld) {
            const lat = -(correctedActiveWorld.origineY + triggerCenterPosition.y * correctedActiveWorld.mapHeight + correctedActiveWorld.mapHeight / 2);
            const lng = correctedActiveWorld.origineX + triggerCenterPosition.x * correctedActiveWorld.mapWidth + correctedActiveWorld.mapWidth / 2;
            return [lat, lng] as [number, number];
        }
        return [-correctedActiveWorld.totalHeight / 2, correctedActiveWorld.totalWidth / 2] as [number, number];
    }, [triggerCenterPosition, correctedActiveWorld]);

    const initialZoom = useMemo(() => {
        if (initialZoomProp !== undefined) return initialZoomProp;
        if (triggerCenterPosition) return 0; // Standard for quest focus
        return isMiniMap ? -3 : 0;
    }, [triggerCenterPosition, isMiniMap, initialZoomProp]);

    const isOverHudRef = useRef(false);
    const mouseoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    return (
        <div className={cn("w-full h-full relative map-core-wrapper", isMiniMap && "cursor-crosshair")}>
            {/* L'UI de la zone survolée / fixée est mise à jour manuellement pour des raisons de perfs absolues sans re-render */}
            {/* Grand bandeau HD centré en bas : aperçu tuile HD + Zaap proche + infos + Analyser */}
            {!isMiniMap && !hideUI && !isOverlay && (
                <div 
                    id="sigil-map-hover-hud"
                    style={{ display: 'none' }}
                    onMouseEnter={(e) => {
                        e.stopPropagation();
                        isOverHudRef.current = true;
                        if (mouseoutTimerRef.current) {
                            clearTimeout(mouseoutTimerRef.current);
                            mouseoutTimerRef.current = null;
                        }
                    }}
                    onMouseMove={(e) => {
                        e.stopPropagation();
                        isOverHudRef.current = true;
                        if (mouseoutTimerRef.current) {
                            clearTimeout(mouseoutTimerRef.current);
                            mouseoutTimerRef.current = null;
                        }
                    }}
                    onMouseLeave={() => {
                        isOverHudRef.current = false;
                        if (!selectedPosition) {
                            const hud = document.getElementById('sigil-map-hover-hud');
                            if (hud) hud.style.display = 'none';
                        }
                    }}
                    className={cn(
                        "absolute bottom-5 left-1/2 -translate-x-1/2 z-[1000] pointer-events-auto flex max-w-[96vw] items-center gap-2.5 rounded-xl border border-white/10 bg-[#05070f]/95 p-2.5 shadow-[0_16px_40px_rgba(0,0,0,0.85)] backdrop-blur-xl"
                    )}
                >
                    {/* 1. Aperçu HD de la tuile survolée (clic = Analyser) */}
                    <div
                        className="relative h-24 w-36 shrink-0 cursor-pointer overflow-hidden rounded-lg border border-white/10 bg-black/60 hover:border-white/25 sm:h-28 sm:w-44"
                        title="Cliquer pour analyser cette tuile"
                        onClick={() => {
                            const btn = document.getElementById('sigil-map-hover-analyze-btn') as HTMLButtonElement | null;
                            if (btn) btn.click();
                        }}
                    >
                        <img
                            id="sigil-map-hover-img"
                            alt="Aperçu HD"
                            className="h-full w-full object-cover"
                            onError={(e) => {
                                (e.target as HTMLImageElement).src = '/assets/dofus/map-layers/icon-dungeon-bright.png';
                            }}
                        />
                        <span className="absolute bottom-1 left-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-medium text-white/70">
                            Aperçu HD
                        </span>
                    </div>

                    <div className="h-8 w-px shrink-0 bg-white/10" />

                    {/* 2. Une seule rangée : zone, monde, coordonnées, case fixée, Zaap */}
                    <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                        <span id="sigil-map-hover-zone" className="max-w-[220px] truncate text-sm font-semibold text-white" />
                        <span className="inline-flex h-7 shrink-0 items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2 text-[11px] font-medium text-white/60">
                            <Compass size={11} className="shrink-0 opacity-70" />
                            <span id="sigil-map-hover-world" />
                        </span>
                        <span className="inline-flex h-7 shrink-0 items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2 text-[11px] font-medium text-white/60">
                            <Rocket size={11} className="shrink-0 opacity-70" />
                            <span id="sigil-map-hover-coords" className="font-mono text-white/90" />
                        </span>
                        <span
                            id="sigil-map-hover-pinned-badge"
                            style={{ display: 'none' }}
                            className="h-7 shrink-0 items-center gap-1 rounded-md border border-white/15 bg-white/10 px-2 text-[11px] font-medium text-white/80"
                        >
                            <Pin size={11} className="shrink-0" />
                            Case fixée
                        </span>
                        <div id="sigil-map-hover-zaap-container" className="flex shrink-0 items-center gap-1.5">
                            <span className="inline-flex h-7 items-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-2 text-[11px] font-medium text-white/60">
                                <img src="/assets/dofus/map-layers/icon-zaap-bright.png" alt="Zaap" className="h-3.5 w-3.5 shrink-0 object-contain" />
                                <span className="text-white/45">Zaap</span>
                                <span id="sigil-map-hover-zaap-name" className="max-w-[160px] truncate text-white/90" />
                                <span id="sigil-map-hover-zaap-dist" className="text-white/45" />
                            </span>
                            <button
                                id="sigil-map-hover-zaap-btn"
                                type="button"
                                className="inline-flex h-7 shrink-0 items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2 text-[11px] font-medium text-white/70 transition-colors hover:bg-white/10 hover:text-white cursor-pointer"
                                title="Copier la commande /travel vers ce Zaap"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    const btn = e.currentTarget as HTMLButtonElement;
                                    const zx = btn.dataset.zaapX;
                                    const zy = btn.dataset.zaapY;
                                    if (zx && zy) {
                                        const cmd = `/travel ${zx} ${zy}`;
                                        navigator.clipboard.writeText(cmd);
                                        toast.success(`${cmd} copié !`, { icon: '📍' });
                                    }
                                }}
                            >
                                <Copy size={11} />
                                /travel
                            </button>
                        </div>
                    </div>

                    <div className="h-8 w-px shrink-0 bg-white/10" />

                    {/* 3. Action primaire : la seule couleur de l'encart */}
                    <button
                        id="sigil-map-hover-analyze-btn"
                        type="button"
                        className="inline-flex h-8 shrink-0 items-center gap-2 rounded-lg bg-amber-500 px-4 text-xs font-semibold text-black transition-colors hover:bg-amber-400 active:scale-[0.98] cursor-pointer"
                        title="Analyser les détails de la zone"
                        onClick={(e) => {
                            e.stopPropagation();
                            const btn = e.currentTarget as HTMLButtonElement;
                            const x = Number(btn.dataset.x);
                            const y = Number(btn.dataset.y);
                            const mapId = Number(btn.dataset.mapId);
                            const subAreaId = Number(btn.dataset.subAreaId);
                            if (onOpenZoneDetails) {
                                onOpenZoneDetails({ x, y, mapId, subAreaId });
                            }
                        }}
                    >
                        <Layers size={14} />
                        Analyser
                    </button>

                    {/* 4. Fermer / détacher la case fixée */}
                    <button
                        id="sigil-map-hover-close-btn"
                        type="button"
                        style={{ display: 'none' }}
                        title="Déverrouiller la case (ou appuyer sur Échap)"
                        className="ml-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-white/10 text-white/50 transition-colors hover:bg-white/10 hover:text-white cursor-pointer"
                        onClick={(e) => {
                            e.stopPropagation();
                            if (setSelectedPosition) setSelectedPosition(null);
                            const hud = document.getElementById('sigil-map-hover-hud');
                            if (hud) hud.style.display = 'none';
                        }}
                    >
                        <X size={14} />
                    </button>
                </div>
            )}

            {/* 🌟 Composant discret en mode Overlay : position en temps réel + nom de zone */}
            {!isMiniMap && !hideUI && isOverlay && (
                <div
                    id="sigil-overlay-hover-hud"
                    style={{ display: 'none' }}
                    className="absolute bottom-3 left-1/2 -translate-x-1/2 z-[1000] pointer-events-none flex items-center gap-2 px-3 py-1 rounded-full bg-[#030712]/85 backdrop-blur-md border border-white/15 shadow-[0_4px_20px_rgba(0,0,0,0.8)] select-none transition-all duration-150 animate-in fade-in zoom-in-95"
                >
                    <span id="sigil-overlay-hover-pin" style={{ display: 'none' }} className="text-amber-400 text-xs">
                        📌
                    </span>
                    <span id="sigil-overlay-hover-coords" className="font-mono font-black text-xs text-emerald-400 tracking-tight">
                        [0, 0]
                    </span>
                    <span className="text-white/30 text-[10px]">•</span>
                    <span id="sigil-overlay-hover-zone" className="text-xs font-semibold text-white/90 truncate max-w-[240px]">
                        Zone
                    </span>
                </div>
            )}
            <style>{`
                /* ── Tuiles : taille exacte du monde, sans surcouche GPU ──
                   Pas de will-change / backface-visibility ici : sur Chromium
                   (et Opera GX en particulier) ces propriétés forcent chaque tuile et
                   tout le conteneur sur des layers GPU dédiés. La carte complète
                   (~10k x 8k px) dépasse les budgets textures → tuiles qui disparaissent
                   (flash noir) et navbar qui clignote pendant le compositing.
                   Fond uni teinte océan (merge dézoom + Opera GX) : simple
                   background-color, zéro coût GPU, les tuiles en chargement/erreur
                   héritent de la teinte au lieu du noir. */
                .leaflet-tile {
                    width: ${tileSize}px !important;
                    height: ${tileSize}px !important;
                    background: ${MAP_OCEAN_TONE};
                    image-rendering: auto;
                    /* Supprime les bordures noires/vides entre les images */
                    outline: none !important;
                    border: none !important;
                    box-shadow: none !important;
                }
                .leaflet-container {
                    background: ${MAP_OCEAN_TONE} !important;
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
                /* ── Vue HD des maps (POC monde 38) : recadrage au centre de la cellule ── */
                .sigil-hd-map.leaflet-image-layer {
                    object-fit: cover;
                    object-position: center;
                    border: none !important;
                    image-rendering: auto;
                }
                
                /* ── GPS Pulse Animation ── */
                @keyframes gps-ping {
                    0% { transform: scale(1); opacity: 0.8; }
                    100% { transform: scale(2.5); opacity: 0; }
                }
                .gps-pulse-outer {
                    animation: gps-ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;
                }
                .gps-pulse-marker {
                    background: none !important;
                    border: none !important;
                }
                
                }
            `}</style>

            <MapContainer
                key={`${selectedWorldId}-${isMiniMap}`}
                crs={sigilCRS}
                center={initialCenter}
                zoom={initialZoom}
                style={{ height: '100%', width: '100%', outline: 'none' }}
                zoomControl={false}
                attributionControl={false}
                minZoom={isMiniMap ? -6 : Math.max(selectedWorldId !== 1 ? -3 : -4, -(correctedActiveWorld.zoom?.length || 1) - 1)}
                maxZoom={3}
                maxBoundsViscosity={1.0}
                // Zoom discret (1) : les tuiles n'existent qu'aux échelles natives
                // (1, 0.8, 0.6…). Un zoomSnap fractionnaire (0.1) force un scaling CSS
                // continu des tuiles via le GPU → flou + clignotement sur Chromium/Opera GX.
                zoomSnap={1}
                zoomDelta={1}
                zoomAnimation={true}
                fadeAnimation={true}
                markerZoomAnimation={true}
                preferCanvas={true}
                dragging={interactive}
                touchZoom={interactive}
                doubleClickZoom={false}
                scrollWheelZoom={interactive}
                boxZoom={interactive}
                keyboard={interactive}
            >
                <MapViewHandler
                    isMiniMap={isMiniMap}
                    guessResult={guessResult}
                    activeWorld={correctedActiveWorld}
                    minimapZoomLevel={minimapZoomLevel}
                    minimapRecenterTrigger={minimapRecenterTrigger}
                    participants={participants}
                />
                {/* 1. Tuiles officielles continues & multi-résolution */}
                <SigilTilesLayer activeWorld={correctedActiveWorld} selectedWorldId={selectedWorldId} />

                {/* 2. Grille DofusDB canvas (contour par position), contrôlée par showDebugGrid */}
                <MapGridOverlay
                    activeWorld={correctedActiveWorld}
                    mapsByCoords={mapsByCoords}
                    mapsBySubAreaId={mapsBySubAreaId}
                    subAreasById={subAreasById}
                    showDebugGrid={showDebugGrid}
                    zoneHighlight={zoneHighlight}
                    isMiniMap={isMiniMap}
                    guessResult={guessResult}
                    selectedPosition={selectedPosition}
                    setSelectedPosition={setSelectedPosition}
                    participants={participants}
                    currentUserId={currentUserId}
                    highlightSubareaIds={highlightSubareaIds}
                    zaaps={zaaps}
                    onOpenZoneDetails={onOpenZoneDetails}
                    isOverHudRef={isOverHudRef}
                    mouseoutTimerRef={mouseoutTimerRef}
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
                    isSpectator={isSpectator}
                    hideUI={hideUI}
                    interactive={interactive}
                    autoCopyTravel={autoCopyTravel}
                    isOverlay={isOverlay}
                    activeCircuit={activeCircuit}
                    onOpenZoneDetails={onOpenZoneDetails}
                />

                {/* 5. GPS Narrative Pulse (Highlight for quests) */}
                <MapNarrativeGPS 
                    activeWorld={correctedActiveWorld} 
                    triggerCoords={triggerCenterPosition} 
                    triggerWorldId={triggerWorldId}
                    currentWorldId={selectedWorldId}
                />

                {/* 5bis. Zaaps & GPS Récolte Opti-Farm */}
                {!isMiniMap && (
                    <HarvestRouteOverlay
                        activeWorld={correctedActiveWorld}
                        zaaps={zaaps}
                        showZaaps={showZaaps}
                        selectedResources={selectedHarvestResources}
                        activeCircuit={activeCircuit}
                        completedStepIndices={completedHarvestSteps}
                        onToggleStepCompleted={onToggleHarvestStep}
                        mapsByCoords={mapsByCoords}
                        isOverlay={isOverlay}
                    />
                )}

                {/* 5ter. Passages Secrets, Souterrains & Raccourcis */}
                {!isMiniMap && (
                    <SecretPassagesOverlay
                        activeWorld={correctedActiveWorld}
                        showPassages={showPassages}
                        zaaps={zaaps}
                        showZaaps={showZaaps}
                        isOverlay={isOverlay}
                    />
                )}

                {/* 5. Highlight overlay (click selection) */}

                {/* 6. Dungeon markers (Uniquement si pas mini-map) */}
                {!isMiniMap && groupedDungeons && groupedDungeons.map((group: any) => {
                    const px = correctedActiveWorld.origineX + group.mapNode.x * correctedActiveWorld.mapWidth + correctedActiveWorld.mapWidth / 2;
                    const py = correctedActiveWorld.origineY + group.mapNode.y * correctedActiveWorld.mapHeight + correctedActiveWorld.mapHeight / 2;
                    const dCount = group.dungeons.length;

                    const isOcre = !!(group as any).isOcreQuest;

                    return (
                        <Marker
                            key={`d-${group.mapId}`}
                            position={[-py, px]}
                            icon={getDungeonIcon(isOcre, dCount)}
                            interactive={interactive}
                            {...(interactive ? { eventHandlers: { click: (e: any) => { e.originalEvent.stopPropagation(); setSelectedDungeon((group.dungeons as any[]).map((d: any) => ({ ...d, __isOcreQuest: isOcre }))); } } } : {})}
                        >
                            {interactive && (
                                <Tooltip direction="top" offset={[0, -10]} opacity={1}>
                                    <div className="text-amber-500 font-bold text-xs">
                                        {dCount > 1
                                            ? `${dCount} Donjons`
                                            : (typeof group.dungeons[0].name === 'string'
                                                ? group.dungeons[0].name
                                                : group.dungeons[0].name?.fr || 'Donjon')}
                                    </div>
                                </Tooltip>
                            )}
                        </Marker>
                    );
                })}

                <ExternalController 
                    triggerCenterPosition={triggerCenterPosition} 
                    activeWorld={correctedActiveWorld} 
                    minimapRecenterTrigger={minimapRecenterTrigger} 
                    interactive={interactive}
                    initialZoom={initialZoom}
                />
                
                {/* 7. Contrôles de zoom premium — masqués en overlay */}
                {interactive && !isMiniMap && !isOverlay && <ZoomControls />}
            </MapContainer>
        </div>
    );
}
