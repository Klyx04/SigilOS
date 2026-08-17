"use client";

import { useEffect, useRef } from "react";
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
}

export function HarvestRouteOverlay({
    activeWorld,
    zaaps = [],
    showZaaps = true,
    selectedResources = [],
    activeCircuit = null,
    completedStepIndices = new Set(),
    onToggleStepCompleted
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

    // 1. Mise à jour virtualisée des Zaaps et des Spots basée sur le viewport
    useEffect(() => {
        if (!map || !zaapLayerRef.current || !spotsLayerRef.current || !activeWorld) return;

        const updateMarkers = () => {
            zaapLayerRef.current?.clearLayers();
            spotsLayerRef.current?.clearLayers();

            const bounds = map.getBounds();
            const zoom = map.getZoom();

            // A. ZAAPS (icon officiel /assets/dofus/zaap.png, seulement ceux du monde actuel et dans le viewport)
            if (showZaaps) {
                const currentWorldZaaps = zaaps.filter(z => (z.worldId || 1) === activeWorld.id);

                currentWorldZaaps.forEach(zaap => {
                    const latLng = coordToLatLng(zaap.x, zaap.y);
                    if (!latLng || !bounds.contains(latLng)) return;

                    const iconHtml = `
                        <div class="zaap-badge flex flex-col items-center justify-center cursor-pointer group hover:scale-110 transition-transform">
                            <div class="w-8 h-8 rounded-full bg-sky-950/80 border border-sky-400/60 flex items-center justify-center shadow-lg shadow-sky-500/25 p-0.5 backdrop-blur-sm group-hover:border-sky-300 transition-colors">
                                <img src="/assets/dofus/zaap.png" class="w-6 h-6 object-contain drop-shadow-[0_0_5px_rgba(56,189,248,0.8)]" alt="Zaap" />
                            </div>
                            <div class="mt-0.5 bg-black/90 text-sky-200 text-[9px] font-black px-1.5 py-0.5 rounded whitespace-nowrap pointer-events-none border border-sky-400/30 shadow">
                                ${zaap.name}
                            </div>
                        </div>
                    `;

                    const icon = L.divIcon({
                        html: iconHtml,
                        className: "zaap-marker-clean",
                        iconSize: [32, 44],
                        iconAnchor: [16, 16]
                    });

                    const marker = L.marker(latLng, { icon, zIndexOffset: 800 });

                    marker.on("click", () => {
                        const cmd = `/travel ${zaap.x} ${zaap.y}`;
                        navigator.clipboard.writeText(cmd);
                        toast.success(`Zaap ${zaap.name} : ${cmd} copié !`, { duration: 1500 });
                    });

                    marker.addTo(zaapLayerRef.current!);
                });
            }

            // B. SPOTS DE RÉCOLTE (seulement en mode exploration si AUCUN circuit n'est actif, et pour le monde actuel)
            if (!activeCircuit && selectedResources.length > 0) {
                const spotsMap = new Map<string, { x: number; y: number; total: number; worldId: number; resources: { name: string; img: string; count: number }[] }>();

                selectedResources.forEach(res => {
                    res.spots.forEach(sp => {
                        const spWorldId = sp.worldId || 1;
                        if (spWorldId !== activeWorld.id) return; // Filtrage strict par sous-monde

                        const key = `${sp.x},${sp.y}`;
                        if (!spotsMap.has(key)) {
                            spotsMap.set(key, { x: sp.x, y: sp.y, total: 0, worldId: spWorldId, resources: [] });
                        }
                        const cell = spotsMap.get(key)!;
                        cell.total += sp.count;
                        cell.resources.push({ name: res.name, img: res.img, count: sp.count });
                    });
                });

                let renderedCount = 0;
                const maxRender = 120; // Plafond par vue pour garantir 120 FPS

                for (const cell of spotsMap.values()) {
                    if (renderedCount >= maxRender) break;

                    const latLng = coordToLatLng(cell.x, cell.y);
                    if (!latLng || !bounds.contains(latLng)) continue;

                    const mainRes = cell.resources[0];
                    const iconHtml = `
                        <div class="relative flex items-center justify-center cursor-pointer group hover:scale-125 transition-transform" title="${cell.resources.map(r => `${r.count}x ${r.name}`).join(', ')} [${cell.x}, ${cell.y}]">
                            <div class="w-8 h-8 rounded-full bg-black/80 border border-white/40 shadow-lg flex items-center justify-center p-0.5">
                                <img src="${mainRes.img}" class="w-5 h-5 object-contain" alt="" />
                            </div>
                            <span class="absolute -bottom-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-amber-500 text-black text-[9px] font-black flex items-center justify-center shadow border border-white leading-none">
                                ${cell.total}
                            </span>
                        </div>
                    `;

                    const icon = L.divIcon({
                        html: iconHtml,
                        className: "harvest-marker-custom",
                        iconSize: [32, 32],
                        iconAnchor: [16, 16]
                    });

                    const marker = L.marker(latLng, { icon, zIndexOffset: 700 });

                    marker.on("click", () => {
                        const cmd = `/travel ${cell.x} ${cell.y}`;
                        navigator.clipboard.writeText(cmd);
                        toast.success(`[${cell.x}, ${cell.y}] : ${cmd} copié !`, { duration: 1200 });
                    });

                    marker.addTo(spotsLayerRef.current!);
                    renderedCount++;
                }
            }
        };

        // Rendu immédiat puis aux déplacements
        updateMarkers();

        map.on("moveend", updateMarkers);
        map.on("zoomend", updateMarkers);

        return () => {
            map.off("moveend", updateMarkers);
            map.off("zoomend", updateMarkers);
        };
    }, [map, activeWorld, zaaps, showZaaps, selectedResources, activeCircuit]);

    const lastCircuitKeyRef = useRef<string | null>(null);

    // 2. Rendu du Tracé Opti-Farm (Circuit optimisé sans traversée sauvage de mer)
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

        // Préparation et optimisation du chemin (suppression du retour artificiel traversant la carte)
        const rawPoints = [...activeCircuit.path];
        const startPoint = rawPoints[0];
        
        // Extraire les étapes de récolte (sans le Zaap initial et sans la fermeture artificielle finale s'il y en avait une)
        let harvestSteps = rawPoints.slice(1);
        if (harvestSteps.length > 1) {
            const last = harvestSteps[harvestSteps.length - 1];
            if (last.x === startPoint.x && last.y === startPoint.y) {
                harvestSteps.pop();
            }
        }

        // 2-opt simple pour détricoter les croisements de lignes
        if (harvestSteps.length >= 4) {
            const d = (p1: { x: number; y: number }, p2: { x: number; y: number }) => 
                Math.hypot(p1.x - p2.x, p1.y - p2.y);
            
            let improved = true;
            let iterations = 0;
            while (improved && iterations < 30) {
                improved = false;
                iterations++;
                for (let i = 0; i < harvestSteps.length - 1; i++) {
                    for (let k = i + 1; k < harvestSteps.length; k++) {
                        const prevI = i === 0 ? startPoint : harvestSteps[i - 1];
                        const currI = harvestSteps[i];
                        const currK = harvestSteps[k];
                        const nextK = k + 1 < harvestSteps.length ? harvestSteps[k + 1] : null;

                        const currentDist = d(prevI, currI) + (nextK ? d(currK, nextK) : 0);
                        const newDist = d(prevI, currK) + (nextK ? d(currI, nextK) : 0);

                        if (newDist < currentDist - 0.001) {
                            // Inverser le segment [i, k]
                            const segment = harvestSteps.slice(i, k + 1).reverse();
                            harvestSteps.splice(i, k - i + 1, ...segment);
                            improved = true;
                        }
                    }
                }
            }
        }

        // Chemin final propre : Départ (Zaap) -> Étape 1 -> Étape 2 -> ... -> Étape N (Arrivée)
        const finalPath: { x: number; y: number; count?: number }[] = [startPoint, ...harvestSteps];

        const latLngs: L.LatLng[] = [];
        finalPath.forEach(pt => {
            const ll = coordToLatLng(pt.x, pt.y);
            if (ll) latLngs.push(ll);
        });

        if (latLngs.length < 2) return;

        // Récupérer l'icône de la ressource active
        const circuitResource = selectedResources.find(r => r.circuits?.some(c => c.zaapId === activeCircuit.zaapId && c.totalResources === activeCircuit.totalResources)) || selectedResources[0];
        const resImg = circuitResource?.img || "/game-data/harvest-icons/job-1.jpg";

        // A. Tracé de la Polyline Principale
        const polyline = L.polyline(latLngs, {
            color: "#ef4444",
            weight: 3.5,
            opacity: 0.9,
            lineCap: "round",
            lineJoin: "round"
        });

        polyline.addTo(circuitLayerRef.current);

        // B. Marqueur 🟢 POINT DE DÉPART (Zaap)
        const startPt = finalPath[0];
        const startLatLng = coordToLatLng(startPt.x, startPt.y);
        if (startLatLng) {
            const startIcon = L.divIcon({
                html: `
                    <div class="flex items-center justify-center cursor-pointer" title="Départ Zaap [${startPt.x}, ${startPt.y}]">
                        <div class="px-2.5 py-1 rounded-full bg-emerald-500 text-black font-black text-[9px] uppercase tracking-wider border border-white shadow-lg flex items-center gap-1.5 whitespace-nowrap">
                            <img src="/assets/dofus/zaap.png" class="w-3.5 h-3.5 object-contain" alt="" />
                            <span>Départ [${startPt.x}, ${startPt.y}]</span>
                        </div>
                    </div>
                `,
                className: "circuit-start-marker",
                iconSize: [120, 26],
                iconAnchor: [60, 13]
            });

            const startMarker = L.marker(startLatLng, { icon: startIcon, zIndexOffset: 950 });
            startMarker.on("click", () => {
                const cmd = `/travel ${startPt.x} ${startPt.y}`;
                navigator.clipboard.writeText(cmd);
                toast.success(`Départ : ${cmd} copié !`, { duration: 1500 });
            });
            startMarker.addTo(circuitLayerRef.current);
        }

        // C. Marqueur 🏁 POINT D'ARRIVÉE (Dernière étape récoltée)
        const endPt = finalPath[finalPath.length - 1];
        if (finalPath.length > 1) {
            const endLatLng = coordToLatLng(endPt.x, endPt.y);
            if (endLatLng) {
                const endIcon = L.divIcon({
                    html: `
                        <div class="flex items-center justify-center cursor-pointer" title="Fin de tournée [${endPt.x}, ${endPt.y}]">
                            <div class="px-2 py-0.5 rounded-full bg-rose-600 text-white font-black text-[9px] uppercase tracking-wider border border-white shadow-md flex items-center gap-1 whitespace-nowrap">
                                <span>🏁</span>
                                <span>Fin [${endPt.x}, ${endPt.y}]</span>
                            </div>
                        </div>
                    `,
                    className: "circuit-end-marker",
                    iconSize: [95, 24],
                    iconAnchor: [47, 12]
                });

                const endMarker = L.marker(endLatLng, { icon: endIcon, zIndexOffset: 940 });
                endMarker.on("click", () => {
                    const cmd = `/travel ${endPt.x} ${endPt.y}`;
                    navigator.clipboard.writeText(cmd);
                    toast.success(`Arrivée : ${cmd} copié !`, { duration: 1500 });
                });
                endMarker.addTo(circuitLayerRef.current);
            }
        }

        // D. Pastilles numérotées d'étapes avec icône de ressource le long du tracé
        finalPath.forEach((pt, idx) => {
            if (idx === 0) return; // Départ déjà affiché

            const ptLatLng = coordToLatLng(pt.x, pt.y);
            if (!ptLatLng) return;

            const isHarvested = completedStepIndices.has(idx);

            const stepIcon = L.divIcon({
                html: `
                    <div class="relative flex items-center justify-center cursor-pointer ${isHarvested ? 'opacity-40 grayscale' : ''}" title="Étape ${idx} : [${pt.x}, ${pt.y}] (${pt.count || 1} spots)${isHarvested ? ' - Récolté ✅' : ''}">
                        <span class="absolute -top-1.5 -left-1.5 min-w-[15px] h-3.5 px-0.5 rounded-full ${isHarvested ? 'bg-emerald-600' : 'bg-red-600'} text-white text-[8px] font-black flex items-center justify-center shadow border border-white z-10 leading-none">
                            ${isHarvested ? '✓' : idx}
                        </span>
                        <div class="w-8 h-8 rounded-full bg-black/90 border-2 ${isHarvested ? 'border-emerald-500' : 'border-red-500'} shadow-lg flex items-center justify-center p-0.5">
                            <img src="${resImg}" class="w-5 h-5 object-contain" alt="" />
                        </div>
                        <span class="absolute -bottom-1 -right-1 min-w-[15px] h-3.5 px-0.5 rounded-full ${isHarvested ? 'bg-emerald-500 text-white' : 'bg-amber-500 text-black'} text-[8px] font-black flex items-center justify-center shadow border border-white leading-none">
                            ${pt.count || 1}
                        </span>
                    </div>
                `,
                className: "circuit-step-marker",
                iconSize: [32, 32],
                iconAnchor: [16, 16]
            });

            const stepMarker = L.marker(ptLatLng, { icon: stepIcon, zIndexOffset: isHarvested ? 800 : 850 });
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

        // E. Ajuster la vue Leaflet sur le circuit UNIQUEMENT quand on charge un nouveau circuit
        if (isNewCircuit) {
            const bounds = L.latLngBounds(latLngs);
            map.flyToBounds(bounds, { padding: [80, 80], duration: 0.8, maxZoom: 1 });
        }

    }, [map, activeWorld, activeCircuit, selectedResources, completedStepIndices, onToggleStepCompleted]);

    return null;
}
