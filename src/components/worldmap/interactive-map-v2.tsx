'use client';

import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { Search, Map as MapIcon, Loader2, Target, Eye, EyeOff, Castle, ChevronDown } from 'lucide-react';

// Types
interface World { id: number; name: { fr: string }; totalWidth: number; totalHeight: number; origineX: number; origineY: number; mapWidth: number; mapHeight: number; zoom: number[]; visibleOnMap?: boolean; }
interface MapNode { id: number; x: number; y: number; worldMap: number; subAreaId: number; outdoor: boolean; }
interface SubArea { id: number; name: string; level: number; }
interface Dungeon { id: number; name: string; optimalPlayerLevel: number; entranceMapId: number; }
interface InteractiveMapProps { data?: { maps: MapNode[]; subareas: SubArea[]; dungeons: Dungeon[] }; }

const CUSTOM_DUNGEON_OFFSETS: Record<number, { dx: number, dy: number }> = {};

// We MUST dynamically import all Leaflet code because it relies on window
const LeafletMapCore = dynamic<any>(() => import('./leaflet-map-core'), {
    ssr: false,
    loading: () => (
        <div className="flex h-full flex-col items-center justify-center bg-[#0a0d14] rounded-xl border border-white/10">
            <Loader2 className="h-8 w-8 animate-spin text-teal-500 mb-4" />
            <p className="text-zinc-400 text-sm">Chargement du moteur Leaflet…</p>
        </div>
    )
});

