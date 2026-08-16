'use client';

import React, { useEffect, useMemo, useRef, useCallback } from 'react';
import { MapContainer, Rectangle, Marker, Tooltip, useMap, useMapEvents, Polyline } from 'react-leaflet';
import { motion, AnimatePresence } from 'framer-motion';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Plus, Minus, Copy, Flag, CornerUpRight, Rocket, Smartphone } from 'lucide-react';
import { toast } from 'sonner';
import { mergeCellEdges } from '@/lib/map-utils';
import { MapHDOverlay } from './map-hd-overlay';

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
                const apiCols = selectedWorldId === 1 
                    ? Math.round((activeWorld.totalWidth * scale) / tileSize)
                    : Math.ceil((activeWorld.totalWidth * scale) / tileSize);
                const apiRows = selectedWorldId === 1 
                    ? Math.round((activeWorld.totalHeight * scale) / tileSize)
                    : Math.ceil((activeWorld.totalHeight * scale) / tileSize);
                
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

function MapGridOverlay({ activeWorld, mapsByCoords, mapsBySubAreaId, subAreasById, showDebugGrid, isMiniMap, guessResult, selectedPosition, participants, currentUserId, highlightSubareaIds, zoneHighlight }: any) {
    const map = useMap();
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const hoveredCellRef = useRef<string | null>(null);
    const hoveredSubAreaIdRef = useRef<number | null>(null);
    const rafRef = useRef<number>(0);
    const blinkRafRef = useRef<number>(0);
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
        const dpr = window.devicePixelRatio || 1;
        canvas.width = size.x * dpr;
        canvas.height = size.y * dpr;
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
            
            ctx.save();
            ctx.fillStyle = 'rgba(99, 102, 241, 0.65)';
            ctx.strokeStyle = 'rgba(99, 102, 241, 0.8)';
            ctx.lineWidth = 1;
            ctx.lineJoin = 'round';
            ctx.shadowBlur = 0;
            ctx.shadowColor = 'transparent';

            if (!forceCellFallback && subArea && subArea.shape && subArea.shape.length > 2) {
                // Rendu Doflex Pixel-Perfect via Shape officielle
                // La shape de DofusDB encode parfois plusieurs polygones avec des headers (ex: 10924).
                const shape = subArea.shape;
                let isFirstPoint = true;
                
                ctx.beginPath();
                for (let i = 0; i < shape.length; i += 2) {
                    const gx = shape[i];
                    const gy = shape[i+1];
                    
                    // Si on tombe sur un ID massif, c'est une délimitation de nouveau polygone
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
                // Fallback (anciennes données ou zones partielles non offi)
                const mapsInZone = mapsBySubAreaId.get(subAreaId);
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

        // ── 1c. Hover cellule individuelle (toujours visible qd en survol) ──
        if (cellKey) {
            const [hx, hy] = cellKey.split(',').map(Number);
            const tl = toCP(hx, hy);
            const br = toCP(hx + 1, hy + 1);
            
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
            
            // Légère surbrillance intérieure
            ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
            ctx.fillRect(Math.round(tl.x), Math.round(tl.y), Math.round(br.x - tl.x), Math.round(br.y - tl.y));
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

            const drawGuessLine = (g: any, isMe: boolean) => {
                const guessWorldId = g.worldId || g.worldMap;
                if (guessWorldId !== undefined && guessWorldId !== world.id && guessWorldId !== world.worldMap) return;

                const guessTL = toCP(g.x, g.y);
                const guessBR = toCP(g.x + 1, g.y + 1);
                const p2 = { x: (guessTL.x + guessBR.x) / 2, y: (guessTL.y + guessBR.y) / 2 };

                ctx.save();
                ctx.shadowBlur = isMe ? 25 : 15;
                ctx.shadowColor = isMe ? 'rgba(251, 191, 36, 0.9)' : 'rgba(255, 255, 255, 0.4)';
                ctx.beginPath();
                ctx.setLineDash([6, 4]);
                ctx.strokeStyle = isMe ? '#fbbf24' : 'rgba(255, 255, 255, 0.8)';
                ctx.lineWidth = isMe ? 5 : 3;
                ctx.moveTo(p1.x, p1.y);
                ctx.lineTo(p2.x, p2.y);
                ctx.stroke();
                ctx.restore();

                if (isMiniMap) {
                    ctx.fillStyle = isMe ? '#10b981' : 'rgba(255, 255, 255, 0.8)';
                    ctx.beginPath(); ctx.arc(p2.x, p2.y, 6, 0, Math.PI * 2); ctx.fill();
                    ctx.strokeStyle = 'white'; ctx.lineWidth = 1.5; ctx.stroke();
                } else {
                    ctx.strokeStyle = isMe ? '#10b981' : 'rgba(255, 255, 255, 0.5)';
                    ctx.lineWidth = 2;
                    ctx.strokeRect(Math.round(guessTL.x), Math.round(guessTL.y), Math.round(guessBR.x - guessTL.x), Math.round(guessBR.y - guessTL.y));
                    ctx.fillStyle = isMe ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 255, 255, 0.05)';
                    ctx.fillRect(Math.round(guessTL.x), Math.round(guessTL.y), Math.round(guessBR.x - guessTL.x), Math.round(guessBR.y - guessTL.y));
                }

                ctx.fillStyle = 'white';
                ctx.beginPath(); ctx.arc(p1.x, p1.y, 4, 0, Math.PI * 2); ctx.fill();
                ctx.beginPath(); ctx.arc(p2.x, p2.y, 4, 0, Math.PI * 2); ctx.fill();

                const dist = Math.round(g.distance || 0);
                const label = `${dist} maps`;
                ctx.font = 'bold 12px Inter, sans-serif';
                const tw = ctx.measureText(label).width;
                const mx = (p1.x + p2.x) / 2;
                const my = (p1.y + p2.y) / 2;
                ctx.shadowBlur = 10; ctx.shadowColor = 'black';
                ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
                ctx.beginPath(); ctx.roundRect(mx - tw / 2 - 8, my - 12, tw + 16, 24, 6); ctx.fill();
                ctx.strokeStyle = isMe ? '#fbbf24' : 'rgba(255, 255, 255, 0.4)'; ctx.lineWidth = 1; ctx.stroke();
                ctx.fillStyle = isMe ? '#fbbf24' : 'white'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                ctx.fillText(label, mx, my + 1);

                ctx.font = 'bold 10px Inter, sans-serif';
                const gLabel = `(${g.x}, ${g.y})`;
                const gTw = ctx.measureText(gLabel).width;
                const gMargin = isMiniMap ? 14 : Math.round((guessBR.y - guessTL.y) / 2) + 4;
                const gDrawBelow = (p2.y + gMargin + 18) <= size.y - 10;
                const gRectY = gDrawBelow ? p2.y + gMargin : p2.y - gMargin - 18;
                ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
                ctx.beginPath(); ctx.roundRect(p2.x - gTw / 2 - 6, gRectY, gTw + 12, 18, 4); ctx.fill();
                ctx.strokeStyle = isMe ? '#10b981' : 'rgba(255, 255, 255, 0.4)'; ctx.lineWidth = 1; ctx.stroke();
                ctx.fillStyle = isMe ? '#10b981' : 'white'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                ctx.fillText(gLabel, p2.x, gRectY + 9);
            };

            if (participants && participants.length > 0) {
                participants.forEach((p: any) => {
                    if (p.lastGuess && !p.lastGuess.hidden) {
                        drawGuessLine(p.lastGuess, p.userId === currentUserId);
                    }
                });
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

    // ── Sync highlight ref & manage blink animation loop ──
    useEffect(() => {
        const ids: number[] = highlightSubareaIds || [];
        highlightSubareaIdsRef.current = ids;

        if (ids.length > 0) {
            const animate = () => {
                drawGrid();
                blinkRafRef.current = requestAnimationFrame(animate);
            };
            blinkRafRef.current = requestAnimationFrame(animate);
        } else {
            cancelAnimationFrame(blinkRafRef.current);
            drawGrid(); // Clear the highlight
        }

        return () => cancelAnimationFrame(blinkRafRef.current);
    }, [highlightSubareaIds, drawGrid]);



    // Redraw on every map movement, zoom and toggle (rAF-throttled)
    // Redraw on map view changes (critical for flyToBounds animation)
    useMapEvents({
        move: () => drawGrid(),
        zoom: () => drawGrid(),
        resize: () => drawGrid(),
        moveend: () => drawGrid(),
    });

    useEffect(() => {
        drawGrid();
    }, [showDebugGrid, drawGrid, selectedPosition, guessResult, participants, currentUserId]);

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
            const gx0 = Math.floor((e.latlng.lng - world.origineX) / world.mapWidth);
            const gy0 = Math.floor((-e.latlng.lat - world.origineY) / world.mapHeight);

            // ── Snap vers la map valide la plus proche (±3 cases) ──
            let mapData = mapsByCoords?.get(`${gx0},${gy0}`);
            let gx = gx0, gy = gy0;
            if (!mapData) {
                outer: for (let r = 1; r <= 15; r++) {
                    for (let dx = -r; dx <= r; dx++) {
                        for (let dy = -r; dy <= r; dy++) {
                            if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
                            const m = mapsByCoords?.get(`${gx0 + dx},${gy0 + dy}`);
                            if (m) { mapData = m; gx = gx0 + dx; gy = gy0 + dy; break outer; }
                        }
                    }
                }
            }
            const key = `${gx},${gy}`;
            
            // ── HOVER SECU: No highlight in void if playing in Mini-Jeux ──
            if (isMiniMap && !mapData) {
                if (hoveredCellRef.current !== null) {
                    hoveredCellRef.current = null;
                    hoveredSubAreaIdRef.current = null;
                    drawGrid();
                }
                return;
            }

            const subAreaId = mapData ? mapData.subAreaId : null;

            if (key !== hoveredCellRef.current || subAreaId !== hoveredSubAreaIdRef.current) {
                hoveredCellRef.current = key;
                hoveredSubAreaIdRef.current = subAreaId;
                if (rafRef.current) cancelAnimationFrame(rafRef.current);
                rafRef.current = requestAnimationFrame(drawGrid);
                
                // Update DOM HUD without React renders
                const hud = document.getElementById('sigil-map-hover-hud');
                if (hud) {
                    const zoneSpan = document.getElementById('sigil-map-hover-zone');
                    const coordsSpan = document.getElementById('sigil-map-hover-coords');
                    const worldSpan = document.getElementById('sigil-map-hover-world');
                    const img = document.getElementById('sigil-map-hover-img') as HTMLImageElement;
                    
                    if (zoneSpan && coordsSpan && worldSpan) {
                        if (subAreaId && subAreasById) {
                            const subArea = subAreasById.get(subAreaId);
                            zoneSpan.innerText = subArea ? (subArea.name?.fr || subArea.name || 'Zone Inconnue') : 'Zone Inconnue';
                        } else {
                            zoneSpan.innerText = 'Position';
                        }
                        
                        worldSpan.innerText = activeWorld?.name?.fr || activeWorld?.name || 'Monde des Douze';
                        coordsSpan.innerText = `[${gx}, ${gy}]`;
                        
                        hud.style.display = 'flex';
                    }
                }
            }
        },
        mouseout: () => {
            // On ne cache plus le HUD au mouseout pour qu'il reste disponible 
            // avec la dernière position connue.
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
    const scales = world.zoom || [1];
    const idx = -zoom;
    let scale = 1, bank = '1';
    if (idx >= 0 && idx < scales.length) { scale = scales[idx]; bank = scale === 1 ? '1' : parseFloat(scale.toFixed(4)).toString(); }
    else if (idx < 0) { scale = 1; bank = '1'; }
    else { scale = scales[scales.length - 1]; bank = parseFloat(scale.toFixed(4)).toString(); }
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

    useEffect(() => {
        const timer = setInterval(() => map.invalidateSize(), 500);
        return () => clearInterval(timer);
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
            // Pré-charge les tuiles de la zone cible pour éviter le flash au dézoom
            prefetchTilesForBounds(map, world, bounds);
            setTimeout(() => {
                if (isMiniMap) {
                    map.fitBounds(bounds, { padding: [80, 80], maxZoom: -1, animate: false });
                } else {
                    map.flyToBounds(bounds, { padding: [120, 120], duration: 1.5, easeLinearity: 0.25, maxZoom: -1 });
                }
            }, 100);
        }
    }, [guessResult, isMiniMap, map, activeWorld, participants]);

    return null;
}

// Tooltip + click interactions (throttled)
// -------------------------------------------------------------------------------------
function MapInteractionHandler({ activeWorld, mapsByCoords, subAreasById, dungeonsByMapId, setSelectedPosition, isMiniMap, isSpectator, hideUI, interactive = true, autoCopyTravel = false, onHoverMap }: any) {
    const map = useMap();
    const lastTooltipTime = useRef(0);

    useMapEvents(!interactive ? {} : {
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

            // ── Snap vers la map valide la plus proche (±3 cases) ──
            // La formule linéaire accumule des erreurs sur les régions éloignées (Frigost, etc.)
            // On cherche dans le voisinage pour trouver la map réelle sous le curseur.
            let foundMap = mapsByCoords.get(`${gameX0},${gameY0}`);
            let gameX = gameX0;
            let gameY = gameY0;
            if (!foundMap) {
                outer: for (let r = 1; r <= 15; r++) {
                    for (let dx = -r; dx <= r; dx++) {
                        for (let dy = -r; dy <= r; dy++) {
                            if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue; // only perimeter
                            const m = mapsByCoords.get(`${gameX0 + dx},${gameY0 + dy}`);
                            if (m) { foundMap = m; gameX = gameX0 + dx; gameY = gameY0 + dy; break outer; }
                        }
                    }
                }
            }
            
            // Dispatch specifically for HUD if callback exists
            if (onHoverMap) {
                onHoverMap({ x: gameX, y: gameY, found: !!foundMap });
            }

            // In minimap (Geoguesser), block visually invalid areas
            if (isMiniMap && !foundMap) {
                return;
            }
            
            // L'HUD Top-Right dynamique est géré via SigilTilesLayer ou le composant wrapper
            // Note: le wrapper DOM `sigil-map-hover-hud` est mis à jour par le useRef côté DrawGrid
            // ou directement ici:
        },
        mouseout: () => {
            if (onHoverMap) onHoverMap(null);
            // On ne cache plus le HUD ici non plus.
        },
        click: (e) => {
            if (isSpectator || hideUI) return; 

            const world = activeWorld;
            if (!world) return;
            const mapX = e.latlng.lng;
            const mapY = -e.latlng.lat;
            const gameX0 = Math.floor((mapX - world.origineX) / world.mapWidth);
            const gameY0 = Math.floor((mapY - world.origineY) / world.mapHeight);

            // Snap vers la map valide la plus proche (±3 cases)
            let foundMap = mapsByCoords.get(`${gameX0},${gameY0}`);
            let gameX = gameX0;
            let gameY = gameY0;
            if (!foundMap) {
                outer: for (let r = 1; r <= 15; r++) {
                    for (let dx = -r; dx <= r; dx++) {
                        for (let dy = -r; dy <= r; dy++) {
                            if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
                            const m = mapsByCoords.get(`${gameX0 + dx},${gameY0 + dy}`);
                            if (m) { foundMap = m; gameX = gameX0 + dx; gameY = gameY0 + dy; break outer; }
                        }
                    }
                }
            }
            
            // ── SECU: Block click if "Hors Map" in Mini-Jeux Mode ──
            if (isMiniMap && !foundMap) {
                toast.error("Position hors carte — Veuillez viser une zone valide du monde !", {
                    id: "geoguesser-void-click",
                    duration: 2000,
                    icon: <Flag className="w-4 h-4 text-rose-500" />
                });
                return;
            }

            setSelectedPosition({ x: gameX, y: gameY, displayX: gameX, displayY: gameY, mapId: foundMap?.id });

            // ── Clipboard Copy Logic (Exploration map only) ──
            if (!isMiniMap && autoCopyTravel) {
                const command = `/travel ${gameX} ${gameY}`;
                navigator.clipboard.writeText(command)
                    .then(() => {
                        toast.success(`${command} copié !`, {
                            icon: <Rocket className="w-4 h-4 text-emerald-400" />,
                            description: "Collez la commande en jeu pour voyager.",
                            duration: 2000
                        });
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
}
export default function LeafletMapCore(props: LeafletMapCoreProps) {
    const [hoveredCoords, setHoveredCoords] = React.useState<{ x: number, y: number, found?: boolean } | null>(null);

    const {
        activeWorld, selectedWorldId, activeMaps, mapsByCoords, subAreasById,
        dungeonsByMapId, groupedDungeons, showDebugGrid, selectedPosition,
        mapsBySubAreaId, setSelectedPosition, setSelectedDungeon, triggerCenterPosition,
        triggerWorldId, isMiniMap, guessResult, minimapZoomLevel, minimapRecenterTrigger,
        participants, currentUserId, isSpectator, hideUI, interactive = true, 
        autoCopyTravel = false, onHoverMap, highlightSubareaIds, initialZoom: initialZoomProp, zoneHighlight
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

    return (
        <div className="w-full h-full cursor-crosshair relative map-core-wrapper">
            {/* L'UI de la zone survolée est mise à jour manuellement pour des raisons de perfs absolues sans re-render */}
            {!isMiniMap && !hideUI && (
                <div 
                    id="sigil-map-hover-hud"
                    style={{ display: 'none' }}
                    className="absolute bottom-8 left-1/2 -translate-x-[50%] z-[1000] bg-[#2d3139] shadow-[0_8px_32px_rgba(0,0,0,0.6)] rounded-lg pointer-events-auto transition-all duration-200 flex items-center border border-border overflow-visible px-6 py-4 group"
                >
                    {/* Tooltip visible on group hover */}
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 bg-[#1a1b1e] text-foreground text-caption font-bold px-4 py-2 rounded shadow-2xl opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap border border-border pointer-events-none">
                        Copier la commande d'auto-pilotage
                        <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-[#1a1b1e]"></div>
                    </div>

                    <div className="flex flex-col justify-center min-w-[200px]">
                        <span id="sigil-map-hover-zone" className="text-foreground font-black text-xl uppercase tracking-tight leading-none group-hover:text-emerald-400 transition-colors"></span>
                        <div className="flex items-center gap-3 mt-2">
                            <span id="sigil-map-hover-world" className="text-foreground/30 font-bold text-caption uppercase tracking-[0.2em]"></span>
                            <span className="w-1 h-1 rounded-full bg-surface" />
                            <div className="flex items-center gap-1 bg-black/20 px-2 py-0.5 rounded border border-border">
                                <Rocket size={10} className="text-emerald-500" />
                                <span id="sigil-map-hover-coords" className="text-emerald-400 font-black text-body-sm tracking-tight"></span>
                            </div>
                        </div>
                    </div>

                    {/* Rocket Copy Button */}
                    <div className="ml-8 w-12 h-12 bg-emerald-500 rounded-xl flex items-center justify-center shadow-[0_10px_20px_rgba(16,185,129,0.3)] hover:bg-emerald-400 hover:shadow-[0_15px_30px_rgba(16,185,129,0.4)] transition-all cursor-pointer group/btn active:scale-90" onClick={() => {
                        const coords = document.getElementById('sigil-map-hover-coords')?.innerText;
                        if (coords) {
                            const match = coords.match(/\[(.*),(.*)\]/);
                            if (match) {
                                const cmd = `/travel ${match[1].trim()} ${match[2].trim()}`;
                                navigator.clipboard.writeText(cmd);
                                toast.success("Commande copiée !", {
                                    description: cmd,
                                    icon: <Rocket className="w-4 h-4 text-emerald-400" />
                                });
                            }
                        }
                    }}>
                        <Rocket size={22} className="text-emerald-950 group- transition-transform" />
                    </div>
                </div>
            )}
            <style>{`
                /* ── Fix jointures de tuiles ABSOLU ──
                   Force la taille exacte des tuiles du monde ciblé + 1 pixel
                   pour un recouvrement garanti qui annule les lignes blanches */
                .leaflet-tile {
                    width: ${tileSize}px !important;
                    height: ${tileSize}px !important;
                    -webkit-backface-visibility: hidden;
                    backface-visibility: hidden;
                    image-rendering: auto;
                    /* Supprime les bordures noires/vides entre les images */
                    outline: none !important;
                    border: none !important;
                    box-shadow: none !important;
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
                
                /* Animation zoom fluide */
                .leaflet-zoom-animated {
                    transition: transform 0.4s cubic-bezier(0.4, 0, 0.2, 1);
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
                maxBoundsViscosity={0.8}
                zoomSnap={0.1}
                zoomDelta={1}
                preferCanvas={true}
                dragging={interactive}
                touchZoom={interactive}
                doubleClickZoom={interactive}
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
                {/* 1. Tuiles */}
                <SigilTilesLayer activeWorld={correctedActiveWorld} selectedWorldId={selectedWorldId} />

                {/* 1bis. Vue HD des maps à fort zoom (POC monde 38) */}
                <MapHDOverlay activeWorld={correctedActiveWorld} mapsByCoords={mapsByCoords} selectedWorldId={selectedWorldId} />

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
                    participants={participants}
                    currentUserId={currentUserId}
                    highlightSubareaIds={highlightSubareaIds}
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
                    onHoverMap={setHoveredCoords}
                />

                {/* 5. GPS Narrative Pulse (Highlight for quests) */}
                <MapNarrativeGPS 
                    activeWorld={correctedActiveWorld} 
                    triggerCoords={triggerCenterPosition} 
                    triggerWorldId={triggerWorldId}
                    currentWorldId={selectedWorldId}
                />

                {/* 5. Highlight overlay (click selection) */}

                {/* 6. Dungeon markers (Uniquement si pas mini-map) */}
                {!isMiniMap && groupedDungeons && groupedDungeons.map((group: any) => {
                    const px = correctedActiveWorld.origineX + group.mapNode.x * correctedActiveWorld.mapWidth + correctedActiveWorld.mapWidth / 2;
                    const py = correctedActiveWorld.origineY + group.mapNode.y * correctedActiveWorld.mapHeight + correctedActiveWorld.mapHeight / 2;
                    const dCount = group.dungeons.length;

                    const isOcre = !!(group as any).isOcreQuest;
                    const iconHtml = `
                    <div class="w-7 h-7 rounded-full bg-surface/90 border-2 border-amber-500/80  flex items-center justify-center text-amber-400 group-hover:scale-125 group-hover:border-amber-400 transition-all duration-200 relative">
                        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 20v-9H2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2Z"/><path d="M18 11V4H6v7"/><path d="M15 22v-4a3 3 0 0 0-3-3v0a3 3 0 0 0-3 3v4"/><path d="M22 11V9"/><path d="M2 11V9"/><path d="M6 4V2"/><path d="M18 4V2"/><path d="M10 4V2"/><path d="M14 4V2"/></svg>
                        ${isOcre ? `<img src="/module-dofus/Dofus_Ocre.png" alt="Quête Ocre" class="absolute -top-5 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full object-contain border border-border-strong bg-background " title="Donjon Quête Ocre" />` : ''}
                        ${dCount > 1 ? `<div class="absolute -top-2 -right-2 bg-amber-500 text-foreground text-caption font-bold w-4 h-4 rounded-full flex items-center justify-center border border-slate-900">${dCount}</div>` : ''}
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
                
                {/* 7. Contrôles de zoom premium */}
                {interactive && !isMiniMap && <ZoomControls />}
            </MapContainer>

            {/* Real-time Coordinate HUD */}
            <AnimatePresence>
                {hoveredCoords && (
                    <motion.div 
                        initial={{ opacity: 0, y: 10, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.9 }}
                        className="absolute bottom-6 left-6 z-[1000] px-4 py-2 bg-surface/80 backdrop-blur-md border border-border rounded-xl shadow-2xl flex items-center gap-3 pointer-events-none"
                    >
                        <div className={`w-2 h-2 rounded-full ${hoveredCoords.found ? 'bg-emerald-500 ' : 'bg-surface'}`} />
                        <span className="text-caption font-black text-foreground/40 uppercase tracking-widest italic">Position</span>
                        <span className="text-foreground font-black text-sm italic tracking-tighter">[{hoveredCoords.x}, {hoveredCoords.y}]</span>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
