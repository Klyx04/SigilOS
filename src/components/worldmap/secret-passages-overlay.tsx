"use client";

import { useEffect, useRef, useState } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import { toast } from "sonner";

// Injection CSS une seule fois pour overrider le fond blanc Leaflet
let cssInjected = false;
function injectPassagePopupStyles() {
    if (cssInjected || typeof document === 'undefined') return;
    cssInjected = true;
    const style = document.createElement('style');
    style.textContent = `
        .passage-popup-custom .leaflet-popup-content-wrapper {
            background: rgba(2, 4, 8, 0.97) !important;
            border: 1px solid rgba(63, 63, 70, 0.5) !important;
            border-radius: 1rem !important;
            box-shadow: 0 20px 60px rgba(0,0,0,0.85), 0 0 0 1px rgba(255,255,255,0.04) inset !important;
            padding: 0 !important;
            color: #e4e4e7;
        }
        .passage-popup-custom .leaflet-popup-tip-container {
            display: none !important;
        }
        .passage-popup-custom .leaflet-popup-content {
            margin: 0 !important;
            font-family: inherit;
        }
        .passage-popup-custom .leaflet-popup-close-button {
            color: rgba(161, 161, 170, 0.7) !important;
            top: 8px !important;
            right: 8px !important;
            font-size: 16px !important;
        }
        .passage-popup-custom .leaflet-popup-close-button:hover {
            color: #ef4444 !important;
        }
        .passage-marker-clean {
            background: transparent !important;
            border: none !important;
        }
    `;
    document.head.appendChild(style);
}

export interface ZaapItem {
    id: number;
    name: string;
    x: number;
    y: number;
    worldId: number;
    subArea: string;
}

export interface SecretPassageItem {
    id: string;
    name: string;
    category: 'egouts' | 'foreuse' | 'bateau' | 'diligence' | 'scaeroplane' | 'canon' | 'peniche' | 'brigandin' | 'kart' | 'mine' | 'secret' | 'sous-marin' | 'tunnel' | 'zaap';
    type: string;
    worldId: number;
    x: number;
    y: number;
    description: string;
    destination?: string;
    icon?: string;
    connectedTo?: { x: number; y: number; label?: string }[];
}

interface SecretPassagesOverlayProps {
    activeWorld: {
        id: number;
        origineX: number;
        origineY: number;
        mapWidth: number;
        mapHeight: number;
    } | null;
    showPassages: boolean;
    zaaps?: ZaapItem[];
    showZaaps?: boolean;
    isOverlay?: boolean;
}