export default function InteractiveMapV2({ data: initialData }: InteractiveMapProps) {
    const [worlds, setWorlds] = useState<World[]>([]);
    const [worldMap, setWorldMap] = useState<{ maps: MapNode[]; subareas: SubArea[]; dungeons: Dungeon[] } | null>(initialData || null);
    const [selectedWorldId, setSelectedWorldId] = useState<number>(1);
    const [isLoading, setIsLoading] = useState(!initialData || worlds.length === 0);
    const [search, setSearch] = useState('');
    const [showDebugGrid, setShowDebugGrid] = useState(false);
    const [selectedDungeon, setSelectedDungeon] = useState<Dungeon[] | null>(null);
    const [selectedPosition, setSelectedPosition] = useState<{ x: number, y: number, displayX: number, displayY: number, mapId?: number } | null>(null);
    const [triggerCenterPosition, setTriggerCenterPosition] = useState<{ x: number, y: number } | null>(null);
    const [previewZoom, setPreviewZoom] = useState(1);
    const previewScrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setPreviewZoom(1); // Reset zoom
    }, [selectedPosition?.mapId]);

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

    const worldMapCounts = useMemo(() => {
        if (!worldMap) return {} as Record<number, number>;
        const counts: Record<number, number> = {};
        worldMap.maps.forEach(m => { counts[m.worldMap] = (counts[m.worldMap] || 0) + 1; });
        return counts;
    }, [worldMap]);

    const visibleWorlds = useMemo(() =>
        worlds.filter(w => w.name?.fr && (worldMapCounts[w.id] || 0) >= 1),
        [worlds, worldMapCounts]);

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

    // Spatial Index
    const mapsByCoords = useMemo(() => {
        const index = new Map<string, MapNode>();
        activeMaps.forEach(m => {
            const key = `${m.x},${m.y}`;
            const existing = index.get(key);
            if (!existing || m.id > existing.id) {
                index.set(key, m);
            }
        });
        return index;
    }, [activeMaps]);

    const mapsById = useMemo(() => {
        const index = new Map<number, MapNode>();
        activeMaps.forEach(m => { index.set(m.id, m); });
        return index;
    }, [activeMaps]);

    const subAreasById = useMemo(() => {
        const index = new Map<number, SubArea>();
        worldMap?.subareas.forEach(s => { index.set(s.id, s); });
        return index;
    }, [worldMap?.subareas]);

    const dungeonsByMapId = useMemo(() => {
        const index = new Map<number, Dungeon[]>();
        worldMap?.dungeons.forEach(d => {
            if (!index.has(d.entranceMapId)) index.set(d.entranceMapId, []);
            index.get(d.entranceMapId)!.push(d);
        });
        return index;
    }, [worldMap?.dungeons]);

    const groupedDungeons = useMemo(() => {
        if (!worldMap || activeMaps.length === 0) return [];
        const results: { mapId: number, dungeons: Dungeon[], mapNode: MapNode }[] = [];
        dungeonsByMapId.forEach((dungeons, mapId) => {
            const mapNode = mapsById.get(mapId);
            if (mapNode) results.push({ mapId, dungeons, mapNode });
        });
        return results;
    }, [activeMaps.length, mapsById, dungeonsByMapId]);

    const handleCenterOnPosition = (gameX: number, gameY: number) => {
        setTriggerCenterPosition({ x: gameX, y: gameY });
    };

    if (isLoading || !activeWorld) {
        return (
            <div className="flex h-[70vh] flex-col items-center justify-center bg-[#0a0d14] rounded-xl border border-white/10">
                <Loader2 className="h-8 w-8 animate-spin text-teal-500 mb-4" />
                <p className="text-zinc-400 text-sm">Chargement des données Dofus…</p>
            </div>
        );
    }

    return (
        <div className="relative flex flex-col w-full h-full overflow-hidden bg-[#080b12]">
            {/* HUD Toolbar */}
            <div className="absolute top-4 left-4 right-4 z-[400] flex items-center justify-between pointer-events-none">
                <div className="flex items-center gap-3 pointer-events-auto">
                    <div className="relative group">
                        <button className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-slate-900 border border-white/10 text-white hover:border-emerald-500/30 transition-all shadow-xl backdrop-blur-md">
                            <MapIcon size={14} className="text-emerald-500" />
                            <span className="text-xs font-black uppercase italic tracking-tighter">{activeWorld.name.fr}</span>
                            <ChevronDown size={14} className="text-white/20" />
                        </button>
                        <div className="absolute top-full left-0 pt-2 w-60 opacity-0 scale-95 pointer-events-none group-hover:opacity-100 group-hover:scale-100 group-hover:pointer-events-auto transition-all duration-200">
                            <div className="bg-slate-900/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl p-2 max-h-[60vh] overflow-y-auto scrollbar-thin">
                                {visibleWorlds.map(w => (
                                    <button key={w.id} onClick={() => { setSelectedWorldId(w.id); setSelectedPosition(null); }}
                                        className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors mb-1 last:mb-0 ${selectedWorldId === w.id ? 'bg-emerald-500/20 text-emerald-400 font-bold' : 'text-zinc-500 hover:bg-white/5 hover:text-white'}`}>
                                        {w.name.fr}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 rounded-xl bg-slate-900/90 py-2.5 px-3 backdrop-blur-md border border-white/10 text-emerald-400 text-sm font-bold">
                        <MapIcon size={15} className="text-emerald-500/70" />
                        <span>{activeMaps.length} Maps</span>
                    </div>
                </div>

                <div className="flex items-center gap-2 pointer-events-auto">
                    <button
                        onClick={() => setShowDebugGrid(v => !v)}
                        className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl border backdrop-blur-md text-xs font-bold transition-all ${showDebugGrid ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50' : 'bg-slate-900/80 text-white/40 border-white/10 hover:text-white hover:border-white/20'}`}
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
                            className="w-48 rounded-xl bg-slate-900/80 py-2.5 pl-9 pr-4 text-white text-xs placeholder-white/20 backdrop-blur-md border border-white/10 outline-none focus:border-emerald-500/50 transition-all"
                        />
                        {searchResults.length > 0 && (
                            <div className="absolute top-full left-0 right-0 mt-2 rounded-xl bg-slate-900/95 backdrop-blur-xl border border-white/10 shadow-2xl overflow-hidden z-50">
                                {searchResults.map(s => (
                                    <button key={s.id} onClick={() => goToSubArea(s.id)}
                                        className="w-full text-left px-4 py-2.5 hover:bg-emerald-500/10 border-b border-white/5 last:border-0 transition-colors flex items-center justify-between">
                                        <span className="text-white text-xs font-medium">{s.name}</span>
                                        <span className="text-emerald-500/50 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-500/20">Lvl {s.level}</span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Core Map wrapped safely to avoid SSR leaflet window errors */}
            <div className="flex-1 w-full relative z-[1]">
                <LeafletMapCore
                    activeWorld={activeWorld}
                    selectedWorldId={selectedWorldId}
                    activeMaps={activeMaps}
                    mapsByCoords={mapsByCoords}
                    subAreasById={subAreasById}
                    dungeonsByMapId={dungeonsByMapId}
                    groupedDungeons={groupedDungeons}
                    showDebugGrid={showDebugGrid}
                    selectedPosition={selectedPosition}
                    setSelectedPosition={setSelectedPosition}
                    setSelectedDungeon={setSelectedDungeon}
                    triggerCenterPosition={triggerCenterPosition}
                />
            </div>

            {/* Dungeon Modal */}
            {selectedDungeon && (
                <div className="absolute inset-0 z-[500] bg-black/60 backdrop-blur-sm flex items-center justify-center p-6" onClick={() => setSelectedDungeon(null)}>
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
            )}

            {/* HD Map Preview Modal */}
            {selectedPosition && (
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[500] w-[95%] max-w-[900px] animate-in zoom-in-95 duration-200">
                    <div className="bg-[#0a0d14]/95 backdrop-blur-xl border border-white/10 rounded-3xl p-5 shadow-2xl flex flex-col gap-4">
                        <div className="flex items-center justify-between px-2">
                            <div className="flex items-center gap-4">
                                <h3 className="text-white font-black text-2xl tracking-tight">
                                    {selectedPosition.mapId ? subAreasById.get(mapsById.get(selectedPosition.mapId)?.subAreaId || 0)?.name || "Zone Inconnue" : "Zone Inexplorée"}
                                </h3>
                                {selectedPosition.mapId && (
                                    <span className="text-xs px-2 py-1 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">
                                        Niveau {subAreasById.get(mapsById.get(selectedPosition.mapId)?.subAreaId || 0)?.level || '?'}
                                    </span>
                                )}
                            </div>
                            <button
                                onClick={() => setSelectedPosition(null)}
                                className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/5 text-white/40 hover:bg-red-500 hover:text-white transition-all border border-white/5"
                                title="Fermer"
                            >
                                <EyeOff size={20} />
                            </button>
                        </div>

                        <div
                            ref={previewScrollRef}
                            className="relative w-full aspect-[4/3] rounded-2xl overflow-auto bg-black flex-shrink-0 border border-white/5 shadow-inner [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] cursor-grab active:cursor-grabbing"
                            onWheel={(e) => {
                                if (e.deltaY < 0) setPreviewZoom(z => Math.min(z + 0.25, 4));
                                else setPreviewZoom(z => Math.max(z - 0.25, 1));
                            }}
                            onMouseDown={(e) => {
                                const el = previewScrollRef.current;
                                if (!el) return;
                                const startX = e.pageX - el.offsetLeft;
                                const startY = e.pageY - el.offsetTop;
                                const scrollLeft = el.scrollLeft;
                                const scrollTop = el.scrollTop;

                                const onMouseMove = (moveEvent: MouseEvent) => {
                                    const x = moveEvent.pageX - el.offsetLeft;
                                    const y = moveEvent.pageY - el.offsetTop;
                                    const walkX = (x - startX) * 1.5;
                                    const walkY = (y - startY) * 1.5;
                                    el.scrollLeft = scrollLeft - walkX;
                                    el.scrollTop = scrollTop - walkY;
                                };

                                const onMouseUp = () => {
                                    window.removeEventListener('mousemove', onMouseMove);
                                    window.removeEventListener('mouseup', onMouseUp);
                                };

                                window.addEventListener('mousemove', onMouseMove);
                                window.addEventListener('mouseup', onMouseUp);
                            }}
                        >
                            {selectedPosition.mapId ? (
                                <div style={{ width: `${previewZoom * 100}%`, height: `${previewZoom * 100}%`, minWidth: '100%', minHeight: '100%', transition: 'all 0.15s ease-out' }} className="flex items-center justify-center m-auto relative pointer-events-none">
                                    <img
                                        src={`/game-data/hd_maps/${selectedPosition.mapId}.webp`}
                                        className="absolute inset-0 w-full h-full object-contain"
                                        alt="Preview HD"
                                        draggable={false}
                                    />
                                    {previewZoom > 1 && (
                                        <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 text-[10px] font-black text-white pointer-events-auto cursor-pointer hover:bg-emerald-500 transition-colors"
                                            onClick={(e) => { e.stopPropagation(); setPreviewZoom(1); }}>
                                            {Math.round(previewZoom * 100)}%
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="w-full h-full flex flex-col items-center justify-center text-white/10 gap-4">
                                    <MapIcon size={48} />
                                    <span className="text-sm font-bold">Aucune illustration générée pour cette case</span>
                                </div>
                            )}
                        </div>

                        <div className="flex items-center justify-between px-2">
                            <div className="flex items-center gap-4">
                                <p className="text-white/40 text-xs uppercase font-bold tracking-[0.2em]">
                                    {activeWorld?.name.fr}
                                </p>
                                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 font-mono font-black text-emerald-400 text-sm shadow-inner">
                                    <Target size={14} className="opacity-70" />
                                    [{selectedPosition.displayX}, {selectedPosition.displayY}]
                                </div>
                                {selectedPosition.mapId && (
                                    <div className="text-xs text-white/20 font-mono font-bold">
                                        ID : {selectedPosition.mapId}
                                    </div>
                                )}
                            </div>
                            <button
                                onClick={() => { handleCenterOnPosition(selectedPosition.x, selectedPosition.y); setSelectedPosition(null); }}
                                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 text-white hover:bg-emerald-400 font-black tracking-wide shadow-lg shadow-emerald-500/20 transition-all border border-emerald-400"
                            >
                                <Target size={18} /> Y ALLER
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="absolute bottom-3 left-4 z-[400] text-[9px] text-white/20 uppercase tracking-widest pointer-events-none">
                SigilOS Leaflet WebEngine • HD Preview Enabled
            </div>
        </div>
    );
}
