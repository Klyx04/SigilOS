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
    advanceSessionRound,
    submitSessionGuess
} from '@/server/actions/geoguesser-multi-actions';
import { motion, AnimatePresence } from 'framer-motion';
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

const GeoguesserHUD = dynamic<any>(() => import('./GeoguesserHUD'), { ssr: false });
const MapDetailsPanel = dynamic<any>(() => import('./MapDetailsPanel'), { ssr: false });

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
    const [showDebugGrid, setShowDebugGrid] = useState(true);
    const [selectedPosition, setSelectedPosition] = useState<any>(null);
    const [selectedDungeon, setSelectedDungeon] = useState<Dungeon[] | null>(null);
    const [triggerCenterPosition, setTriggerCenterPosition] = useState<{ x: number, y: number } | null>(null);

    // Mini-Jeux States
    const [gamePhase, setGamePhase] = useState<'idle' | 'playing' | 'result' | 'summary'>('idle');
    const [activeSession, setActiveSession] = useState<any>(null);
    const [availableSessions, setAvailableSessions] = useState<any[]>([]);
    const [guessResult, setGuessResult] = useState<any>(null);
    const [timeLeft, setTimeLeft] = useState(30);
    const [score, setScore] = useState(0);

    const guildId = typeof window !== 'undefined' ? window.location.pathname.split('/')[2] : '';

    // POLLING: Update Session Status
    useEffect(() => {
        if (!activeSession) return;

        const pollSession = async () => {
            try {
                const status = await getSessionStatus(activeSession.id);
                if (!status) return;

                setActiveSession(status);

                // Transition to PLAYING if session is in progress
                if (status.status === 'IN_PROGRESS' && gamePhase === 'idle') {
                    setGamePhase('playing');
                    setTimeLeft(status.timePerRound || 30);
                }

                // Handle round transition
                if (status.status === 'IN_PROGRESS' && status.currentRound !== activeSession.currentRound) {
                    setGamePhase('playing');
                    setGuessResult(null);
                    setTimeLeft(status.timePerRound || 30);
                }
            } catch (e) { }
        };

        const interval = setInterval(pollSession, 2000);
        return () => clearInterval(interval);
    }, [activeSession, gamePhase]);

    // Timer Logic for Round
    useEffect(() => {
        if (gamePhase !== 'playing' || timeLeft <= 0) return;

        const timer = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 1) {
                    setGamePhase('result');
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [gamePhase, timeLeft]);

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

    const activeMaps = useMemo(() => {
        const dungeonMapIds = new Set(worldMap.dungeons?.map(d => d.mapId || d.entranceMapId) || []);
        return worldMap.maps?.filter(m =>
            m.worldMap === selectedWorldId ||
            (selectedWorldId === 1 && m.worldMap === -1 && dungeonMapIds.has(m.id))
        ) || [];
    }, [worldMap.maps, selectedWorldId, worldMap.dungeons]);

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
            const mapId = d.mapId || d.entranceMapId; // Handle both old and new formats
            if (!mapId) return;
            if (!index.has(mapId)) index.set(mapId, []);
            index.get(mapId)!.push(d);
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
        setGamePhase('idle');
        await leaveGeoguesserSession(activeSession.id);
        fetchLobbies();
    };

    const handleMapClick = async (pos: any) => {
        if (activeTab === 'games' && gamePhase === 'playing' && targetMapId) {
            // GUESS LOGIC
            const targetMap = mapsById.get(targetMapId);
            if (!targetMap) return;

            const dx = pos.x - targetMap.x;
            const dy = pos.y - targetMap.y;
            const dist = Math.round(Math.sqrt(dx * dx + dy * dy));

            // Simple score: 1000 - (dist * 20), min 0
            const roundScore = Math.max(0, 1000 - (dist * 10));
            setScore(prev => prev + roundScore);

            setGuessResult({
                target: { x: targetMap.x, y: targetMap.y },
                guess: { x: pos.x, y: pos.y },
                distance: dist,
                score: roundScore
            });

            setGamePhase('result');

            // Send to server
            if (activeSession) {
                await submitSessionGuess(activeSession.id, activeSession.currentRound || 1, pos.x, pos.y, roundScore, dist);
            }
        } else if (activeTab === 'map') {
            setSelectedPosition(pos);
        }
    };

    const handleStartRoomGame = async () => {
        if (!activeSession || activeSession.hostId !== currentUserId) return;

        // Pick 5 random map IDs for now
        const allMapIds = Array.from(mapsById.keys());
        const shuffled = [...allMapIds].sort(() => 0.5 - Math.random());
        const selectedIds = shuffled.slice(0, 5);

        const res = await startGeoguesserSession(activeSession.id, selectedIds);
        if (res.success) toast.success("C'est parti !");
    };

    const targetMapId = useMemo(() => {
        if (!activeSession || !activeSession.targetMapIds || activeSession.currentRound === undefined) return null;
        return activeSession.targetMapIds[activeSession.currentRound - 1];
    }, [activeSession]);

    const handleAdvanceRound = async () => {
        if (!activeSession) return;
        const nextRound = (activeSession.currentRound || 1) + 1;
        if (nextRound > activeSession.maxRounds) {
            // End of game logic? For now just reset
            setActiveSession(null);
            setGamePhase('idle');
            return;
        }
        await advanceSessionRound(activeSession.id, nextRound);
    };

    if (!activeWorld) return <div className="p-20 text-center text-white/20">Initialisation de la carte...</div>;

    return (
        <div className="w-full h-full flex flex-col bg-[#080b12] relative overflow-hidden">
            {/* Header & Controls Consolidated */}
            <div className="flex-shrink-0 bg-slate-950/90 backdrop-blur-md border-b border-white/5 px-8 flex items-center justify-between h-[64px] z-[600]">
                {/* Left: Navigation Tabs */}
                <div className="flex items-center gap-8 h-full">
                    <button onClick={() => setActiveTab('map')} className={`h-full px-2 text-[11px] font-black uppercase tracking-[0.2em] italic transition-all relative flex items-center ${activeTab === 'map' ? 'text-emerald-400' : 'text-white/30 hover:text-white/60'}`}>
                        Carte & Exploration
                        {activeTab === 'map' && <motion.div layoutId="tab-underline" className="absolute bottom-0 left-0 right-0 h-1 bg-emerald-500 rounded-t-full shadow-[0_0_15px_rgba(16,185,129,0.5)]" />}
                    </button>
                    <button onClick={() => setActiveTab('games')} className={`h-full px-2 text-[11px] font-black uppercase tracking-[0.2em] italic transition-all relative flex items-center ${activeTab === 'games' ? 'text-emerald-400' : 'text-white/30 hover:text-white/60'}`}>
                        Mini-Jeux
                        {activeTab === 'games' && <motion.div layoutId="tab-underline" className="absolute bottom-0 left-0 right-0 h-1 bg-emerald-500 rounded-t-full shadow-[0_0_15px_rgba(16,185,129,0.5)]" />}
                    </button>
                </div>

                {/* Right: Map Contextual Tools (Visible ONLY on Map Tab) */}
                <AnimatePresence mode="wait">
                    {activeTab === 'map' && (
                        <motion.div
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }}
                            className="flex items-center gap-4"
                        >
                            {/* World Selection */}
                            <div className="relative group">
                                <button className="flex items-center gap-3 px-4 py-2 rounded-xl bg-white/5 border border-white/5 text-white hover:bg-white/10 transition-colors">
                                    <MapIcon size={12} className="text-emerald-500" />
                                    <span className="text-[10px] font-black uppercase italic tracking-tighter">{activeWorld.name.fr}</span>
                                    <ChevronDown size={12} className="text-white/20" />
                                </button>
                                <div className="absolute top-full right-0 pt-2 w-60 opacity-0 scale-95 pointer-events-none group-hover:opacity-100 group-hover:scale-100 group-hover:pointer-events-auto transition-all z-[700]">
                                    <div className="bg-slate-900 border border-white/10 rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] p-2 max-h-[50vh] overflow-y-auto">
                                        {visibleWorlds.map(w => (
                                            <button key={w.id} onClick={() => setSelectedWorldId(w.id)} className={`w-full text-left px-3 py-2 rounded-lg text-xs hover:bg-white/5 ${selectedWorldId === w.id ? 'text-emerald-400' : 'text-white/50'}`}>{w.name.fr}</button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Grid Toggle */}
                            <button
                                onClick={() => setShowDebugGrid(!showDebugGrid)}
                                className={`p-2 rounded-xl border transition-all ${showDebugGrid ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-white/5 border-white/5 text-white/40 hover:text-white/60'}`}
                                title={showDebugGrid ? "Masquer la grille" : "Afficher la grille"}
                            >
                                {showDebugGrid ? <Eye size={14} /> : <EyeOff size={14} />}
                            </button>

                            {/* Zone Search */}
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20" size={12} />
                                <input
                                    type="text"
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                    placeholder="Chercher une zone..."
                                    className="w-48 rounded-xl bg-white/5 py-2 pl-9 pr-4 text-white text-[10px] uppercase font-bold border border-white/5 focus:border-emerald-500/50 outline-none transition-all focus:bg-white/10 placeholder:text-white/10"
                                />
                                {searchResults.length > 0 && (
                                    <div className="absolute top-full right-0 mt-2 w-64 bg-slate-900 border border-white/10 rounded-xl shadow-2xl overflow-hidden z-[700]">
                                        {searchResults.map(s => (
                                            <button key={s.id} onClick={() => { setSelectedWorldId(1); setSearch(''); }} className="w-full text-left px-4 py-3 hover:bg-white/5 border-b border-white/5 last:border-0 transition-colors">
                                                <div className="flex justify-between items-center">
                                                    <span className="text-white text-[10px] font-black uppercase italic">{s.name.fr}</span>
                                                    <span className="text-emerald-500/50 text-[8px] uppercase font-black px-1.5 py-0.5 rounded-md bg-emerald-500/5">Lvl {s.level}</span>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Main Interactive Area */}
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
                    setSelectedPosition={handleMapClick}
                    setSelectedDungeon={setSelectedDungeon}
                    triggerCenterPosition={triggerCenterPosition}
                    mapsBySubAreaId={mapsBySubAreaId}
                    guessResult={guessResult}
                />

                {/* Game Overlay HUD */}
                {activeTab === 'games' && gamePhase !== 'idle' && activeSession && (
                    <div className="absolute top-24 left-1/2 -translate-x-1/2 z-[700] pointer-events-none">
                        <GeoguesserHUD
                            round={activeSession.currentRound || 1}
                            maxRounds={activeSession.maxRounds || 5}
                            timeLeft={timeLeft}
                            score={score}
                            gamePhase={gamePhase}
                        />
                    </div>
                )}

                {/* Target Map Preview (SigilGuesser) */}
                {activeTab === 'games' && gamePhase === 'playing' && targetMapId && (
                    <div className="absolute bottom-8 left-8 z-[700] w-[300px] h-[200px] bg-slate-950 border border-white/10 rounded-3xl overflow-hidden shadow-2xl pointer-events-auto transition-all animate-in slide-in-from-left-8 duration-500">
                        <div className="absolute inset-x-0 top-0 p-3 bg-black/60 backdrop-blur-md flex items-center justify-between z-10">
                            <span className="text-white text-[9px] font-black uppercase italic tracking-widest flex items-center gap-2">
                                <Compass size={10} className="text-emerald-500" /> Cible à trouver
                            </span>
                        </div>
                        <img
                            src={`/game-data/hd_maps/${targetMapId}.webp`}
                            className="w-full h-full object-cover"
                            alt="Target Preview"
                        />
                    </div>
                )}

                {/* Result Screen Overlay (GeoGuesser) */}
                {gamePhase === 'result' && guessResult && (
                    <div className="absolute inset-0 z-[800] bg-black/40 backdrop-blur-sm pointer-events-none flex items-center justify-center">
                        <div className="w-[400px] bg-slate-900 border border-white/10 rounded-[2.5rem] p-10 shadow-2xl pointer-events-auto flex flex-col items-center gap-6 animate-in zoom-in-95 duration-300">
                            <div className="w-20 h-20 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-500">
                                <Trophy size={40} />
                            </div>
                            <div className="text-center">
                                <h3 className="text-white font-black text-3xl uppercase italic leading-none">C'est validé !</h3>
                                <p className="text-white/30 text-[10px] uppercase font-black tracking-widest mt-2">{guessResult.distance} maps de distance</p>
                            </div>
                            <div className="w-full h-px bg-white/5" />
                            <div className="text-center">
                                <span className="text-emerald-500 font-black text-5xl italic tracking-tighter">+{guessResult.score}</span>
                                <span className="text-emerald-500/20 text-xs font-black uppercase ml-2 italic">points</span>
                            </div>
                            {activeSession?.hostId === currentUserId && (
                                <button
                                    onClick={handleAdvanceRound}
                                    className="w-full py-4 rounded-2xl bg-emerald-500 text-white font-black uppercase text-xs italic shadow-lg shadow-emerald-500/20 hover:scale-[1.02] transition-transform"
                                >
                                    Round Suivant
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Map Details Panel (HD View on Click) - Relative to main container for exact alignment */}
            {selectedPosition && activeTab === 'map' && (
                <MapDetailsPanel
                    position={selectedPosition}
                    subAreaName={subAreasById.get(mapsByCoords.get(`${selectedPosition.x},${selectedPosition.y}`)?.subAreaId)?.name?.fr}
                    onClose={() => setSelectedPosition(null)}
                />
            )}

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
