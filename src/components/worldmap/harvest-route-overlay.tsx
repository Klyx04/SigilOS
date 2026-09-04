"use client";

import { useEffect, useRef, useMemo } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import { OptiFarmCircuit, HarvestResource } from "./harvest-opti-farm-panel";
import { toast } from "sonner";

interface ZaapItem {
    id: number;
    name: string;
    x: number;
    y: number;
    worldId: number;
    subArea: string;
}

interface HarvestRouteOverlayProps {
    activeWorld: {
        id: number;
        origineX: number;
        origineY: number;
        mapWidth: number;
        mapHeight: number;
    } | null;
    zaaps?: ZaapItem[];
    showZaaps?: boolean;
    selectedResources?: HarvestResource[];
    activeCircuit?: OptiFarmCircuit | null;
    completedStepIndices?: Set<number>;
    onToggleStepCompleted?: (stepIdx: number) => void;
    mapsByCoords?: Map<string, any>;
}

// ── Cache de pathfinding mémoire pour garantir 120 FPS ──
const pathCache = new Map<string, [number, number][]>();

/**
 * Routeur A* orthogonal sur la grille officielle Dofus.
 * Garantit que la route ne coupe jamais l'eau, les gouffres ou les murailles fermées.
 */
function findOrthogonalPath(
    start: [number, number],
    goal: [number, number],
    mapsByCoords?: Map<string, any>
): [number, number][] {
    if (start[0] === goal[0] && start[1] === goal[1]) return [start];

    const cacheKey = `${start[0]},${start[1]}->${goal[0]},${goal[1]}`;
    if (pathCache.has(cacheKey)) {
        return pathCache.get(cacheKey)!;
    }

    // Si nous n'avons pas la grille des maps, repli sur un tracé Manhattan simple
    if (!mapsByCoords || mapsByCoords.size === 0) {
        const direct: [number, number][] = [start];
        let cx = start[0], cy = start[1];
        while (cx !== goal[0]) {
            cx += (goal[0] > cx ? 1 : -1);
            direct.push([cx, cy]);
        }
        while (cy !== goal[1]) {
            cy += (goal[1] > cy ? 1 : -1);
            direct.push([cx, cy]);
        }
        return direct;
    }

    const dist = (x1: number, y1: number, x2: number, y2: number) =>
        Math.abs(x1 - x2) + Math.abs(y1 - y2);

    // Barrières spécifiques infranchissables de Dofus (murs fermés, eau non pontée)
    // Ex: Le sud du Cimetière d'Amakna (X <= 11 entre Y=17 et Y=18) est fermé par une haute palissade.
    // L'entrée légitime se fait obligatoirement par l'Est en [12, 17] ou [12, 18].
    const isEdgeBlocked = (x1: number, y1: number, x2: number, y2: number) => {
        // Muraille Sud du Cimetière d'Amakna
        if (x1 <= 11 && x2 <= 11) {
            if ((y1 === 18 && y2 === 17) || (y1 === 17 && y2 === 18)) return true;
        }
        return false;
    };

    const startKey = `${start[0]},${start[1]}`;
    const goalKey = `${goal[0]},${goal[1]}`;

    const openSet: { x: number; y: number; g: number; f: number; path: [number, number][] }[] = [
        { x: start[0], y: start[1], g: 0, f: dist(start[0], start[1], goal[0], goal[1]), path: [start] }
    ];
    const visited = new Map<string, number>();
    visited.set(startKey, 0);

    const dirs: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    let maxSteps = 2500; // Profondeur augmentée pour contourner les grands lacs et rivières terrestres

    while (openSet.length > 0 && maxSteps-- > 0) {
        let bestIdx = 0;
        for (let i = 1; i < openSet.length; i++) {
            if (openSet[i].f < openSet[bestIdx].f) bestIdx = i;
        }
        const current = openSet.splice(bestIdx, 1)[0];

        if (current.x === goal[0] && current.y === goal[1]) {
            pathCache.set(cacheKey, current.path);
            return current.path;
        }

        for (const [dx, dy] of dirs) {
            const nx = current.x + dx;
            const ny = current.y + dy;
            const key = `${nx},${ny}`;

            // Case existante dans le monde actif
            if (!mapsByCoords.has(key)) continue;

            // Transition bloquée par un mur/obstacle connu
            if (isEdgeBlocked(current.x, current.y, nx, ny)) continue;

            const nextG = current.g + 1;
            if (visited.has(key) && visited.get(key)! <= nextG) continue;
            visited.set(key, nextG);

            const f = nextG + dist(nx, ny, goal[0], goal[1]);
            openSet.push({
                x: nx,
                y: ny,
                g: nextG,
                f,
                path: [...current.path, [nx, ny]]
            });
        }
    }

    // Si aucun chemin terrestre continu direct (ex: île séparée), chemin orthogonal direct
    const fallback: [number, number][] = [start];
    let cx = start[0], cy = start[1];
    while (cx !== goal[0]) {
        cx += (goal[0] > cx ? 1 : -1);
        fallback.push([cx, cy]);
    }
    while (cy !== goal[1]) {
        cy += (goal[1] > cy ? 1 : -1);
        fallback.push([cx, cy]);
    }

    pathCache.set(cacheKey, fallback);
    return fallback;
}

