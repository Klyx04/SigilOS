'use client';

import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import {
    Search, Map as MapIcon, Loader2, Target, Eye, EyeOff, Trophy,
    Clock, ZoomIn, Compass, ChevronDown, Plus, Minus
} from 'lucide-react';
import { WorldData, MapNode, SubArea, Dungeon } from '@/types/worldmap';
import { submitGeoguesserScore } from '@/server/actions/geoguesser-actions';
import {
    createGeoguesserSession,
    getActiveGeoguesserSessions,
    joinGeoguesserSession,
    startGeoguesserSession,
    leaveGeoguesserSession,
    getSessionStatus,
    advanceSessionRound
} from '@/server/actions/geoguesser-multi-actions';
import { useSession } from 'next-auth/react';
import { toast } from 'sonner';

const LeafletMapCore = dynamic<any>(() => import('./leaflet-map-core'), {
    ssr: false,
    loading: () => (
        <div className="w-full h-full bg-slate-950 flex items-center justify-center">
            <div className="flex flex-col items-center gap-4">
                <div className="w-12 h-12 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
                <p className="text-emerald-500/50 font-black text-xs uppercase tracking-widest italic">Chargement du Monde...</p>
            </div>
        </div>
    )
});

interface InteractiveMapProps {
    worldMap: WorldData;
    initialLadder?: any[];
}