export function SecretPassagesOverlay({
    activeWorld,
    showPassages,
    zaaps = [],
    showZaaps = true,
    isOverlay = false
}: SecretPassagesOverlayProps) {
    const map = useMap();
    const layerGroupRef = useRef<L.LayerGroup | null>(null);
    const linksLayerRef = useRef<L.LayerGroup | null>(null);
    const [passages, setPassages] = useState<SecretPassageItem[]>([]);

    // 1. Charger les données une seule fois
    useEffect(() => {
        let isMounted = true;
        fetch('/game-data/secret-passages.json')
            .then(res => res.json())
            .then((data: SecretPassageItem[]) => {
                if (isMounted) setPassages(data);
            })
            .catch(err => {
                console.error("[SecretPassagesOverlay] Erreur chargement passages:", err);
            });
        return () => {
            isMounted = false;
        };
    }, []);

    // 2. Initialiser les couches Leaflet
    useEffect(() => {
        injectPassagePopupStyles();
        if (!map) return;
        layerGroupRef.current = L.layerGroup().addTo(map);
        linksLayerRef.current = L.layerGroup().addTo(map);

        return () => {
            layerGroupRef.current?.remove();
            linksLayerRef.current?.remove();
        };
    }, [map]);

    // Conversion [X, Y] -> LatLng
    const coordToLatLng = (x: number, y: number): L.LatLng | null => {
        if (!activeWorld) return null;
        const lat = -(activeWorld.origineY + y * activeWorld.mapHeight + activeWorld.mapHeight / 2);
        const lng = activeWorld.origineX + x * activeWorld.mapWidth + activeWorld.mapWidth / 2;
        return L.latLng(lat, lng);
    };

    // 3. Mise à jour des marqueurs et liaisons
    useEffect(() => {
        if (!map || !layerGroupRef.current || !linksLayerRef.current || !activeWorld) return;

        layerGroupRef.current.clearLayers();
        linksLayerRef.current.clearLayers();

        if (!showPassages) return;

        // Filtrer selon le monde actif
        const currentPassages = passages.filter(p => p.worldId === activeWorld.id);

        // Convertir les zaaps en SecretPassageItem pour les intégrer au clustering
        const zaapItems: SecretPassageItem[] = showZaaps
            ? zaaps
                .filter(z => (z.worldId || 1) === activeWorld.id)
                .map(z => ({
                    id: `zaap-${z.id}`,
                    name: z.name,
                    category: 'zaap' as const,
                    type: z.subArea || 'Zaap',
                    worldId: z.worldId || 1,
                    x: z.x,
                    y: z.y,
                    description: z.subArea || '',
                    icon: '/assets/dofus/zaap.png',
                }))
            : [];

        // Grouper les passages + zaaps par coordonnée [x, y] pour éviter les superpositions
        const grouped = new Map<string, SecretPassageItem[]>();
        [...zaapItems, ...currentPassages].forEach((passage: SecretPassageItem) => {
            const key = `${passage.x},${passage.y}`;
            if (!grouped.has(key)) grouped.set(key, []);
            grouped.get(key)!.push(passage);
        });

        // Helpers pour l'icône/couleur selon catégorie
        function getStyle(cat: string) {
            switch (cat) {
                case 'zaap':      return { border: '#38bdf8', shadow: 'rgba(56,189,248,0.7)', default: '/assets/dofus/zaap.png' };
                case 'egouts':    return { border: '#34d399', shadow: 'rgba(16,185,129,0.6)', default: '/assets/dofus/map-layers/icon-egouts.png' };
                case 'foreuse':
                case 'mine':      return { border: '#facc15', shadow: 'rgba(234,179,8,0.6)',  default: '/assets/dofus/map-layers/icon-foreuse.png' };
                case 'bateau':
                case 'sous-marin':return { border: '#22d3ee', shadow: 'rgba(6,182,212,0.6)',  default: '/assets/dofus/map-layers/icon-boat.png' };
                case 'diligence': return { border: '#fb923c', shadow: 'rgba(245,158,11,0.6)', default: '/assets/dofus/map-layers/icon-diligence.png' };
                case 'scaeroplane':return { border: '#38bdf8', shadow: 'rgba(56,189,248,0.6)',default: '/assets/dofus/map-layers/icon-scaeroplane.png' };
                case 'canon':     return { border: '#fb7185', shadow: 'rgba(244,63,94,0.6)',  default: '/assets/dofus/map-layers/icon-canon-moon.png' };
                case 'peniche':   return { border: '#2dd4bf', shadow: 'rgba(20,184,166,0.6)', default: '/assets/dofus/map-layers/icon-peniche.png' };
                case 'brigandin': return { border: '#f97316', shadow: 'rgba(249,115,22,0.6)', default: '/assets/dofus/map-layers/icon-brigandin.png' };
                case 'kart':      return { border: '#f97316', shadow: 'rgba(249,115,22,0.6)', default: '/assets/dofus/map-layers/icon-kart-down.png' };
                default:          return { border: '#fbbf24', shadow: 'rgba(245,158,11,0.6)', default: '/assets/dofus/map-layers/icon-spiral-off.png' };
            }
        }

        grouped.forEach((group, key) => {
            const first = group[0];
            const latLng = coordToLatLng(first.x, first.y);
            if (!latLng) return;

            // Calcul de la border / shadow à partir du premier élément
            const firstStyle = getStyle(first.category);

            // ── Marker : pile d'icônes ──────────────────────────────────────
            // Max 3 icônes affichées; si plus, badge "+N"
            const maxIcons = 3;
            const shown = group.slice(0, maxIcons);
            const extra = group.length - maxIcons;

            const iconsHtml = shown.map((p, i) => {
                const s = getStyle(p.category);
                const src = p.icon || s.default;
                const overlap = i > 0 ? ' -ml-2' : '';
                return `<div class="w-6 h-6 rounded-full bg-zinc-900 border-2 flex items-center justify-center p-0.5 shrink-0${overlap}" style="border-color:${s.border};box-shadow:0 0 6px ${s.shadow}"><img src="${src}" class="w-full h-full object-contain" /></div>`;
            }).join('');

            const extraBadge = extra > 0
                ? `<span class="ml-1 text-[9px] font-black text-zinc-300 bg-zinc-800 border border-zinc-600 rounded-full w-5 h-5 flex items-center justify-center shrink-0">+${extra}</span>`
                : '';

            const iconHtml = `
                <div class="passage-marker flex flex-col items-center justify-center cursor-pointer group hover:scale-110 transition-transform">
                    <div class="flex items-center bg-zinc-950/95 border border-zinc-700/80 rounded-full px-1.5 py-1 shadow-lg backdrop-blur-sm" style="box-shadow:0 0 10px ${firstStyle.shadow}">
                        ${iconsHtml}${extraBadge}
                    </div>
                    <div class="mt-0.5 bg-black/90 text-zinc-200 text-[9px] font-black px-1.5 rounded whitespace-nowrap pointer-events-none border border-zinc-700 shadow">
                        [${first.x}, ${first.y}]
                    </div>
                </div>
            `;

            const icon = L.divIcon({
                html: iconHtml,
                className: 'passage-marker-clean',
                iconSize: [Math.max(36, group.length * 14 + 16), 44],
                iconAnchor: [Math.max(18, group.length * 7 + 8), 22]
            });

            const marker = L.marker(latLng, { icon, zIndexOffset: 650 });

            // ── Popup : liste de tous les transports disponibles ──────────
            const groupId = `grp-${first.x}-${first.y}`.replace(/[^a-zA-Z0-9-]/g, '_');

            const itemsHtml = group.map((p, idx) => {
                const s = getStyle(p.category);
                const src = p.icon || s.default;
                return `
                    <div class="flex items-center gap-2 py-1.5 ${idx < group.length - 1 ? 'border-b border-zinc-800' : ''}">
                        <div class="w-7 h-7 rounded-full bg-zinc-900 border-2 flex items-center justify-center p-0.5 shrink-0" style="border-color:${s.border};box-shadow:0 0 4px ${s.shadow}">
                            <img src="${src}" class="w-full h-full object-contain" />
                        </div>
                        <div class="flex-1 min-w-0">
                            <div class="text-[11px] font-bold text-white leading-tight truncate">${p.name}</div>
                            <div class="text-[9px] text-zinc-400 font-medium">${p.type}</div>
                        </div>
                        <button
                            id="btn-travel-${groupId}-${idx}"
                            data-cmd="/travel ${p.x} ${p.y}"
                            class="shrink-0 px-2 py-1 rounded bg-emerald-700/80 hover:bg-emerald-600 text-white text-[10px] font-bold transition-all cursor-pointer whitespace-nowrap"
                        >/travel</button>
                    </div>
                `;
            }).join('');

            const popupContent = `
                <div class="p-2 min-w-[230px] max-w-[290px] text-zinc-100 font-sans">
                    <div class="flex items-center justify-between mb-2 pb-1 border-b border-zinc-700/60">
                        <span class="font-black text-xs text-white">${group.length > 1 ? group.length + ' transports disponibles' : group[0].name}</span>
                        <span class="bg-zinc-800 text-zinc-300 font-mono text-[10px] px-1.5 py-0.5 rounded border border-zinc-700 font-bold">[${first.x}, ${first.y}]</span>
                    </div>
                    ${itemsHtml}
                </div>
            `;

            marker.bindPopup(popupContent, {
                className: 'passage-popup-custom',
                maxWidth: 310
            });

            marker.on('popupopen', () => {
                group.forEach((p, idx) => {
                    const btn = document.getElementById(`btn-travel-${groupId}-${idx}`);
                    if (btn) {
                        btn.onclick = () => {
                            const cmd = btn.getAttribute('data-cmd') || `/travel ${p.x} ${p.y}`;
                            navigator.clipboard.writeText(cmd);
                            if (isOverlay) {
                                toast.success(cmd, {
                                    icon: '📍',
                                    duration: 1200,
                                    position: 'bottom-right',
                                    className: 'text-xs !py-2 !px-3 !min-h-0'
                                });
                            } else {
                                toast.success(`${cmd} copié !`, { duration: 2000 });
                            }
                        };
                    }
                });

                // Lignes de connexion du premier passage (si connectedTo)
                const withLinks = group.find(p => p.connectedTo && p.connectedTo.length > 0);
                if (withLinks && linksLayerRef.current) {
                    linksLayerRef.current.clearLayers();
                    withLinks.connectedTo!.forEach(conn => {
                        const targetLatLng = coordToLatLng(conn.x, conn.y);
                        if (targetLatLng) {
                            L.polyline([latLng, targetLatLng], {
                                color: '#10b981', weight: 2, opacity: 0.8, dashArray: '5, 8'
                            }).addTo(linksLayerRef.current!);
                        }
                    });
                }
            });

            marker.on('popupclose', () => {
                linksLayerRef.current?.clearLayers();
            });

            marker.addTo(layerGroupRef.current!);
        });

    }, [map, showPassages, passages, zaaps, showZaaps, activeWorld, isOverlay]);

    return null;
}