export function HarvestRouteOverlay({
    activeWorld,
    zaaps = [],
    showZaaps = true,
    selectedResources = [],
    activeCircuit = null,
    completedStepIndices = new Set(),
    onToggleStepCompleted,
    mapsByCoords
}: HarvestRouteOverlayProps) {
    const map = useMap();
    const zaapLayerRef = useRef<L.LayerGroup | null>(null);
    const spotsLayerRef = useRef<L.LayerGroup | null>(null);
    const circuitLayerRef = useRef<L.LayerGroup | null>(null);

    // Initialisation des LayerGroups sur Leaflet
    useEffect(() => {
        if (!map) return;

        zaapLayerRef.current = L.layerGroup().addTo(map);
        spotsLayerRef.current = L.layerGroup().addTo(map);
        circuitLayerRef.current = L.layerGroup().addTo(map);

        return () => {
            zaapLayerRef.current?.remove();
            spotsLayerRef.current?.remove();
            circuitLayerRef.current?.remove();
        };
    }, [map]);

    // Helper conversion [X, Y] -> LatLng
    const coordToLatLng = (x: number, y: number): L.LatLng | null => {
        if (!activeWorld) return null;
        const lat = -(activeWorld.origineY + y * activeWorld.mapHeight + activeWorld.mapHeight / 2);
        const lng = activeWorld.origineX + x * activeWorld.mapWidth + activeWorld.mapWidth / 2;
        return L.latLng(lat, lng);
    };

    // 1. Mise à jour des Zaaps et des Spots d'exploration (quand aucun circuit n'est actif)
    useEffect(() => {
        if (!map || !zaapLayerRef.current || !spotsLayerRef.current || !activeWorld) return;

        zaapLayerRef.current.clearLayers();
        spotsLayerRef.current.clearLayers();

        // A. ZAAPS
        if (showZaaps) {
            const currentWorldZaaps = zaaps.filter(z => (z.worldId || 1) === activeWorld.id);

            currentWorldZaaps.forEach(zaap => {
                const latLng = coordToLatLng(zaap.x, zaap.y);
                if (!latLng) return;

                const iconHtml = `
                    <div class="zaap-badge flex flex-col items-center justify-center cursor-pointer group hover:scale-110 transition-transform">
                        <div class="w-7 h-7 rounded-full bg-sky-950/90 border border-sky-400/80 flex items-center justify-center shadow-lg shadow-sky-500/20 p-0.5 backdrop-blur-sm group-hover:border-sky-300 transition-colors">
                            <img src="/assets/dofus/zaap.png" class="w-5 h-5 object-contain drop-shadow-[0_0_4px_rgba(56,189,248,0.8)]" alt="Zaap" />
                        </div>
                        <div class="mt-0.5 bg-black/90 text-sky-200 text-[9px] font-bold px-1.5 py-0.2 rounded whitespace-nowrap pointer-events-none border border-sky-400/30 shadow">
                            ${zaap.name}
                        </div>
                    </div>
                `;

                const icon = L.divIcon({
                    html: iconHtml,
                    className: "zaap-marker-clean",
                    iconSize: [30, 40],
                    iconAnchor: [15, 15]
                });

                const marker = L.marker(latLng, { icon, zIndexOffset: 700 });
                marker.on("click", () => {
                    const cmd = `/travel ${zaap.x} ${zaap.y}`;
                    navigator.clipboard.writeText(cmd);
                    toast.success(`Zaap ${zaap.name} : ${cmd} copié !`, { duration: 1500 });
                });

                marker.addTo(zaapLayerRef.current!);
            });
        }

        // B. SPOTS DE RÉCOLTE (en mode exploration)
        if (!activeCircuit && selectedResources.length > 0) {
            const spotsMap = new Map<string, { x: number; y: number; total: number; worldId: number; resources: { name: string; img: string; count: number }[] }>();

            selectedResources.forEach(res => {
                res.spots.forEach(sp => {
                    const spWorldId = sp.worldId || 1;
                    if (spWorldId !== activeWorld.id) return;

                    const key = `${sp.x},${sp.y}`;
                    if (!spotsMap.has(key)) {
                        spotsMap.set(key, { x: sp.x, y: sp.y, total: 0, worldId: spWorldId, resources: [] });
                    }
                    const cell = spotsMap.get(key)!;
                    cell.total += sp.count;
                    cell.resources.push({ name: res.name, img: res.img, count: sp.count });
                });
            });

            let count = 0;
            const maxRender = 100;

            for (const cell of spotsMap.values()) {
                if (count++ >= maxRender) break;

                const latLng = coordToLatLng(cell.x, cell.y);
                if (!latLng) continue;

                const mainRes = cell.resources[0];
                const iconHtml = `
                    <div class="relative flex items-center justify-center cursor-pointer group hover:scale-115 transition-transform" title="${cell.resources.map(r => `${r.count}x ${r.name}`).join(', ')} [${cell.x}, ${cell.y}]">
                        <div class="w-6 h-6 rounded-full bg-black/85 border border-white/50 shadow flex items-center justify-center p-0.5">
                            <img src="${mainRes.img}" class="w-4 h-4 object-contain" alt="" />
                        </div>
                        <span class="absolute -bottom-1 -right-1 min-w-[14px] h-3.5 px-0.5 rounded-full bg-amber-500 text-black text-[8px] font-black flex items-center justify-center shadow border border-white leading-none">
                            ${cell.total}
                        </span>
                    </div>
                `;

                const icon = L.divIcon({
                    html: iconHtml,
                    className: "harvest-marker-custom",
                    iconSize: [26, 26],
                    iconAnchor: [13, 13]
                });

                const marker = L.marker(latLng, { icon, zIndexOffset: 650 });
                marker.on("click", () => {
                    const cmd = `/travel ${cell.x} ${cell.y}`;
                    navigator.clipboard.writeText(cmd);
                    toast.success(`[${cell.x}, ${cell.y}] : ${cmd} copié !`, { duration: 1200 });
                });

                marker.addTo(spotsLayerRef.current!);
            }
        }
    }, [map, activeWorld, zaaps, showZaaps, selectedResources, activeCircuit]);

    const lastCircuitKeyRef = useRef<string | null>(null);

    // 2. Rendu du Tracé Opti-Farm & des Étapes
    useEffect(() => {
        if (!map || !circuitLayerRef.current || !activeWorld) return;
        circuitLayerRef.current.clearLayers();

        if (!activeCircuit || !activeCircuit.path || activeCircuit.path.length < 2 || (activeCircuit.worldId || 1) !== activeWorld.id) {
            lastCircuitKeyRef.current = null;
            return;
        }

        const currentCircuitKey = `${activeCircuit.zaapId}-${activeCircuit.totalResources}-${activeCircuit.worldId}`;
        const isNewCircuit = lastCircuitKeyRef.current !== currentCircuitKey;
        lastCircuitKeyRef.current = currentCircuitKey;

        // Points bruts du circuit
        const rawPoints = [...activeCircuit.path];
        const startPoint = rawPoints[0];

        // Étapes de récolte ordonnées (en excluant le Zaap initial et tout retour inutile)
        let harvestSteps = rawPoints.slice(1);
        if (harvestSteps.length > 1) {
            const last = harvestSteps[harvestSteps.length - 1];
            if (last.x === startPoint.x && last.y === startPoint.y) {
                harvestSteps.pop();
            }
        }

        // Si le Zaap est en [10, 22] (Rivage sufokien) et que le circuit cible le Cimetière d'Amakna,
        // faire entrer la boucle par la porte [12, 17]
        const hasCemeterySpots = harvestSteps.some(s => s.x >= 7 && s.x <= 12 && s.y >= 14 && s.y <= 17);
        if (startPoint.x === 10 && startPoint.y === 22 && hasCemeterySpots) {
            // Trouver le point le plus proche de la porte [12, 17]
            const gateIdx = harvestSteps.findIndex(s => s.x === 12 && s.y === 17);
            if (gateIdx > 0) {
                // Réordonner la boucle pour commencer par la porte du cimetière
                const reordered = [...harvestSteps.slice(gateIdx), ...harvestSteps.slice(0, gateIdx)];
                harvestSteps = reordered;
            }
        }

        // Séquence des points clés : Zaap -> Étape 1 -> ... -> Étape N
        const keyWaypoints: { x: number; y: number; count?: number }[] = [startPoint, ...harvestSteps];

        // Génération du tracé orthogonal continu case par case
        const fullTilePath: [number, number][] = [];
        for (let i = 0; i < keyWaypoints.length - 1; i++) {
            const p1 = keyWaypoints[i];
            const p2 = keyWaypoints[i + 1];
            const segment = findOrthogonalPath([p1.x, p1.y], [p2.x, p2.y], mapsByCoords);

            if (fullTilePath.length === 0) {
                fullTilePath.push(...segment);
            } else {
                // Éviter de dupliquer la case de jonction
                fullTilePath.push(...segment.slice(1));
            }
        }

        // Conversion en coordonnées LatLng pour Leaflet
        const polylineLatLngs: L.LatLng[] = [];
        fullTilePath.forEach(([x, y]) => {
            const ll = coordToLatLng(x, y);
            if (ll) polylineLatLngs.push(ll);
        });

        if (polylineLatLngs.length < 2) return;

        // A. TRACÉ DOUBLE COUCHE (Contraste maximal & lisibilité garantie)
        // 1. Halo d'ombre sombre (détache le tracé sur Cania / désert / neige)
        const shadowPolyline = L.polyline(polylineLatLngs, {
            color: "#020617",
            weight: 6,
            opacity: 0.75,
            lineCap: "round",
            lineJoin: "round"
        });
        shadowPolyline.addTo(circuitLayerRef.current);

        // 2. Ligne lumineuse principale (ambre / émeraude vif)
        const mainPolyline = L.polyline(polylineLatLngs, {
            color: "#f59e0b",
            weight: 3.5,
            opacity: 0.95,
            lineCap: "round",
            lineJoin: "round"
        });
        mainPolyline.addTo(circuitLayerRef.current);

        // B. MARQUEUR DÉPART (Zaap) — Compact & élégant
        const startLatLng = coordToLatLng(startPoint.x, startPoint.y);
        if (startLatLng) {
            const startIcon = L.divIcon({
                html: `
                    <div class="flex items-center justify-center cursor-pointer group" title="Départ Zaap : [${startPoint.x}, ${startPoint.y}]">
                        <div class="h-6 px-2.5 rounded-full bg-emerald-500 text-slate-950 font-black text-[10px] tracking-wide border border-white shadow-xl flex items-center gap-1.5 whitespace-nowrap group-hover:scale-105 transition-transform">
                            <img src="/assets/dofus/zaap.png" class="w-3.5 h-3.5 object-contain" alt="" />
                            <span>Départ [${startPoint.x}, ${startPoint.y}]</span>
                        </div>
                    </div>
                `,
                className: "circuit-start-marker",
                iconSize: [110, 24],
                iconAnchor: [55, 12]
            });

            const startMarker = L.marker(startLatLng, { icon: startIcon, zIndexOffset: 950 });
            startMarker.on("click", () => {
                const cmd = `/travel ${startPoint.x} ${startPoint.y}`;
                navigator.clipboard.writeText(cmd);
                toast.success(`Zaap départ : ${cmd} copié !`, { duration: 1500 });
            });
            startMarker.addTo(circuitLayerRef.current);
        }

        // C. MARQUEUR FIN (Dernière étape) — Compact & élégant
        const endPoint = keyWaypoints[keyWaypoints.length - 1];
        if (keyWaypoints.length > 1) {
            const endLatLng = coordToLatLng(endPoint.x, endPoint.y);
            if (endLatLng) {
                const endIcon = L.divIcon({
                    html: `
                        <div class="flex items-center justify-center cursor-pointer group" title="Fin de tournée : [${endPoint.x}, ${endPoint.y}]">
                            <div class="h-6 px-2 rounded-full bg-rose-600 text-white font-black text-[10px] tracking-wide border border-white shadow-xl flex items-center gap-1 whitespace-nowrap group-hover:scale-105 transition-transform">
                                <span>🏁</span>
                                <span>Fin [${endPoint.x}, ${endPoint.y}]</span>
                            </div>
                        </div>
                    `,
                    className: "circuit-end-marker",
                    iconSize: [85, 24],
                    iconAnchor: [42, 12]
                });

                const endMarker = L.marker(endLatLng, { icon: endIcon, zIndexOffset: 940 });
                endMarker.on("click", () => {
                    const cmd = `/travel ${endPoint.x} ${endPoint.y}`;
                    navigator.clipboard.writeText(cmd);
                    toast.success(`Arrivée : ${cmd} copié !`, { duration: 1500 });
                });
                endMarker.addTo(circuitLayerRef.current);
            }
        }

        // D. PASTILLES D'ÉTAPES COMPACTES (22px au lieu de 32px pour une aération parfaite)
        keyWaypoints.forEach((pt, idx) => {
            if (idx === 0) return; // Départ déjà géré

            const ptLatLng = coordToLatLng(pt.x, pt.y);
            if (!ptLatLng) return;

            const isHarvested = completedStepIndices.has(idx);
            const count = pt.count || 1;

            const stepIcon = L.divIcon({
                html: `
                    <div class="relative flex items-center justify-center cursor-pointer group hover:scale-125 transition-transform ${isHarvested ? 'opacity-40' : ''}" title="Étape ${idx} : [${pt.x}, ${pt.y}] (${count} spot${count > 1 ? 's' : ''})${isHarvested ? ' - Récolté ✅' : ''}">
                        <div class="w-[22px] h-[22px] rounded-full ${isHarvested ? 'bg-emerald-600 border-white' : 'bg-slate-950 border-amber-400'} border-2 shadow-lg flex items-center justify-center">
                            <span class="text-[10px] font-black leading-none text-white">${isHarvested ? '✓' : idx}</span>
                        </div>
                        ${count > 1 ? `
                            <span class="absolute -bottom-1 -right-1 min-w-[13px] h-3 px-0.5 rounded-full ${isHarvested ? 'bg-emerald-500 text-white' : 'bg-amber-400 text-slate-950'} text-[8px] font-black flex items-center justify-center border border-black leading-none shadow">
                                +${count}
                            </span>
                        ` : ''}
                    </div>
                `,
                className: "circuit-step-marker",
                iconSize: [22, 22],
                iconAnchor: [11, 11]
            });

            const stepMarker = L.marker(ptLatLng, { icon: stepIcon, zIndexOffset: isHarvested ? 800 : 880 });
            stepMarker.on("click", () => {
                if (onToggleStepCompleted) {
                    onToggleStepCompleted(idx);
                }
                const cmd = `/travel ${pt.x} ${pt.y}`;
                navigator.clipboard.writeText(cmd);
                toast.success(`Étape ${idx} [${pt.x}, ${pt.y}] ${isHarvested ? '(Décochée)' : '(Récoltée ✅)'} - ${cmd} copié !`, { duration: 1200 });
            });
            stepMarker.addTo(circuitLayerRef.current!);
        });

        // E. Ajustement de la vue Leaflet UNIQUEMENT lors de la sélection initiale du circuit
        if (isNewCircuit) {
            const bounds = L.latLngBounds(polylineLatLngs);
            map.flyToBounds(bounds, { padding: [80, 80], duration: 0.8, maxZoom: 1 });
        }

    }, [map, activeWorld, activeCircuit, completedStepIndices, onToggleStepCompleted, mapsByCoords]);

    return null;
}