export default function InteractiveMapV2({ worldMap, initialLadder }: InteractiveMapProps) {
    const { data: sessionData } = useSession();
    const currentUserId = sessionData?.user?.id;
    const [selectedWorldId, setSelectedWorldId] = useState(1);
    const [activeTab, setActiveTab] = useState<'map' | 'games'>('map');

    // UI States
    const [search, setSearch] = useState('');
    const [showDebugGrid, setShowDebugGrid] = useState(false);
    const [selectedPosition, setSelectedPosition] = useState<any>(null);
    const [selectedDungeon, setSelectedDungeon] = useState<Dungeon[] | null>(null);
    const [triggerCenterPosition, setTriggerCenterPosition] = useState<{ x: number, y: number } | null>(null);

    // Mini-Jeux States
    const [gamePhase, setGamePhase] = useState<'idle' | 'playing' | 'result' | 'summary'>('idle');
    const [activeSession, setActiveSession] = useState<any>(null);
    const [availableSessions, setAvailableSessions] = useState<any[]>([]);
    const [guessResult, setGuessResult] = useState<any>(null);

    const guildId = typeof window !== 'undefined' ? window.location.pathname.split('/')[2] : '';

    const fetchLobbies = useCallback(async () => {
        if (!guildId) return;
        try {
            const sessions = await getActiveGeoguesserSessions(guildId);
            setAvailableSessions(sessions);

            if (currentUserId) {
                const mySession = sessions.find((s: any) =>
                    s.participants?.some((p: any) => p.userId === currentUserId)
                );
                if (mySession) {
                    setActiveSession(mySession);
                } else if (activeSession) {
                    setActiveSession(null);
                }
            }
        } catch (e) { }
    }, [guildId, currentUserId, activeSession]);

    useEffect(() => {
        if (activeTab === 'games' && gamePhase === 'idle') {
            fetchLobbies();
            const interval = setInterval(fetchLobbies, 4000);
            return () => clearInterval(interval);
        }
    }, [activeTab, gamePhase, fetchLobbies]);

    const activeWorld = useMemo(() =>
        worldMap.worlds?.find(w => w.id === selectedWorldId) || worldMap.worlds?.[0],
        [worldMap, selectedWorldId]);

    const activeMaps = useMemo(() =>
        worldMap.maps?.filter(m => m.worldMap === selectedWorldId) || [],
        [worldMap.maps, selectedWorldId]);

    const visibleWorlds = useMemo(() =>
        worldMap.worlds?.filter(w => worldMap.maps?.some(m => m.worldMap === w.id)) || [],
        [worldMap]);

    const searchResults = useMemo(() => {
        if (!search) return [];
        const t = search.toLowerCase();
        return worldMap.subareas?.filter(s => s.name.fr.toLowerCase().includes(t)).slice(0, 10) || [];
    }, [search, worldMap.subareas]);

    const mapsByCoords = useMemo(() => {
        const index = new Map<string, any>();
        activeMaps.forEach(m => index.set(`${m.x},${m.y}`, m));
        return index;
    }, [activeMaps]);

    const subAreasById = useMemo(() => {
        const index = new Map<number, any>();
        worldMap.subareas?.forEach(s => index.set(s.id, s));
        return index;
    }, [worldMap.subareas]);

    const dungeonsByMapId = useMemo(() => {
        const index = new Map<number, any[]>();
        worldMap.dungeons?.forEach(d => {
            if (!index.has(d.mapId)) index.set(d.mapId, []);
            index.get(d.mapId)!.push(d);
        });
        return index;
    }, [worldMap.dungeons]);

    const mapsById = useMemo(() => {
        const index = new Map<number, any>();
        activeMaps.forEach(m => index.set(m.id, m));
        return index;
    }, [activeMaps]);

    const groupedDungeons = useMemo(() => {
        if (!worldMap || activeMaps.length === 0) return [];
        const results: any[] = [];
        dungeonsByMapId.forEach((dungeons, mapId) => {
            const mapNode = mapsById.get(mapId);
            if (mapNode) results.push({ mapId, dungeons, mapNode });
        });
        return results;
    }, [activeMaps.length, mapsById, dungeonsByMapId]);

    const mapsBySubAreaId = useMemo(() => {
        const index = new Map<number, any[]>();
        activeMaps.forEach(m => {
            if (!index.has(m.subAreaId)) index.set(m.subAreaId, []);
            index.get(m.subAreaId)!.push(m);
        });
        return index;
    }, [activeMaps]);

    const handleJoinRoom = async (room: any) => {
        if (room.participants?.length >= 8) {
            toast.error("Salon complet (8 joueurs max)");
            return;
        }
        const res = await joinGeoguesserSession(room.id);
        if (res.success) {
            setActiveSession(room);
            toast.success("Salon rejoint !");
        } else {
            toast.error(res.error || "Erreur");
        }
    };

    const handleCreateRoom = async () => {
        if (!guildId) return;
        const res = await createGeoguesserSession(guildId);
        if (res.success && res.data) {
            setActiveSession(res.data);
            toast.success("Salon créé !");
        } else {
            toast.error(res.error || "Tu as déjà un salon actif ou erreur.");
        }
    };

    const handleLeaveSession = async () => {
        if (!activeSession) return;
        setActiveSession(null);
        await leaveGeoguesserSession(activeSession.id);
        fetchLobbies();
    };

    const handleStartRoomGame = async () => {
        if (!activeSession || activeSession.hostId !== currentUserId) return;
        const res = await startGeoguesserSession(activeSession.id, [1, 2, 3]); // Example IDs
        if (res.success) toast.success("C'est parti !");
    };

    if (!activeWorld) return <div className="p-20 text-center text-white/20">Initialisation de la carte...</div>;

    return (
        <div className="w-full h-full flex flex-col bg-[#080b12] relative overflow-hidden">
            {/* Tabs Header */}
            <div className="flex-shrink-0 bg-slate-950/80 border-b border-white/5 px-8 pt-4 z-[400] flex items-center justify-between">
                <div className="flex items-center gap-8">
                    <button onClick={() => setActiveTab('map')} className={`pb-4 px-2 text-[11px] font-black uppercase tracking-[0.2em] italic transition-all relative ${activeTab === 'map' ? 'text-emerald-400' : 'text-white/30 hover:text-white/60'}`}>
                        Carte & Exploration
                        {activeTab === 'map' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-emerald-500 rounded-t-full shadow-[0_0_10px_rgba(16,185,129,0.5)]" />}
                    </button>
                    <button onClick={() => setActiveTab('games')} className={`pb-4 px-2 text-[11px] font-black uppercase tracking-[0.2em] italic transition-all relative ${activeTab === 'games' ? 'text-emerald-400' : 'text-white/30 hover:text-white/60'}`}>
                        Mini-Jeux
                        {activeTab === 'games' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-emerald-500 rounded-t-full shadow-[0_0_10px_rgba(16,185,129,0.5)]" />}
                    </button>
                </div>
            </div>

            {/* Map Interaction Toolbar (Visible in Map Tab) */}
            {activeTab === 'map' && (
                <div className="absolute top-20 left-4 right-4 z-[300] flex items-center justify-between pointer-events-none">
                    <div className="flex items-center gap-3 pointer-events-auto">
                        <div className="relative group">
                            <button className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-slate-900 border border-white/10 text-white shadow-xl backdrop-blur-md">
                                <MapIcon size={14} className="text-emerald-500" />
                                <span className="text-xs font-black uppercase italic tracking-tighter">{activeWorld.name.fr}</span>
                                <ChevronDown size={14} className="text-white/20" />
                            </button>
                            <div className="absolute top-full left-0 pt-2 w-60 opacity-0 scale-95 pointer-events-none group-hover:opacity-100 group-hover:scale-100 group-hover:pointer-events-auto transition-all">
                                <div className="bg-slate-900 border border-white/10 rounded-xl shadow-2xl p-2 max-h-[50vh] overflow-y-auto">
                                    {visibleWorlds.map(w => (
                                        <button key={w.id} onClick={() => setSelectedWorldId(w.id)} className={`w-full text-left px-3 py-2 rounded-lg text-xs hover:bg-white/5 ${selectedWorldId === w.id ? 'text-emerald-400' : 'text-white/50'}`}>{w.name.fr}</button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 pointer-events-auto">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" size={14} />
                            <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Zone..." className="w-48 rounded-xl bg-slate-900/80 py-2.5 pl-9 pr-4 text-white text-xs border border-white/10 focus:border-emerald-500/50 outline-none" />
                            {searchResults.length > 0 && (
                                <div className="absolute top-full left-0 right-0 mt-2 bg-slate-900 border border-white/10 rounded-xl shadow-2xl overflow-hidden pointer-events-auto">
                                    {searchResults.map(s => (
                                        <button key={s.id} onClick={() => { setSelectedWorldId(1); setSearch(''); /* Logic to center on zone */ }} className="w-full text-left px-4 py-2 hover:bg-white/5 border-b border-white/5 last:border-0 font-bold">
                                            <span className="text-white text-[10px] block">{s.name.fr}</span>
                                            <span className="text-emerald-500/50 text-[8px] uppercase font-black">Lvl {s.level}</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Leaflet Core */}
            <div className={`flex-1 relative z-[1] transition-opacity ${(activeTab === 'games' && !activeSession) ? 'opacity-0' : 'opacity-100'}`}>
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
                    mapsBySubAreaId={mapsBySubAreaId}
                    guessResult={guessResult}
                />
            </div>

            {/* Games Tab Content */}
            {activeTab === 'games' && !activeSession && (
                <div className="absolute inset-0 bg-[#080b12] z-[500] p-12 overflow-y-auto pt-24">
                    <div className="max-w-6xl mx-auto">
                        <h1 className="text-white font-black text-5xl uppercase italic tracking-tighter mb-12">Jeux de <span className="text-emerald-500">Guilde</span></h1>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                            {/* SigilGuesser Card */}
                            <div className="bg-slate-900 border border-white/10 rounded-[3rem] p-8 flex flex-col">
                                <Target size={48} className="text-emerald-500 mb-8" />
                                <h3 className="text-white font-black text-2xl uppercase italic mb-4">SigilGuesser</h3>
                                <p className="text-white/40 text-xs mb-8">Multiplayer Dofus GeoGuesser. 8 joueurs max.</p>
                                <div className="space-y-4">
                                    <button onClick={handleCreateRoom} className="w-full py-4 rounded-2xl bg-emerald-500 text-white font-black uppercase text-xs italic shadow-lg shadow-emerald-500/20">Créer un Salon</button>
                                    <button className="w-full py-3 rounded-2xl bg-white/5 text-white/40 font-black uppercase text-[10px] tracking-widest cursor-not-allowed">Ladder (Bientôt)</button>
                                </div>
                            </div>
                        </div>

                        {availableSessions.length > 0 && (
                            <div className="mt-16">
                                <h2 className="text-white/20 font-black uppercase text-[10px] tracking-widest mb-8">Salons disponibles</h2>
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                    {availableSessions.map(room => (
                                        <div key={room.id} className="p-6 rounded-3xl bg-slate-900 border border-white/5 flex flex-col gap-4">
                                            <div className="flex items-center justify-between">
                                                <span className="text-white font-bold text-xs">{room.hostName}</span>
                                                <span className="text-[10px] text-white/20 font-black uppercase">{room.participants?.length || 0}/8</span>
                                            </div>
                                            <button onClick={() => handleJoinRoom(room)} className="w-full py-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 font-black uppercase text-[10px] hover:bg-emerald-500 hover:text-white transition-all">Rejoindre</button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Active Session Lobby */}
            {activeSession && activeTab === 'games' && gamePhase === 'idle' && (
                <div className="absolute inset-x-0 bottom-0 top-0 z-[600] bg-black/80 backdrop-blur-xl flex items-center justify-center p-8 pt-24">
                    <div className="max-w-4xl w-full h-[600px] bg-slate-950 border border-white/10 rounded-[3rem] flex overflow-hidden shadow-2xl">
                        <div className="w-80 border-r border-white/5 p-12 bg-black/40 flex flex-col justify-between">
                            <div>
                                <h2 className="text-white font-black text-4xl uppercase italic mb-2">Lobby</h2>
                                <p className="text-white/20 text-[10px] font-black uppercase tracking-widest">En attente de joueurs...</p>
                                <div className="mt-4 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full inline-block">
                                    <span className="text-emerald-500 text-[10px] font-bold uppercase">{activeSession.participants?.length || 0} / 8 Joueurs</span>
                                </div>
                            </div>
                            <button onClick={handleLeaveSession} className="w-full py-4 rounded-2xl bg-red-500/10 text-red-500 font-black uppercase text-xs">Quitter</button>
                        </div>
                        <div className="flex-1 p-12 flex flex-col">
                            <div className="flex-1 overflow-y-auto grid grid-cols-2 gap-4">
                                {activeSession.participants?.map((p: any) => (
                                    <div key={p.id} className="p-4 rounded-2xl bg-white/5 border border-white/5 flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-500 font-black italic">{p.userName?.[0] || 'J'}</div>
                                        <span className="text-white font-bold text-sm">{p.userName}</span>
                                        {p.userId === activeSession.hostId && <span className="text-[9px] bg-emerald-500 text-black px-1.5 py-0.5 rounded-md font-bold uppercase ml-auto">Host</span>}
                                    </div>
                                ))}
                            </div>
                            <div className="mt-8 border-t border-white/5 pt-8 flex justify-end">
                                {activeSession.hostId === currentUserId ? (
                                    <button onClick={handleStartRoomGame} className="px-12 py-4 rounded-2xl bg-emerald-500 text-white font-black uppercase text-sm italic">Lancer la Partie</button>
                                ) : (
                                    <span className="text-white/20 font-black uppercase text-[10px] italic">L'hôte va lancer bientôt...</span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
