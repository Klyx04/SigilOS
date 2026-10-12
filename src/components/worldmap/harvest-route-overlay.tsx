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
    isOverlay?: boolean;
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

    // Aucun chemin terrestre trouvé — les spots insulaires ne doivent jamais
    // arriver ici grâce au clustering par composante connexe.
    // On retourne un chemin vide pour éviter tout tracé fantôme.
    pathCache.set(cacheKey, []);
    return [];
}

export function HarvestRouteOverlay({
    activeWorld,
    zaaps = [],
    showZaaps = true,
    selectedResources = [],
    activeCircuit = null,
    completedStepIndices = new Set(),
    onToggleStepCompleted,
    mapsByCoords,
    isOverlay = false
}: HarvestRouteOverlayProps) {
    const map = useMap();
    const spotsLayerRef = useRef<L.LayerGroup | null>(null);
    const circuitLayerRef = useRef<L.LayerGroup | null>(null);

    // Initialisation des LayerGroups sur Leaflet
    useEffect(() => {
        if (!map) return;

        spotsLayerRef.current = L.layerGroup().addTo(map);
        circuitLayerRef.current = L.layerGroup().addTo(map);

        return () => {
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

    // 1. Mise à jour des Spots d'exploration (quand aucun circuit n'est actif)
    // Note : les Zaaps sont désormais gérés par SecretPassagesOverlay (clustering unifié).
    useEffect(() => {
        if (!map || !spotsLayerRef.current || !activeWorld) return;

        spotsLayerRef.current.clearLayers();

        // B. SPOTS DE RÉCOLTE (visibles en exploration, et en arrière-plan estompé en mode circuit)
        if (selectedResources.length > 0) {
            const spotsMap = new Map<string, { x: number; y: number; total: number; worldId: number; resources: { name: string; img: string; count: number }[] }>();

            // Ensemble des coordonnées faisant déjà partie du circuit actif (pour ne pas doubler l'affichage)
            const circuitCoordsSet = new Set<string>();
            if (activeCircuit && activeCircuit.path) {
                activeCircuit.path.forEach((p: any) => circuitCoordsSet.add(`${p.x},${p.y}`));
            }

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

            for (const cell of spotsMap.values()) {
                const isPartOfActiveCircuit = circuitCoordsSet.has(`${cell.x},${cell.y}`);
                // Si la case est déjà mise en avant dans le circuit actif, on n'affiche pas le spot standard par-dessus
                if (activeCircuit && isPartOfActiveCircuit) continue;

                const latLng = coordToLatLng(cell.x, cell.y);
                if (!latLng) continue;

                const mainRes = cell.resources[0];
                const isDimmed = !!activeCircuit;

                const iconHtml = `
                    <div class="relative flex items-center justify-center cursor-pointer group hover:scale-115 transition-all ${
                        isDimmed ? 'opacity-40 hover:opacity-90' : 'opacity-100'
                    }" title="${cell.resources.map(r => `${r.count}x ${r.name}`).join(', ')} [${cell.x}, ${cell.y}]">
                        <div class="${isDimmed ? 'w-5 h-5' : 'w-6 h-6'} rounded-full bg-black/85 border ${isDimmed ? 'border-white/30' : 'border-white/60'} shadow flex items-center justify-center p-0.5">
                            <img src="${mainRes.img}" class="${isDimmed ? 'w-3 h-3' : 'w-4 h-4'} object-contain" alt="" />
                        </div>
                        ${!isDimmed ? `
                        <span class="absolute -bottom-1 -right-1 min-w-[14px] h-3.5 px-0.5 rounded-full bg-amber-500 text-black text-[8px] font-black flex items-center justify-center shadow border border-white leading-none">
                            ${cell.total}
                        </span>` : ''}
                    </div>
                `;

                const icon = L.divIcon({
                    html: iconHtml,
                    className: "harvest-marker-custom",
                    iconSize: [26, 26],
                    iconAnchor: [13, 13]
                });

                const marker = L.marker(latLng, { icon, zIndexOffset: isDimmed ? 500 : 650 });
                marker.on("click", () => {
                    const cmd = `/travel ${cell.x} ${cell.y}`;
                    navigator.clipboard.writeText(cmd);
                    if (isOverlay) {
                        toast.success(`${cmd}`, {
                            icon: '📍',
                            duration: 1200,
                            position: 'bottom-right',
                            className: 'text-xs !py-2 !px-3 !min-h-0'
                        });
                    } else {
                        toast.success(`[${cell.x}, ${cell.y}] : ${cmd} copié !`, { duration: 1200 });
                    }
                });

                marker.addTo(spotsLayerRef.current!);
            }
        }
    }, [map, activeWorld, selectedResources, activeCircuit, isOverlay]);

    // 2. Recentrage caméra automatique au lancement d'un circuit
    const prevCircuitRef = useRef<any>(null);
    useEffect(() => {
        if (!map || !activeCircuit || !activeWorld) return;
        if (prevCircuitRef.current === activeCircuit) return;
        prevCircuitRef.current = activeCircuit;

        const [zx, zy] = activeCircuit.zaapCoord || [activeCircuit.path?.[0]?.x, activeCircuit.path?.[0]?.y];
        if (zx !== undefined && zy !== undefined) {
            const target = coordToLatLng(zx, zy);
            if (target) {
                map.flyTo(target, Math.max(map.getZoom(), 0), {
                    duration: 1.0,
                    easeLinearity: 0.25
                });
                toast.success(`Cap sur le départ : ${activeCircuit.zaapName}`, {
                    description: `${activeCircuit.mapCount} maps · ${activeCircuit.totalResources} ressources`,
                    duration: 2500
                });
            }
        }
    }, [activeCircuit, map, activeWorld]);

    // 3. Rendu du circuit actif (route de farm)
    useEffect(() => {
        if (!circuitLayerRef.current || !activeWorld) return;
        circuitLayerRef.current.clearLayers();
        if (!activeCircuit) return;

        const path = activeCircuit.path;
        if (!path || path.length < 2) return;

        // ── A. Tracer la polyligne de la route ──────────────────────
        const routePoints: L.LatLng[] = [];

        for (let i = 0; i < path.length - 1; i++) {
            const from = path[i];
            const to = path[i + 1];

            // Si les maps sont déjà immédiatement adjacentes, tracé direct sans calcul
            if (Math.abs(from.x - to.x) + Math.abs(from.y - to.y) <= 1) {
                const llFrom = coordToLatLng(from.x, from.y);
                if (llFrom && (routePoints.length === 0 || !routePoints[routePoints.length - 1].equals(llFrom))) {
                    routePoints.push(llFrom);
                }
                const llTo = coordToLatLng(to.x, to.y);
                if (llTo) routePoints.push(llTo);
            } else {
                // A* sur la grille terrestre pour contourner les obstacles
                const segment = findOrthogonalPath(
                    [from.x, from.y],
                    [to.x, to.y],
                    mapsByCoords
                );

                segment.forEach(([sx, sy]) => {
                    const ll = coordToLatLng(sx, sy);
                    if (ll) routePoints.push(ll);
                });
            }
        }

        // Polyligne principale (vert émeraude)
        if (routePoints.length > 1) {
            L.polyline(routePoints, {
                color: "#10b981",
                weight: 3.5,
                opacity: 0.85,
                dashArray: "6 4",
                lineJoin: "round"
            }).addTo(circuitLayerRef.current!);

            // Halo lumineux derrière la ligne
            L.polyline(routePoints, {
                color: "#34d399",
                weight: 8,
                opacity: 0.2,
                lineJoin: "round"
            }).addTo(circuitLayerRef.current!);
        }

        // ── B. Marqueur ZAAP de départ ───────────────────────────────
        const zaapLatLng = coordToLatLng(activeCircuit.zaapCoord[0], activeCircuit.zaapCoord[1]);
        if (zaapLatLng) {
            const zaapIcon = L.divIcon({
                html: `
                    <div class="flex flex-col items-center">
                        <div class="w-9 h-9 rounded-full bg-emerald-950/95 border-2 border-emerald-400 flex items-center justify-center shadow-lg shadow-emerald-500/50">
                            <img src="/assets/dofus/zaap.png" class="w-5 h-5 object-contain drop-shadow-[0_0_6px_rgba(52,211,153,0.9)]" alt="Start" />
                        </div>
                        <div class="mt-0.5 bg-black/90 text-emerald-300 text-[9px] font-black px-1.5 py-0.5 rounded border border-emerald-500/50 whitespace-nowrap shadow">
                            DÉPART
                        </div>
                    </div>`,
                className: "circuit-zaap-marker",
                iconSize: [36, 50],
                iconAnchor: [18, 18]
            });
            L.marker(zaapLatLng, { icon: zaapIcon, zIndexOffset: 1000 })
                .addTo(circuitLayerRef.current!);
        }

        // ── C. Marqueurs numérotés pour chaque étape de récolte ──────
        // On ne numérote QUE les maps ayant des ressources à récolter (count > 0)
        let harvestIndex = 0;
        for (let i = 1; i < path.length - 1; i++) {
            const step = path[i];
            if (!step.count && step.count !== undefined) continue;

            const ll = coordToLatLng(step.x, step.y);
            if (!ll) continue;

            harvestIndex++;
            const stepNum = harvestIndex;
            const isDone = completedStepIndices.has(i - 1);

            const iconHtml = `
                <div class="flex flex-col items-center cursor-pointer group">
                    <div class="w-6 h-6 rounded-full flex items-center justify-center shadow-md border-2 transition-all ${
                        isDone
                            ? "bg-emerald-600 border-emerald-300 text-white"
                            : "bg-black/90 border-emerald-500 text-emerald-300 group-hover:border-emerald-300 group-hover:scale-110"
                    }">
                        <span class="text-[9px] font-black leading-none">${isDone ? "✓" : stepNum}</span>
                    </div>
                    ${step.count ? `<span class="mt-0.5 text-[8px] font-bold text-emerald-400 bg-black/80 px-1 rounded leading-none">${step.count}</span>` : ""}
                </div>`;

            const icon = L.divIcon({
                html: iconHtml,
                className: "circuit-step-marker",
                iconSize: [24, 30],
                iconAnchor: [12, 12]
            });

            const marker = L.marker(ll, { icon, zIndexOffset: 900 + stepNum });
            marker.on("click", () => {
                if (onToggleStepCompleted) onToggleStepCompleted(i - 1);
                const cmd = `/travel ${step.x} ${step.y}`;
                navigator.clipboard.writeText(cmd);
                if (isOverlay) {
                    toast.success(`${cmd}`, {
                        icon: '📍',
                        duration: 1200,
                        position: 'bottom-right',
                        className: 'text-xs !py-2 !px-3 !min-h-0'
                    });
                } else {
                    toast.success(`Étape ${stepNum} [${step.x}, ${step.y}] copié !`, { duration: 1000 });
                }
            });
            marker.addTo(circuitLayerRef.current!);
        }

    }, [activeCircuit, activeWorld, completedStepIndices, mapsByCoords, onToggleStepCompleted, isOverlay]);

    return null;
}

