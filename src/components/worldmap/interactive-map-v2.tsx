'use client';

import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { TransformWrapper, TransformComponent, useTransformContext } from 'react-zoom-pan-pinch';
import { Search, Map as MapIcon, Loader2, Target, Eye, EyeOff, Castle, ChevronDown } from 'lucide-react';

// DofusDB parfois fournit des métadonnées avec une largeur légèrement inférieure à la grille réelle des tuiles.
// Ces valeurs forcées permettent d'aligner parfaitement les lignes pour les mondes problématiques.
const WORLD_COLS_OVERRIDES: Record<number, number> = {
    10: 15, // Village de la Canopée
    18: 15, // Pyramide Maudite
    22: 9,  // Crocuzko
    12: 14, // Château de Harebourg
    16: 21, // Ecaflipus
    21: 15, // Île de Pwâk
};

interface World {
    id: number;
    name: { fr: string };
    totalWidth: number;
    totalHeight: number;
    origineX: number;
    origineY: number;
    mapWidth: number;
    mapHeight: number;
    zoom: number[];
    visibleOnMap?: boolean;
}

interface MapNode {
    id: number;
    x: number;
    y: number;
    worldMap: number;
    subAreaId: number;
    outdoor: boolean;
}

interface SubArea {
    id: number;
    name: string;
    level: number;
}

interface Dungeon {
    id: number;
    name: string;
    optimalPlayerLevel: number;
    entranceMapId: number;
}

interface InteractiveMapProps {
    data?: { maps: MapNode[]; subareas: SubArea[]; dungeons: Dungeon[] };
}

const CUSTOM_DUNGEON_OFFSETS: Record<number, { dx: number, dy: number }> = {
    // Exemple : Brasserie du Roi des Nains
    // 59507204: { dx: 15, dy: -25 },
};

declare global {
    interface Window { hdTimeout?: NodeJS.Timeout; }
}

export default function InteractiveMapV2({ data: initialData }: InteractiveMapProps) {
    const [worlds, setWorlds] = useState<World[]>([]);
    const [worldMap, setWorldMap] = useState<{ maps: MapNode[]; subareas: SubArea[]; dungeons: Dungeon[] } | null>(initialData || null);
    const [selectedWorldId, setSelectedWorldId] = useState<number>(1);
    const [isLoading, setIsLoading] = useState(!initialData || worlds.length === 0);
    const [search, setSearch] = useState('');
    const [showDebugGrid, setShowDebugGrid] = useState(false);
    const [selectedDungeon, setSelectedDungeon] = useState<Dungeon[] | null>(null);
    const [selectedPosition, setSelectedPosition] = useState<{ x: number, y: number, mapId?: number } | null>(null);

    // Refs for DOM manipulation (zero re-renders for mouse events)
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const viewportTooltipRef = useRef<HTMLDivElement>(null);
    const viewportTooltipTextRef = useRef<HTMLSpanElement>(null);
    const hudCoordsRef = useRef<HTMLSpanElement>(null);
    const hudRef = useRef<HTMLDivElement>(null);
    const hudDungeonRef = useRef<HTMLDivElement>(null);
    // Synced every frame from TransformWrapper callbacks
    const transformRef = useRef({ x: 0, y: 0, scale: 0.15 });

    const [containerSize, setContainerSize] = useState({ w: 0, h: 0 });
    useEffect(() => {
        if (!containerRef.current) return;
        // Mesure initiale
        const measure = () => {
            const el = containerRef.current;
            if (!el) return;
            const { clientWidth: w, clientHeight: h } = el;
            if (w > 0 && h > 0) setContainerSize({ w, h });
        };
        measure();
        // ResizeObserver pour capturer les changements de taille dynamiquement
        const ro = new ResizeObserver(measure);
        ro.observe(containerRef.current);
        return () => ro.disconnect();
    }, []);

    // Re-mesure quand on change de monde pour forcer le recalcul
    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;
        const { clientWidth: w, clientHeight: h } = el;
        if (w > 0 && h > 0) setContainerSize({ w, h });
    }, [selectedWorldId]);

    useEffect(() => {
        const loadData = async () => {
            try {
                const fetchers: Promise<unknown>[] = [];
                if (worlds.length === 0) fetchers.push(fetch('/game-data/worlds.json').then(r => r.json()));
                if (!worldMap) fetchers.push(fetch('/game-data/worldmap.json').then(r => r.json()));
                if (fetchers.length === 0) return;
                const results = await Promise.all(fetchers);
                let i = 0;
                if (worlds.length === 0) { setWorlds(results[i] as World[]); i++; }
                if (!worldMap) { setWorldMap(results[i] as { maps: MapNode[]; subareas: SubArea[]; dungeons: Dungeon[] }); }
            } catch (err) {
                console.error('Failed to load map data:', err);
            } finally {
                setIsLoading(false);
            }
        };
        loadData();
    }, [worlds.length, worldMap]);

    const activeWorld = useMemo(() => worlds.find(w => w.id === selectedWorldId), [worlds, selectedWorldId]);
    const activeMaps = useMemo(() => {
        if (!worldMap || !activeWorld) return [];
        return worldMap.maps.filter(m => m.worldMap === selectedWorldId);
    }, [worldMap, selectedWorldId, activeWorld]);

    // DofusDB generates overview tiles ONLY for worlds where visibleOnMap is true!
    // We only disable them if totalWidth is 0 (missing data).
    const isSmallWorld = !activeWorld?.totalWidth;

    // Calculate the bounding box based on actual maps to fix the unreliable JSON data (like in Village de la Canopée).
    const mapsBBox = useMemo(() => {
        if (!activeMaps || !activeWorld) return null;
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        activeMaps.forEach(m => {
            const px = activeWorld.origineX + m.x * activeWorld.mapWidth;
            const py = activeWorld.origineY + m.y * activeWorld.mapHeight;
            if (px < minX) minX = px;
            if (px + activeWorld.mapWidth > maxX) maxX = px + activeWorld.mapWidth;
            if (py < minY) minY = py;
            if (py + activeWorld.mapHeight > maxY) maxY = py + activeWorld.mapHeight;
        });
        const width = maxX - minX;
        const height = maxY - minY;
        return {
            minX, maxX, minY, maxY,
            width, height,
            centerX: minX + width / 2,
            centerY: minY + height / 2
        };
    }, [activeMaps, activeWorld]);

    const initialScale = useMemo(() => {
        if (!activeWorld || !mapsBBox || !mapsBBox.width || !mapsBBox.height) return 0.15;
        const w = containerSize.w || (typeof window !== 'undefined' ? window.innerWidth * 0.82 : 900);
        const h = containerSize.h || (typeof window !== 'undefined' ? window.innerHeight * 0.7 : 600);

        // Fit: on cherche l'échelle qui fait TENIR la zone entière dans le composant (letters)
        // avec une petite marge pour que ce soit agréable
        const margin = 0.92; // 8% de marge visuelle
        const scaleW = (w * margin) / mapsBBox.width;
        const scaleH = (h * margin) / mapsBBox.height;
        const s = Math.min(scaleW, scaleH);

        // Bornes raisonnables : jamais plus petite que 0.03, jamais plus grande que 2
        return Math.max(0.03, Math.min(s, 2.0));
    }, [activeWorld, containerSize, mapsBBox]);

    const initialPositionX = useMemo(() => {
        if (!mapsBBox) return 0;
        const w = containerSize.w || 900;
        return w / 2 - mapsBBox.centerX * initialScale;
    }, [containerSize, mapsBBox, initialScale]);

    const initialPositionY = useMemo(() => {
        if (!mapsBBox) return 0;
        const h = containerSize.h || 600;
        return h / 2 - mapsBBox.centerY * initialScale;
    }, [containerSize, mapsBBox, initialScale]);

    // Only show worlds that have actual maps
    const worldMapCounts = useMemo(() => {
        if (!worldMap) return {} as Record<number, number>;
        const counts: Record<number, number> = {};
        worldMap.maps.forEach(m => { counts[m.worldMap] = (counts[m.worldMap] || 0) + 1; });
        return counts;
    }, [worldMap]);

    const visibleWorlds = useMemo(() =>
        worlds.filter(w => w.name?.fr && (worldMapCounts[w.id] || 0) >= 10),
        [worlds, worldMapCounts]);

    const tilesData = useMemo(() => {
        if (!activeWorld || isSmallWorld) return { tiles: [], cols: 0, rows: 0 };

        const cols = WORLD_COLS_OVERRIDES[selectedWorldId] || Math.ceil((activeWorld.totalWidth || 0) / 256);
        const rows = Math.ceil((activeWorld.totalHeight || 0) / 256);

        const tiles: { url: string; x: number; y: number }[] = [];
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const i = r * cols + c + 1;
                tiles.push({
                    url: `https://api.dofusdb.fr/img/worlds/${selectedWorldId}/1/${i}.jpg`,
                    x: c * 256,
                    y: r * 256
                });
            }
        }
        return { tiles, cols, rows };
    }, [activeWorld, selectedWorldId, isSmallWorld]);

    // Dezoom minimum = voir 2x la zone en entier, zoom max = 8x
    const minScale = useMemo(() => Math.max(0.01, initialScale * 0.3), [initialScale]);

    const searchResults = useMemo(() => {
        if (!search || !worldMap) return [];
        const t = search.toLowerCase();
        return worldMap.subareas.filter(s => s.name.toLowerCase().includes(t)).slice(0, 10);
    }, [search, worldMap]);

    const goToSubArea = (subAreaId: number) => {
        if (!worldMap) return;
        const m = worldMap.maps.find(m => m.subAreaId === subAreaId);
        if (m) { setSelectedWorldId(m.worldMap); setSearch(''); }
    };

    const groupedDungeons = useMemo(() => {
        if (!worldMap || !activeMaps) return [];
        const groups = new Map<number, Dungeon[]>();
        worldMap.dungeons.forEach(d => {
            if (!activeMaps.find(m => m.id === d.entranceMapId)) return;
            if (!groups.has(d.entranceMapId)) groups.set(d.entranceMapId, []);
            groups.get(d.entranceMapId)!.push(d);
        });
        return Array.from(groups.entries()).map(([mapId, dungeons]) => ({
            mapId,
            dungeons,
            mapNode: activeMaps.find(m => m.id === mapId)
        })).filter(g => g.mapNode);
    }, [worldMap, activeMaps]);

    const handleContentClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        if (!activeWorld) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const clickX = (e.clientX - rect.left) / transformRef.current.scale;
        const clickY = (e.clientY - rect.top) / transformRef.current.scale;
        const gameX = Math.floor((clickX - activeWorld.origineX) / activeWorld.mapWidth);
        const gameY = Math.floor((clickY - activeWorld.origineY) / activeWorld.mapHeight);
        const foundMap = activeMaps.find(m => m.x === gameX && m.y === gameY);
        setSelectedPosition({ x: gameX, y: gameY, mapId: foundMap?.id });
    }, [activeWorld, activeMaps]);

    // Draw debug grid dots
    useEffect(() => {
        if (!canvasRef.current || !activeWorld) return;
        const ctx = canvasRef.current.getContext('2d');
        if (!ctx) return;
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        // Canvas stays empty, Grid toggle now uses CSS opacity on the background
    }, [activeWorld, activeMaps, showDebugGrid]);

    // ─── Mouse tracking on the OUTER viewport div (outside the transform) ──────────────────
    // We apply the inverse transform ourselves: mapCoord = (viewportCoord - positionXY) / scale
    // This is pixel-perfect regardless of what child element the mouse is over.
    const handleViewportMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        if (!activeWorld || !viewportTooltipRef.current || !viewportTooltipTextRef.current || !hudCoordsRef.current) return;

        const rect = e.currentTarget.getBoundingClientRect();
        const { x: posX, y: posY, scale } = transformRef.current;

        // viewportX/Y: position relative to top-left of the container
        const viewX = e.clientX - rect.left;
        const viewY = e.clientY - rect.top;

        // Inverse transform: viewport space → map/content space
        const mapX = (viewX - posX) / scale;
        const mapY = (viewY - posY) / scale;

        const gameX = Math.floor((mapX - activeWorld.origineX) / activeWorld.mapWidth);
        const gameY = Math.floor((mapY - activeWorld.origineY) / activeWorld.mapHeight);

        const coordsText = `${gameX}, ${gameY}`;
        viewportTooltipRef.current.style.left = `${viewX + 15}px`;
        viewportTooltipRef.current.style.top = `${viewY + 15}px`;
        viewportTooltipRef.current.style.display = 'block';
        viewportTooltipTextRef.current.textContent = coordsText;

        hudCoordsRef.current.textContent = `Position : ${coordsText}`;

        const foundMap = activeMaps.find(m => m.x === gameX && m.y === gameY);
        if (foundMap) {
            hudRef.current?.classList.remove('hidden');
            hudRef.current?.classList.add('flex');
            const dungs = worldMap?.dungeons?.filter(d => d.entranceMapId === foundMap.id) || [];
            if (hudDungeonRef.current) {
                if (dungs.length > 0) {
                    const d = dungs[0];
                    hudDungeonRef.current.innerHTML = `
                        <div class="flex flex-col items-center gap-0.5 border-l border-white/10 pl-5">
                            <span class="text-amber-400 text-xs uppercase tracking-wider font-bold truncate max-w-[200px]">${d.name}</span>
                            <span class="text-white/40 text-[10px]">Niv. ${d.optimalPlayerLevel}</span>
                        </div>`;
                    hudDungeonRef.current.classList.remove('hidden');
                } else {
                    hudDungeonRef.current.classList.add('hidden');
                    hudDungeonRef.current.innerHTML = '';
                }
            }
        } else {
            hudRef.current?.classList.add('hidden');
            hudRef.current?.classList.remove('flex');
        }
    }, [activeWorld, activeMaps, worldMap]);

    const handleViewportMouseLeave = useCallback(() => {
        if (viewportTooltipRef.current) viewportTooltipRef.current.style.display = 'none';
        hudRef.current?.classList.add('hidden');
        hudRef.current?.classList.remove('flex');
    }, []);

    const [hdBounds, setHdBounds] = useState({ startX: 0, endX: 0, startY: 0, endY: 0, scale: 0, show: false });

    const visibleActiveMaps = useMemo(() => {
        if (!hdBounds.show || !activeWorld) return [];
        return activeMaps.filter(m => {
            const px = activeWorld.origineX + m.x * activeWorld.mapWidth;
            const py = activeWorld.origineY + m.y * activeWorld.mapHeight;
            return px >= hdBounds.startX && px <= hdBounds.endX && py >= hdBounds.startY && py <= hdBounds.endY;
        });
    }, [activeMaps, activeWorld, hdBounds]);

    const syncTransform = useCallback((ref: { state: { positionX: number; positionY: number; scale: number } }) => {
        transformRef.current = { x: ref.state.positionX, y: ref.state.positionY, scale: ref.state.scale };

        if (window.hdTimeout) clearTimeout(window.hdTimeout);
        window.hdTimeout = setTimeout(() => {
            const { positionX, positionY, scale } = ref.state;
            const threshold = activeWorld?.visibleOnMap ? 1.2 : 0.05;
            if (scale < threshold) {
                setHdBounds(prev => prev.show ? { ...prev, show: false } : prev);
                return;
            }
            const margin = 500 / scale;
            const w = containerSize.w || 900;
            const h = containerSize.h || 600;
            setHdBounds({
                startX: (-positionX / scale) - margin,
                endX: (-positionX / scale) + (w / scale) + margin * 2,
                startY: (-positionY / scale) - margin,
                endY: (-positionY / scale) + (h / scale) + margin * 2,
                scale,
                show: true
            });
        }, 100);
    }, [activeWorld, containerSize]);

    if (isLoading) {
        return (
            <div className="flex h-[70vh] flex-col items-center justify-center bg-[#0a0d14] rounded-xl border border-white/10">
                <Loader2 className="h-8 w-8 animate-spin text-teal-500 mb-4" />
                <p className="text-zinc-400 text-sm">Chargement de la carte…</p>
            </div>
        );
    }

    const mapKey = `${selectedWorldId}-${containerSize.w}-${containerSize.h}`;

    return (
        <div
            className="relative flex flex-col w-full h-[calc(100vh-12rem)] min-h-[500px] overflow-hidden rounded-2xl border border-white/10 shadow-2xl"
            style={{
                backgroundImage: `url('https://api.dofusdb.fr/img/map_background.jpg')`,
                backgroundRepeat: 'repeat'
            }}
        >
            {/* HUD Toolbar */}
            <div className="absolute top-4 left-4 right-4 z-50 flex items-center justify-between pointer-events-none">
                <div className="flex items-center gap-3 pointer-events-auto">
                    <div className="relative">
                        <select
                            value={selectedWorldId}
                            onChange={e => setSelectedWorldId(Number(e.target.value))}
                            className="appearance-none bg-slate-900/90 text-white text-sm font-bold pl-4 pr-9 py-2.5 rounded-xl border border-white/10 shadow-lg outline-none cursor-pointer hover:border-emerald-500/40 transition-all backdrop-blur-md"
                        >
                            {visibleWorlds.map(w => (
                                <option key={w.id} value={w.id} className="bg-slate-900">{w.name.fr}</option>
                            ))}
                        </select>
                        <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none" size={13} />
                    </div>
                    <div className="flex items-center gap-2 rounded-xl bg-slate-900/90 py-2.5 px-3 backdrop-blur-md border border-white/10 text-emerald-400 text-sm font-bold">
                        <MapIcon size={15} className="text-emerald-500/70" />
                        <span>{activeMaps.length} Maps</span>
                    </div>
                </div>

                <div className="flex items-center gap-2 pointer-events-auto">
                    <button
                        onClick={() => setShowDebugGrid(v => !v)}
                        title={showDebugGrid ? "Masquer la grille de coordonnées" : "Afficher la grille de coordonnées"}
                        className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl border backdrop-blur-md text-xs font-bold transition-all ${showDebugGrid
                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50'
                            : 'bg-slate-900/80 text-white/40 border-white/10 hover:text-white hover:border-white/20'
                            }`}
                    >
                        {showDebugGrid ? <Eye size={14} /> : <EyeOff size={14} />}
                        Grille
                    </button>

                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" size={14} />
                        <input
                            type="text"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Rechercher une zone…"
                            className="w-60 rounded-xl bg-slate-900/80 py-2.5 pl-9 pr-4 text-white text-sm placeholder-white/20 backdrop-blur-md border border-white/10 outline-none focus:border-emerald-500/50 transition-all"
                        />
                        {searchResults.length > 0 && (
                            <div className="absolute top-full left-0 right-0 mt-2 rounded-xl bg-slate-900/95 backdrop-blur-xl border border-white/10 shadow-2xl overflow-hidden z-50">
                                {searchResults.map(s => (
                                    <button key={s.id} onClick={() => goToSubArea(s.id)}
                                        className="w-full text-left px-4 py-2.5 hover:bg-emerald-500/10 border-b border-white/5 last:border-0 transition-colors flex items-center justify-between">
                                        <span className="text-white text-sm font-medium">{s.name}</span>
                                        <span className="text-emerald-500/50 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-500/20">Lvl {s.level}</span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Map Viewport — mouse tracking is here (outer div, outside transform) */}
            <div
                ref={containerRef}
                className="flex-1 w-full overflow-hidden cursor-crosshair bg-repeat"
                style={{
                    backgroundImage: `url('https://api.dofusdb.fr/img/map_background.jpg')`,
                }}
                onMouseMove={handleViewportMouseMove}
                onMouseLeave={handleViewportMouseLeave}
                onContextMenu={(e) => e.preventDefault()}
            >
                {/* Floating tooltip like DofusDB */}
                <div ref={viewportTooltipRef} className="absolute pointer-events-none z-[100] hidden">
                    <div className="bg-[#1e2025]/95 text-white font-mono font-bold text-xs px-2.5 py-1.5 rounded border border-white/10 whitespace-nowrap shadow-xl">
                        <span ref={viewportTooltipTextRef}></span>
                    </div>
                </div>

                {activeWorld && (
                    <TransformWrapper
                        key={mapKey}
                        initialScale={initialScale}
                        initialPositionX={initialPositionX}
                        initialPositionY={initialPositionY}
                        minScale={minScale}
                        maxScale={8}
                        centerOnInit={false}
                        limitToBounds={false}
                        panning={{ velocityDisabled: false, allowLeftClickPan: true, allowRightClickPan: false }}
                        wheel={{ step: 0.08 }}
                        pinch={{ step: 5 }}
                        doubleClick={{ disabled: true }}
                        onTransformed={(ref) => syncTransform(ref as Parameters<typeof syncTransform>[0])}
                        onInit={(ref) => syncTransform(ref as Parameters<typeof syncTransform>[0])}
                    >
                        <TransformComponent wrapperClass="!w-full !h-full" contentClass="!w-auto !h-auto cursor-grab active:cursor-grabbing">
                            <div
                                className="relative"
                                style={{ width: activeWorld.totalWidth, height: activeWorld.totalHeight }}
                                onContextMenu={(e) => { e.preventDefault(); handleContentClick(e); }}
                            >
                                {/* Giant parchment background that pans and zooms infinitely relative to content */}
                                <div
                                    className="absolute pointer-events-none"
                                    style={{
                                        left: -80000, top: -80000,
                                        width: 160000, height: 160000,
                                        backgroundImage: `url('https://api.dofusdb.fr/img/map_background.jpg')`,
                                        backgroundRepeat: 'repeat',
                                        zIndex: -1
                                    }}
                                />

                                {/* Infinite debug grid lines */}
                                <div
                                    className="absolute pointer-events-none transition-opacity duration-300"
                                    style={{
                                        left: -80000, top: -80000, width: 160000, height: 160000,
                                        backgroundImage: `
                                            linear-gradient(to right, rgba(0,0,0,0.1) 1px, transparent 1px),
                                            linear-gradient(to bottom, rgba(0,0,0,0.1) 1px, transparent 1px)`,
                                        backgroundSize: `${activeWorld.mapWidth}px ${activeWorld.mapHeight}px`,
                                        backgroundPosition: `${activeWorld.origineX}px ${activeWorld.origineY}px`,
                                        zIndex: 1,
                                        opacity: showDebugGrid ? 1 : 0,
                                    }}
                                />

                                {/* Overview parchment tiles — absolute positioning to prevent desync shifts */}
                                {!isSmallWorld && (
                                    <div className="absolute inset-0 pointer-events-none"
                                        style={{
                                            width: activeWorld.totalWidth,
                                            height: activeWorld.totalHeight,
                                            zIndex: 2,
                                        }}
                                    >
                                        {tilesData.tiles.map((tile, i) => (
                                            <img key={`tile-${i}`} src={tile.url} alt=""
                                                className="w-[256px] h-[256px] absolute pointer-events-none select-none"
                                                style={{ left: tile.x, top: tile.y }}
                                                loading="lazy" />
                                        ))}
                                    </div>
                                )}

                                {/* HD map tiles — shown when zoomed in */}
                                <div className="absolute inset-0 z-0 pointer-events-none">
                                    {visibleActiveMaps.map(m => (
                                        <img key={`hrm-${m.id}`}
                                            src={`https://api.dofusdb.fr/img/maps/1/${m.id}.jpg`}
                                            alt=""
                                            style={{
                                                position: 'absolute',
                                                left: activeWorld.origineX + m.x * activeWorld.mapWidth,
                                                top: activeWorld.origineY + m.y * activeWorld.mapHeight,
                                                width: activeWorld.mapWidth,
                                                height: activeWorld.mapHeight,
                                            }}
                                            className="select-none pointer-events-none"
                                            loading="lazy"
                                        />
                                    ))}
                                </div>

                                {/* Debug canvas */}
                                <canvas
                                    ref={canvasRef}
                                    width={activeWorld.totalWidth}
                                    height={activeWorld.totalHeight}
                                    className="absolute inset-0 pointer-events-none"
                                    style={{ zIndex: 60 }}
                                />

                                {/* Dungeon pins */}
                                {groupedDungeons.map(group => {
                                    const dMap = group.mapNode!;
                                    const dCount = group.dungeons.length;
                                    const displayName = dCount > 1 ? `${dCount} Donjons` : group.dungeons[0].name;
                                    const displayLevel = dCount > 1 ? `-` : group.dungeons[0].optimalPlayerLevel;

                                    const offset = CUSTOM_DUNGEON_OFFSETS[group.mapId] || { dx: 0, dy: 0 };

                                    return (
                                        <button
                                            key={`d-map-${group.mapId}`}
                                            onClick={e => { e.stopPropagation(); setSelectedDungeon(group.dungeons); }}
                                            className="absolute group"
                                            style={{
                                                left: activeWorld.origineX + dMap.x * activeWorld.mapWidth + activeWorld.mapWidth / 2 + offset.dx,
                                                top: activeWorld.origineY + dMap.y * activeWorld.mapHeight + activeWorld.mapHeight / 2 + offset.dy,
                                                transform: 'translate(-50%,-50%)',
                                                zIndex: 40,
                                            }}
                                        >
                                            <div className="w-7 h-7 rounded-full bg-slate-900/90 border-2 border-amber-500/80 shadow-[0_0_12px_rgba(245,158,11,0.4)] flex items-center justify-center text-amber-400 group-hover:scale-125 group-hover:border-amber-400 transition-all duration-200 relative">
                                                <Castle size={13} />
                                                {dCount > 1 && (
                                                    <div className="absolute -top-2 -right-2 bg-amber-500 text-black text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center border border-slate-900 pointer-events-none">
                                                        {dCount}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity p-2 bg-slate-900/95 border border-amber-500/30 rounded-lg shadow-xl pointer-events-none flex flex-col items-center min-w-max backdrop-blur-md">
                                                <span className="text-amber-400 font-bold text-xs">{displayName}</span>
                                                {displayLevel !== '-' && <span className="text-white/40 text-[10px]">Niv. {displayLevel}</span>}
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </TransformComponent>
                    </TransformWrapper>
                )}
            </div>

            {/* Bottom HUD */}
            <div
                ref={hudRef}
                className="hidden absolute bottom-4 left-1/2 -translate-x-1/2 z-50 rounded-xl bg-slate-900/95 px-5 py-2.5 backdrop-blur-xl border border-emerald-500/20 text-emerald-400 items-center gap-5 shadow-[0_0_20px_rgba(16,185,129,0.12)]"
            >
                <div className="flex items-center gap-2">
                    <Target size={14} />
                    <span ref={hudCoordsRef} className="font-mono text-sm">Position : -, -</span>
                </div>
                <div ref={hudDungeonRef} className="hidden" />
            </div>

            {/* Dungeon Modal */}
            {
                selectedDungeon && (
                    <div className="absolute inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-6" onClick={() => setSelectedDungeon(null)}>
                        <div className="bg-slate-900 border border-white/10 rounded-2xl p-6 max-w-md w-full shadow-2xl" onClick={e => e.stopPropagation()}>
                            <div className="flex items-center gap-3 mb-5">
                                <div className="w-11 h-11 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500">
                                    <Castle size={22} />
                                </div>
                                <div>
                                    <h3 className="text-white font-bold text-lg">{selectedDungeon.length > 1 ? `${selectedDungeon.length} Donjons détectés` : selectedDungeon[0].name}</h3>
                                    {selectedDungeon.length === 1 && (
                                        <p className="text-white/40 text-sm">Niv. recommandé : {selectedDungeon[0].optimalPlayerLevel}</p>
                                    )}
                                </div>
                            </div>
                            {selectedDungeon.length > 1 && (
                                <div className="flex flex-col gap-2 mb-5">
                                    {selectedDungeon.map(d => (
                                        <div key={d.id} className="bg-white/5 border border-white/10 rounded-lg p-3 flex justify-between items-center">
                                            <span className="text-white font-medium text-sm">{d.name}</span>
                                            <span className="text-amber-500/80 text-xs">Niv. {d.optimalPlayerLevel}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                            <div className="bg-black/40 rounded-xl p-4 border border-white/5 mb-5 text-sm text-zinc-400">
                                Interactions futures prévues sur ce donjon :
                                <ul className="list-disc pl-4 mt-2 space-y-1 text-zinc-500">
                                    <li>Poster un appel LFG guilde</li>
                                    <li>Lier une mission de guilde</li>
                                    <li>Voir les ressources disponibles</li>
                                </ul>
                            </div>
                            <div className="flex justify-end gap-3">
                                <button onClick={() => setSelectedDungeon(null)} className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-white text-sm font-medium transition-colors">Fermer</button>
                                <button className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium shadow-lg transition-all opacity-50 cursor-not-allowed">À venir</button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Position Modal */}
            {
                selectedPosition && (
                    <div className="absolute inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-6" onClick={() => setSelectedPosition(null)}>
                        <div className="bg-slate-900 border border-white/10 rounded-2xl p-6 max-w-md w-full shadow-2xl" onClick={e => e.stopPropagation()}>
                            <div className="flex items-center gap-3 mb-5">
                                <div className="w-11 h-11 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500">
                                    <Target size={22} />
                                </div>
                                <div>
                                    <h3 className="text-white font-bold text-lg">Position {selectedPosition.x}, {selectedPosition.y}</h3>
                                    <p className="text-white/40 text-sm">{selectedPosition.mapId ? `Map ID: ${selectedPosition.mapId}` : 'Aucune map détectée ici'}</p>
                                </div>
                            </div>
                            <div className="bg-black/40 rounded-xl p-4 border border-white/5 mb-5 text-sm text-zinc-400">
                                Interactions futures prévues sur cette position :
                                <ul className="list-disc pl-4 mt-2 space-y-1 text-zinc-500">
                                    <li>Partager cette position à la guilde</li>
                                    <li>Ajouter un repère (artisan, récolte, event)</li>
                                    <li>Créer ou lier une mission de guilde personnalisée</li>
                                </ul>
                            </div>
                            <div className="flex justify-end gap-3">
                                <button onClick={() => setSelectedPosition(null)} className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-white text-sm font-medium transition-colors">Fermer</button>
                                <button className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium shadow-lg transition-all opacity-50 cursor-not-allowed">À venir</button>
                            </div>
                        </div>
                    </div>
                )
            }

            <div className="absolute bottom-3 left-4 z-10 text-[9px] text-white/20 uppercase tracking-widest pointer-events-none">
                Dofus World Engine • Beta v1.0
            </div>
        </div >
    );
}
