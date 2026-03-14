'use client';

import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import dynamic from 'next/dynamic';
import {
    Search, Map as MapIcon, Loader2, Target, Eye, EyeOff, Trophy,
    Clock, ZoomIn, Compass, ChevronDown, ChevronRight, Plus, Minus, Users, Trash2, X, CheckCircle2, Copy,
    Crown, Play, Palette, Smartphone, HelpCircle, LogOut, RotateCcw
} from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { WorldData, MapNode, SubArea, Dungeon } from '@/types/worldmap';
import { submitGeoguesserScore, getGeoguesserLadder } from '@/server/actions/geoguesser-actions';
import { getSkribblLadder } from '@/server/actions/skribbl-actions';
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
import { io, Socket } from "socket.io-client";
import { buildWsUrl } from "@/lib/socket-utils";
import { cn } from "@/lib/utils";
import { playSoundEffect } from "@/lib/sounds";

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
const DungeonDetailModal = dynamic<any>(() => import('./DungeonDetailModal').then(mod => mod.DungeonDetailModal), { ssr: false });
const ZoneDetailModal = dynamic<any>(() => import('./ZoneDetailModal').then(mod => mod.ZoneDetailModal), { ssr: false });

interface InteractiveMapProps {
    worldMap: WorldData;
    initialLadder?: any[];
    initialKingLadder?: any[];
    initialTab?: 'map' | 'games';
    gameStatuses?: any[];
}

export default function InteractiveMapV2({ worldMap, initialLadder, initialKingLadder, initialTab, gameStatuses }: InteractiveMapProps) {
    const { data: sessionData } = useSession();
    const currentUserId = sessionData?.user?.id;
    const [selectedWorldId, setSelectedWorldId] = useState(1);
    const [activeTab, setActiveTab] = useState<'map' | 'games'>(initialTab || 'map');
    const searchParams = useSearchParams();
    const spectateRoomId = searchParams.get('spectateRoom');
    const autoJoinAttempted = useRef(false);

    // UI States
    const [search, setSearch] = useState('');
    const [showDebugGrid, setShowDebugGrid] = useState(true);
    const [selectedPosition, setSelectedPosition] = useState<any>(null);
    const [selectedDungeon, setSelectedDungeon] = useState<Dungeon[] | null>(null);
    const [triggerCenterPosition, setTriggerCenterPosition] = useState<{ x: number, y: number } | null>(null);
    const [isMinimapExpanded, setIsMinimapExpanded] = useState(false);
    const [isMinimapHidden, setIsMinimapHidden] = useState(false);
    const [minimapRecenterTrigger, setMinimapRecenterTrigger] = useState(0);
    const [showZoneDetail, setShowZoneDetail] = useState(false);

    // Mini-Jeux States
    const [gamePhase, setGamePhase] = useState<'idle' | 'countdown' | 'playing' | 'result' | 'summary'>('idle');
    const [activeSession, setActiveSession] = useState<any>(null);
    const [availableSessions, setAvailableSessions] = useState<any[]>([]);
    const [skribblRooms, setSkribblRooms] = useState<any[]>([]);
    const [garticRooms, setGarticRooms] = useState<any[]>([]);
    const [sigilKingRooms, setSigilKingRooms] = useState<any[]>([]);
    const [guessResult, setGuessResult] = useState<any>(null);
    const [timeLeft, setTimeLeft] = useState(30);
    const [score, setScore] = useState(0);
    const [zoomPhase, setZoomPhase] = useState(0);
    const [isSoloMode, setIsSoloMode] = useState(false);
    const [showRules, setShowRules] = useState(false);
    const [isLeavingSession, setIsLeavingSession] = useState(false);
    const [showPerfectCelebration, setShowPerfectCelebration] = useState(false);

    // Leaderboard States
    const [ladder, setLadder] = useState<any[]>(initialLadder || []);
    const [kingLadder, setKingLadder] = useState<any[]>(initialKingLadder || []);
    const [ladderType, setLadderType] = useState<'all_time' | 'month'>('all_time');
    const [ladderGame, setLadderGame] = useState<'guesser' | 'skribbl' | 'king'>('guesser');
    const [isLoadingLadder, setIsLoadingLadder] = useState(false);

    const guildId = typeof window !== 'undefined' ? window.location.pathname.split('/')[2] : '';

    const [socket, setSocket] = useState<Socket | null>(null);

    // --- HOOKS DE CALCUL (useMemo) ---
    // On les place au début pour éviter les erreurs "Used before assigned" dans les useEffect
    const activeWorld = useMemo(() =>
        worldMap.worlds?.find(w => w.id === selectedWorldId) || worldMap.worlds?.[0],
        [worldMap, selectedWorldId]);

    const getGameStatus = (gameId: string) => {
        const status = gameStatuses?.find(s => s.gameId === gameId);
        return {
            isEnabled: status?.isEnabled ?? true,
            message: status?.maintenanceMsg || "🔧 Ce jeu est temporairement indisponible pour maintenance."
        };
    };

    const activeMaps = useMemo(() => {
        if (!worldMap.maps) return [];
        const dungeonMapIds = new Set(worldMap.dungeons?.map(d => d.mapId || d.entranceMapId) || []);
        return worldMap.maps?.filter(m => {
            const isTargetWorld = m.worldMap === selectedWorldId;
            const isDungeon = dungeonMapIds.has(m.id);
            const isEntryToDungeonFromMain = (selectedWorldId === 1 && m.worldMap === -1 && isDungeon);

            // On affiche si c'est le monde sélectionné ou un donjon lié
            if (isTargetWorld || isEntryToDungeonFromMain) {
                // Pour le monde principal (ID 1), on masque les intérieurs de maisons (outdoor: false)
                // MAIS on garde les sombres profondeurs et les donjons enterrés
                if (selectedWorldId === 1 && m.outdoor === false && !isDungeon) {
                    return false;
                }
                return true;
            }
            return false;
        }) || [];
    }, [worldMap.maps, selectedWorldId, worldMap.dungeons]);

    const visibleWorlds = useMemo(() =>
        worldMap.worlds?.filter(w => worldMap.maps?.some(m => m.worldMap === w.id)) || [],
        [worldMap]);

    const searchResults = useMemo(() => {
        if (!search) return [];
        const t = search.toLowerCase();

        // Handle coordinate search (e.g. "0,0" or "0 -5")
        const coordMatch = search.match(/^(-?\d+)[, ]+(-?\d+)$/);
        if (coordMatch) {
            const x = parseInt(coordMatch[1]);
            const y = parseInt(coordMatch[2]);
            // Search in ALL maps, not just current world
            const map = worldMap.maps?.find(m => m.x === x && m.y === y);
            if (map) {
                return [{
                    id: -999,
                    name: `Position [${x}, ${y}]`,
                    x, y,
                    worldMap: map.worldMap,
                    level: 0,
                    isCoord: true
                } as any];
            }
        }

        const isNumeric = /^\d+$/.test(t);
        const searchId = isNumeric ? parseInt(t) : -1;

        // Function for accent normalization
        const normalize = (str: string) =>
            str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

        const normalizedSearch = normalize(t);

        return worldMap.subareas?.filter(s => {
            if (s.id === searchId) return true;
            const name = typeof s.name === 'string' ? s.name : s.name?.fr;
            if (!name) return false;
            return normalize(name).includes(normalizedSearch);
        }).slice(0, 10) || [];
    }, [search, worldMap.subareas, worldMap.maps, selectedWorldId]);

    const handleSearchResultClick = useCallback((item: any) => {
        if (!item) return;

        if (item.isCoord) {
            if (item.worldMap !== undefined && item.worldMap !== selectedWorldId) {
                setSelectedWorldId(item.worldMap);
            }
            setTriggerCenterPosition({ x: item.x, y: item.y });
            setSearch('');
            return;
        }

        // Search the maps to find one belonging to this subarea
        const map = worldMap.maps?.find(m => m.subAreaId === item.id);
        if (map) {
            setSelectedWorldId(map.worldMap);
            setTriggerCenterPosition({ x: map.x, y: map.y });
        } else if (item.mapIds?.length > 0) {
            const m = worldMap.maps?.find(m => m.id === item.mapIds[0]);
            if (m) {
                setSelectedWorldId(m.worldMap);
                setTriggerCenterPosition({ x: m.x, y: m.y });
            }
        }
        setSearch('');
    }, [worldMap.maps]);

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
            const mapId = d.mapId || d.entranceMapId;
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

    const allMapsById = useMemo(() => {
        const index = new Map<number, any>();
        worldMap.maps?.forEach(m => index.set(m.id, m));
        return index;
    }, [worldMap.maps]);

    const groupedDungeons = useMemo(() => {
        if (!worldMap || activeMaps.length === 0) return [];
        const results: any[] = [];
        dungeonsByMapId.forEach((dungeons, mapId) => {
            const mapNode = mapsById.get(mapId);
            if (mapNode) results.push({ mapId, dungeons, mapNode });
        });
        return results;
    }, [activeMaps.length, mapsById, dungeonsByMapId]);

    const allWorldMapsByCoords = useMemo(() => {
        const index = new Map<string, any>();
        worldMap.maps?.forEach(m => {
            if (m.worldMap === selectedWorldId) {
                // If multiple maps exist at the same coord (outdoor/indoor), 
                // we prefer the outdoor one or the first one found.
                if (!index.has(`${m.x},${m.y}`) || m.outdoor) {
                    index.set(`${m.x},${m.y}`, m);
                }
            }
        });
        return index;
    }, [worldMap.maps, selectedWorldId]);

    const mapsBySubAreaId = useMemo(() => {
        const index = new Map<number, any[]>();
        activeMaps.forEach(m => {
            if (!index.has(m.subAreaId)) index.set(m.subAreaId, []);
            index.get(m.subAreaId)!.push(m);
        });
        return index;
    }, [activeMaps]);

    const isCurrentUserSpectator = useMemo(() => {
        if (!activeSession) return false;
        const me = activeSession.participants?.find((p: any) => String(p.userId) === String(currentUserId));
        return me?.isSpectator || false;
    }, [activeSession?.participants, currentUserId]);

    // On fait 100% confiance au serveur qui émet `geoguesser:state:sync` chaque seconde.
    // L'UI se mettra à jour automatiquement via setTimeLeft(state.timeLeft) dans le socket.on

    const fetchLobbies = useCallback(async () => {
        if (!guildId) return;
        try {
            const sessions = await getActiveGeoguesserSessions(guildId);
            setAvailableSessions(sessions || []);
        } catch (e) {
            console.error("Error fetching lobbies:", e);
        }
    }, [guildId]);

    const fetchLadder = useCallback(async () => {
        if (!guildId) return;
        setIsLoadingLadder(true);
        try {
            const data = ladderGame === 'guesser'
                ? await getGeoguesserLadder(guildId, ladderType)
                : await getSkribblLadder(guildId, ladderType);
            setLadder(data);
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoadingLadder(false);
        }
    }, [guildId, ladderType, ladderGame]);

    useEffect(() => {
        fetchLadder();
    }, [fetchLadder]);

    // Check hash for direct tab access
    useEffect(() => {
        if (typeof window !== 'undefined' && window.location.hash === '#mini-jeux') {
            setActiveTab('games');
        }
    }, []);

    // Zoom mechanism based on difficulty removed as per user request (only Easy mode remains)
    useEffect(() => {
        setZoomPhase(0);
    }, [gamePhase]);

    useEffect(() => {
        if (gamePhase === 'playing' && timeLeft > 0 && timeLeft <= 10) {
            playSoundEffect('tick');
        }
    }, [timeLeft, gamePhase]);

    // Auto-join spectator room from query param
    useEffect(() => {
        if (spectateRoomId && activeTab === 'games' && availableSessions.length > 0 && !activeSession && !autoJoinAttempted.current) {
            const room = availableSessions.find(r => r.id === spectateRoomId);
            if (room) {
                autoJoinAttempted.current = true;
                handleJoinRoom(room, true);
            }
        }
    }, [spectateRoomId, availableSessions, activeSession, activeTab]);

    // Refs for socket handlers to avoid stale closures without triggering reconnections
    const mapsByIdRef = useRef<Map<number, any>>(new Map());
    const allMapsByIdRef = useRef<Map<number, any>>(new Map());
    const currentUserIdRef = useRef<string | undefined>(currentUserId);

    useEffect(() => {
        mapsByIdRef.current = mapsById;
    }, [mapsById]);

    useEffect(() => {
        allMapsByIdRef.current = allMapsById;
    }, [allMapsById]);

    useEffect(() => {
        currentUserIdRef.current = currentUserId;
    }, [currentUserId]);

    const activeSessionRef = useRef<any>(activeSession);
    useEffect(() => { activeSessionRef.current = activeSession; }, [activeSession]);

    // Stable refs pour eviter les reconnexions socket intempestives
    const sessionDataRef = useRef(sessionData);
    useEffect(() => { sessionDataRef.current = sessionData; }, [sessionData]);

    const fetchLobbiesRef = useRef(fetchLobbies);
    useEffect(() => { fetchLobbiesRef.current = fetchLobbies; }, [fetchLobbies]);

    useEffect(() => {
        if (activeTab !== 'games' || !guildId) {
            if (socket) {
                socket.disconnect();
                setSocket(null);
            }
            return;
        }

        const wsUrl = buildWsUrl();

        const newSocket = io(wsUrl, {
            path: "/socket.io/",
            transports: ["websocket", "polling"],
            reconnectionAttempts: 10,
            query: { guildId }
        });

        newSocket.on("connect", () => {
            const currentSession = activeSessionRef.current;
            if (currentSession) {
                newSocket.emit("geoguesser:room:join", {
                    roomId: currentSession.id,
                    guildId,
                    userId: currentUserId,
                    pseudo: sessionData?.user?.name || "Joueur",
                    avatarUrl: sessionData?.user?.image,
                    maxRounds: currentSession.maxRounds,
                    timePerRound: currentSession.timePerRound
                });
            }
            newSocket.emit("skribbl:room:list");
            newSocket.emit("gartic:room:list");
            newSocket.emit("geoguesser:room:list");
            newSocket.emit("sigilking:room:list");
        });

        newSocket.on("geoguesser:room:list", (rooms) => setAvailableSessions(rooms || []));
        newSocket.on("skribbl:room:list", (rooms) => setSkribblRooms(rooms || []));
        newSocket.on("gartic:room:list", (rooms) => setGarticRooms(rooms || []));
        newSocket.on("sigilking:room:list", (rooms) => setSigilKingRooms(rooms || []));

        newSocket.on("geoguesser:player:joined", (data: any) => {
            if (data.userId !== currentUserIdRef.current) {
                if (data.isSpectator) {
                    toast.info(`${data.userName} regarde la partie`, {
                        icon: "👀",
                        style: {
                            background: 'rgba(59, 130, 246, 0.1)',
                            border: '1px solid rgba(59, 130, 246, 0.2)',
                            color: '#3b82f6',
                            borderRadius: '1rem',
                            backdropFilter: 'blur(10px)'
                        }
                    });
                } else {
                    toast.success(`${data.userName} a rejoint le salon !`, {
                        icon: "👋",
                        style: {
                            background: 'rgba(16, 185, 129, 0.1)',
                            border: '1px solid rgba(16, 185, 129, 0.2)',
                            color: '#10b981',
                            borderRadius: '1rem',
                            backdropFilter: 'blur(10px)'
                        }
                    });
                }
                fetchLobbiesRef.current();
            }
        });

        newSocket.on("geoguesser:state:sync", (state) => {
            if (!state || isLeavingSession) return;

            // Host migration notification
            if (activeSessionRef.current && state.hostId !== activeSessionRef.current.hostId) {
                const currentUserId = currentUserIdRef.current;
                if (state.hostId === currentUserId) {
                    toast.success("Vous êtes maintenant l'hôte du salon !", {
                        icon: <Crown className="text-yellow-400" />,
                        description: "Vous pouvez maintenant lancer la partie."
                    });
                    playSoundEffect("success");
                } else {
                    const newHost = state.participants?.find((p: any) => p.userId === state.hostId);
                    if (newHost) {
                        toast.info(`${newHost.userName} est le nouvel hôte.`, { icon: "👑" });
                    }
                }
            }

            setActiveSession(state);
            const serverTime = state.timeLeft ?? 0;
            setTimeLeft(prev => {
                // If it's a short countdown (like 3-2-1), don't smooth it
                if (serverTime <= 5) return serverTime;
                // Otherwise, only sync if drift is > 2 seconds to avoid jitter
                return Math.abs(prev - serverTime) > 2 ? serverTime : prev;
            });

            const newState = state.state;
            const prevPhase = gamePhase;

            // 1. Determine new phase and handle side effects
            if (newState === 'IN_PROGRESS') {
                const isNewRound = state.currentRound !== activeSessionRef.current?.currentRound;
                const me = state.participants?.find((p: any) => p.userId === currentUserIdRef.current);
                const hasGuessedOnServer = me?.hasGuessed;

                // We only revert to 'playing' if it's a new round 
                // OR if we haven't guessed yet (and aren't already in playing state)
                if (isNewRound || (prevPhase !== 'playing' && prevPhase !== 'result' && !hasGuessedOnServer)) {
                    setGuessResult(null);
                    setActiveTab('games');
                    const targetId = state.currentMapId || (state.targetMapIds && state.targetMapIds[state.currentRound - 1]);
                    if (targetId) {
                        const tMap = allMapsByIdRef.current.get(targetId);
                        if (tMap && tMap.worldMap !== selectedWorldId) {
                            setSelectedWorldId(tMap.worldMap);
                        }
                    }
                    setGamePhase('playing');
                }
            } else if (newState === 'RESULT' && prevPhase !== 'result') {
                const targetId = state.currentMapId || (state.targetMapIds && state.targetMapIds[state.currentRound - 1]);
                if (targetId) {
                    const tMap = allMapsByIdRef.current.get(targetId);
                    if (tMap && tMap.worldMap !== selectedWorldId) {
                        setSelectedWorldId(tMap.worldMap);
                    }
                }
                setGamePhase('result');
            } else if (newState === 'FINISHED' && prevPhase !== 'summary') {
                playSoundEffect('ranking');
                setGamePhase('summary');
            } else if (newState === 'COUNTDOWN' && prevPhase !== 'countdown') {
                setActiveTab('games');
                setGamePhase('countdown');
            } else if (newState === 'LOBBY' && prevPhase !== 'idle') {
                setActiveTab('games');
                setScore(0);
                setGuessResult(null);
                setSelectedPosition(null);
                setGamePhase('idle');
            }

            // 2. Sync results ALWAYS if in RESULT or FINISHED, 
            // OR if we already have a guess synced on server but we are locally in 'playing' (recovery)
            const me = state.participants?.find((p: any) => p.userId === currentUserIdRef.current);
            if ((state.state === 'RESULT' || state.state === 'FINISHED' || (me?.hasGuessed && gamePhase === 'playing')) && (state.currentMapId || state.targetMapIds) && state.currentRound > 0) {
                const targetId = state.currentMapId || (state.targetMapIds && state.targetMapIds[state.currentRound - 1]);
                const tMap = allMapsByIdRef.current.get(targetId);
                if (tMap) {
                    const newResult = {
                        target: { x: tMap.x, y: tMap.y, worldMap: tMap.worldMap, mapId: targetId },
                        guess: (me?.lastGuess && !me.lastGuess.hidden) ? { ...me.lastGuess, x: me.lastGuess.x, y: me.lastGuess.y, worldMap: me.lastGuess.worldId } : null,
                        distance: me?.lastGuess?.distance || 0,
                        score: me?.lastGuess?.score || 0
                    };
                    setGuessResult(newResult);

                    // --- CELEBRATION TRIGGER ---
                    if (newResult.distance === 0 && !me.isSpectator && (newState === 'RESULT' || newState === 'FINISHED' || me.hasGuessed)) {
                        // Check if we already celebrated this round
                        const celebratedRounds = (window as any)._geoSigilCelebratedRounds || new Set();
                        const roundKey = `${activeSession?.id}-${state.currentRound}`;
                        if (!celebratedRounds.has(roundKey)) {
                            setShowPerfectCelebration(true);
                            celebratedRounds.add(roundKey);
                            (window as any)._geoSigilCelebratedRounds = celebratedRounds;
                            playSoundEffect('success');
                            setTimeout(() => setShowPerfectCelebration(false), 5000);
                        }
                    }

                    // If server says we guessed, enforce result phase
                    if (me?.hasGuessed && (newState === 'IN_PROGRESS' || newState === 'RESULT')) {
                        setGamePhase('result');
                    }
                }
            }
        });

        newSocket.on("geoguesser:player:joined", (data) => {
            if (data.userId !== currentUserIdRef.current && activeTab === 'games') {
                const msg = data.isSpectator ? `${data.userName} regarde votre partie.` : `${data.userName} a rejoint le salon.`;
                toast.info(msg, { icon: data.isSpectator ? '👁️' : '🎮' });
                if (data.isSpectator) playSoundEffect('ding'); // Subtle ping
            }
        });

        newSocket.on("geoguesser:player:left", (data) => {
            if (data.userId !== currentUserIdRef.current && activeTab === 'games') {
                toast.info(`${data.userName} a quitté le salon.`, { icon: '🚪' });
            }
        });

        setSocket(newSocket);

        const fbInterval = setInterval(() => {
            fetchLobbiesRef.current();
            if (newSocket.connected) {
                newSocket.emit("skribbl:room:list");
                newSocket.emit("gartic:room:list");
                newSocket.emit("geoguesser:room:list");
                newSocket.emit("sigilking:room:list");
            }
        }, 5000);

        return () => {
            newSocket.disconnect();
            clearInterval(fbInterval);
        };
    }, [activeTab, guildId]);

    // Game Sounds & Phase Effects
    useEffect(() => {
        if (gamePhase === 'playing') {
            playSoundEffect('ding');
        } else if (gamePhase === 'result') {
            // Sons de résultat désactivés à la demande de l'utilisateur
        } else if (gamePhase === 'countdown') {
            playSoundEffect('count');
        }
    }, [gamePhase, currentUserId]);

    // Local Timer Fallback - Prevents "stuck" timer if server sync is slow
    useEffect(() => {
        let timer: any;
        if (gamePhase === 'playing' || (gamePhase === 'result' && timeLeft > 0)) {
            timer = setInterval(() => {
                setTimeLeft(prev => (prev > 0 ? prev - 1 : 0));
            }, 1000);
        }
        return () => { if (timer) clearInterval(timer); };
    }, [gamePhase]);



    const handleJoinRoom = async (room: any, isSpectator: boolean = false) => {
        setIsSoloMode(false);
        if (!isSpectator && room.participants?.length >= 8) {
            toast.error("Salon complet (8 joueurs max)");
            return;
        }
        const res = await joinGeoguesserSession(room.id, isSpectator);
        if (res.success) {
            setActiveSession({ ...room, isSpectator });
            toast.success(isSpectator ? "Mode Spectateur activé !" : "Salon rejoint !");
            socket?.emit("geoguesser:room:join", {
                roomId: room.id,
                guildId,
                userId: currentUserId,
                pseudo: sessionData?.user?.name || "Joueur",
                avatarUrl: sessionData?.user?.image,
                maxRounds: room.maxRounds,
                timePerRound: room.timePerRound,
                isSpectator: isSpectator
            });
        } else {
            toast.error(res.error || "Erreur");
        }
    };

    const handleNextRound = () => {
        if (!socket) return;
        playSoundEffect('tick');
        socket.emit("geoguesser:game:next-round");
    };

    const handleCreateRoom = async () => {
        if (!guildId) return;
        setIsSoloMode(false);
        const res = await createGeoguesserSession(guildId);
        if (res.success && res.data) {
            setActiveSession(res.data);
            setGamePhase('idle');
            toast.success("Salon créé !");
            socket?.emit("geoguesser:room:join", {
                roomId: res.data.id,
                guildId,
                userId: currentUserId,
                pseudo: sessionData?.user?.name || "Hôte",
                avatarUrl: sessionData?.user?.image,
                maxRounds: res.data.maxRounds,
                timePerRound: res.data.timePerRound
            });
        } else {
            toast.error(res.error || "Erreur lors de la création.");
        }
    };

    const handleSoloMode = async () => {
        if (!guildId) return;
        setIsSoloMode(true);
        const res = await createGeoguesserSession(guildId);
        if (res.success && res.data) {
            setActiveSession(res.data);
            setGamePhase('idle');
            toast.success("Mode Solo activé !");
            socket?.emit("geoguesser:room:join", {
                roomId: res.data.id,
                guildId,
                userId: currentUserId,
                pseudo: sessionData?.user?.name || "Solo Explorer",
                avatarUrl: sessionData?.user?.image,
                maxRounds: 5,
                timePerRound: 30
            });
        } else {
            toast.error(res.error || "Erreur lors du passage en solo.");
        }
    };

    const handleReplay = async () => {
        const wasSolo = isSoloMode;
        if (activeSession) {
            const roomId = activeSession.id;
            socket?.emit("geoguesser:room:leave");
            await leaveGeoguesserSession(roomId);
        }
        
        if (wasSolo) {
            handleSoloMode();
        } else {
            handleCreateRoom();
        }
    };

    const handleLeaveSession = async () => {
        if (!activeSession) return;
        const roomId = activeSession.id;

        setIsLeavingSession(true);
        socket?.emit("geoguesser:room:leave");

        setActiveSession(null);
        setIsSoloMode(false);
        setGamePhase('idle');
        await leaveGeoguesserSession(roomId);
        fetchLobbies();

        // Reset the leave flag after a delay to allow future joins
        setTimeout(() => setIsLeavingSession(false), 2000);
    };

    const handleMapClick = async (pos: any) => {
        const me = activeSession?.participants?.find((p: any) => p.userId === currentUserId);
        const isSpectator = activeSession?.isSpectator || me?.isSpectator;
        if (isSpectator && activeTab === 'games') return;

        if (activeTab === 'games' && gamePhase === 'playing' && targetMapId) {
            setSelectedPosition(pos);
        } else if (activeTab === 'map') {
            setSelectedPosition(pos);
        }
    };

    const submitPendingGuess = () => {
        const me = activeSession?.participants?.find((p: any) => p.userId === currentUserId);
        const isSpectator = activeSession?.isSpectator || me?.isSpectator;
        if (!selectedPosition || !targetMapId || isSpectator) return;
        const targetMap = allMapsById.get(targetMapId);
        if (!targetMap) return;

        let dist = 1000;
        // La distance n'est calculée que si le joueur est sur le bon monde
        if (targetMap.worldMap === selectedWorldId) {
            const dx = selectedPosition.x - targetMap.x;
            const dy = selectedPosition.y - targetMap.y;
            dist = Math.round(Math.sqrt(dx * dx + dy * dy));
        }

        // Quadratic decline (standard GeoGuess feel): 1000 * (1 - dist/100)^2
        const maxDistPossible = 100;
        let roundScore = 0;
        if (dist < maxDistPossible) {
            roundScore = Math.round(1000 * Math.pow(1 - dist / maxDistPossible, 2));
        }

        // Difficulty Bonus for exact guesses
        if (dist === 0) {
            const diff = activeSession?.difficulty || 'easy';
            if (diff === 'hard') roundScore += 500;
            else if (diff === 'medium') roundScore += 250;
        }

        setScore(prev => prev + roundScore);

        setGuessResult({
            target: { x: targetMap.x, y: targetMap.y, mapId: targetMapId },
            guess: { x: selectedPosition.x, y: selectedPosition.y, mapId: selectedPosition.mapId },
            distance: dist,
            score: roundScore
        });

        setGamePhase('result');
        setSelectedPosition(null);
        setIsMinimapExpanded(false);

        if (socket) {
            socket.emit('geoguesser:guess:submit', {
                x: selectedPosition.x,
                y: selectedPosition.y,
                worldId: selectedWorldId,
                score: roundScore,
                distance: dist,
                round: activeSession?.currentRound || 1,
                mapId: selectedPosition.mapId
            });
            // playSoundEffect('tick'); // Removed as per user request
        }
    };

    const handleStartRoomGame = async () => {
        console.log("[Geoguesser] Lancement demandé", {
            activeSession,
            currentUserId,
            isSoloMode,
            socketId: socket?.id
        });

        if (!activeSession || !currentUserId) {
            toast.error("Session ou utilisateur manquant");
            return;
        }

        // En mode solo, on est forcément l'hôte. En multi, on vérifie.
        const isHost = activeSession.hostId === currentUserId || isSoloMode;
        if (!isHost) {
            toast.error("Seul l'hôte peut lancer la partie");
            return;
        }

        // Blocage si pas assez de joueurs en multi
        if (!isSoloMode && (activeSession.participants?.length || 0) < 2) {
            toast.error("Un second joueur est requis pour lancer en multi !");
            return;
        }

        // Keywords that indicate a subarea is likely an interior or tactical map
        const excludedKeywords = [
            "donjon", "tunnel", "souterrain", "cave", "crypt", "labyrinthe", 
            "bâtiment", "intérieur", "tactique", "défis", "arène", "mine", 
            "égout", "cellule", "prison", "temple", "salle", "château",
            "laboratoire", "secret", "caché"
        ];

        // On pioche dans les maps selon le mode
        const mode = activeSession.gameMode || 'NORMAL';
        const allPlayableMaps = worldMap.maps?.filter(m => {
            const isOutdoor = m.outdoor === true;
            const isValidWorld = m.worldMap !== -1;
            if (!isOutdoor || !isValidWorld) return false;

            // Strict checking for subarea names to avoid "unfindable" maps
            const subArea = subAreasById.get(m.subAreaId);
            if (subArea) {
                const subAreaName = (typeof subArea.name === 'string' ? subArea.name : subArea.name?.fr || "").toLowerCase();
                if (excludedKeywords.some(key => subAreaName.includes(key))) {
                    return false;
                }
            }

            if (mode === 'NORMAL') {
                return m.worldMap === 1;
            } else {
                // Mode SPECIAL : On exclut le monde 1, mais aussi les Mappemondes (19) et Ecaflip City (29)
                return m.worldMap !== 1 && m.worldMap !== 19 && m.worldMap !== 29;
            }
        }) || [];

        if (allPlayableMaps.length === 0) {
            toast.error("Erreur : Impossible de charger les cartes !");
            return;
        }

        const shuffleArray = (array: any[]) => {
            const arr = [...array];
            for (let i = arr.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [arr[i], arr[j]] = [arr[j], arr[i]];
            }
            return arr;
        };

        const shuffled = shuffleArray(allPlayableMaps);
        const selectedIds = shuffled.slice(0, activeSession.maxRounds || 5).map(m => m.id);

        if (socket) {
            socket.emit('geoguesser:game:start', {
                targetMapIds: selectedIds,
                maxRounds: activeSession.maxRounds,
                difficulty: 'easy'
            });
            toast.success("C'est parti !");
        }
    };

    // Move targetMapId here for safety and easier reading
    const targetMapId = useMemo(() => {
        if (!activeSession || activeSession.currentRound === undefined) return null;
        if (activeSession.currentMapId) return activeSession.currentMapId;
        if (activeSession.targetMapIds && activeSession.targetMapIds.length >= activeSession.currentRound) {
            return activeSession.targetMapIds[activeSession.currentRound - 1];
        }
        return null;
    }, [activeSession]);

    // Auto-switch minimap world when a new target map is set in Geoguesser
    useEffect(() => {
        if (targetMapId && activeTab === 'games' && gamePhase === 'playing') {
            const tMap = allMapsByIdRef.current.get(targetMapId);
            if (tMap && tMap.worldMap !== selectedWorldId) {
                setSelectedWorldId(tMap.worldMap);
            }
        }
    }, [targetMapId, activeTab, gamePhase, selectedWorldId]);

    const handleAdvanceRound = async () => {
        if (!activeSession || !socket) return;
        socket.emit("geoguesser:game:next-round");
    };

    if (!activeWorld) return <div className="p-20 text-center text-white/20">Initialisation de la carte...</div>;

    return (
        <div className="w-full h-full flex flex-col bg-[#080b12] relative overflow-hidden">
            {/* Header & Controls (Hidden in focused games mode) */}
            {(activeTab === 'map' || !initialTab) && (
                <div className="flex-shrink-0 bg-slate-950/90 backdrop-blur-md border-b border-white/5 px-8 flex items-center justify-between h-[64px] z-[600]">
                    {/* Left: Navigation Tabs (Only if not in focused mode) */}
                    {!initialTab ? (
                        <div className="flex items-center bg-white/5 p-1 rounded-2xl border border-white/10 h-10">
                            <button
                                onClick={() => setActiveTab('map')}
                                className={`h-full px-6 text-[10px] font-black uppercase tracking-widest italic transition-all relative flex items-center gap-2 rounded-xl ${activeTab === 'map' ? 'text-emerald-950' : 'text-white/40 hover:text-white/70 hover:bg-white/5'}`}
                            >
                                {activeTab === 'map' && <motion.div layoutId="tab-pill" className="absolute inset-0 bg-emerald-500 rounded-xl shadow-[0_0_20px_rgba(16,185,129,0.4)]" />}
                                <MapIcon size={12} className={`relative z-10 ${activeTab === 'map' ? 'text-emerald-950' : 'text-white/20'}`} />
                                <span className="relative z-10">Exploration</span>
                            </button>
                            <button
                                onClick={() => setActiveTab('games')}
                                className={`h-full px-6 text-[10px] font-black uppercase tracking-widest italic transition-all relative flex items-center gap-2 rounded-xl ${activeTab === 'games' ? 'text-emerald-950' : 'text-white/40 hover:text-white/70 hover:bg-white/5'}`}
                            >
                                {activeTab === 'games' && <motion.div layoutId="tab-pill" className="absolute inset-0 bg-emerald-500 rounded-xl shadow-[0_0_20px_rgba(16,185,129,0.4)]" />}
                                <Trophy size={12} className={`relative z-10 ${activeTab === 'games' ? 'text-emerald-950' : 'text-white/20'}`} />
                                <span className="relative z-10">Mini-Jeux</span>
                            </button>
                        </div>
                    ) : <div />}

                    {/* Right: Map Contextual Tools (Visible ONLY on Map Tab) */}
                    <AnimatePresence mode="wait">
                        {activeTab === 'map' && (
                            <motion.div
                                key="map-tools"
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
                                            {searchResults.map((s: any) => (
                                                <button key={s.id === -999 ? `coord-${s.x}-${s.y}` : s.id} onClick={() => handleSearchResultClick(s)} className="w-full text-left px-4 py-3 hover:bg-white/5 border-b border-white/5 last:border-0 transition-colors">
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-white text-[10px] font-black uppercase italic">{typeof s.name === 'string' ? s.name : s.name?.fr || 'Inconnu'}</span>
                                                        {!s.isCoord && (
                                                            <span className="text-emerald-500/50 text-[8px] uppercase font-black px-1.5 py-0.5 rounded-md bg-emerald-500/5">Lvl {s.level || '?'}</span>
                                                        )}
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
            )}

            {/* Main Content Area (Map or Game) */}
            <div className="flex-1 relative flex overflow-hidden">

                {/* 🎯 MODE SIGIL GUESSER - ACTIVE GAMEPLAY */}
                {activeTab === 'games' && gamePhase === 'playing' && (
                    <div className="flex flex-col lg:flex-row w-full h-full relative overflow-hidden bg-slate-950">
                        {/* 🖼️ ZONE CIBLE À GAUCHE (FRAGMENTS DE CARTE) */}
                        <div className="flex-1 relative bg-black/40 overflow-hidden flex items-center justify-center border-b lg:border-b-0 lg:border-r border-white/5 min-h-0">
                            {targetMapId ? (
                                <motion.div
                                    className="w-full h-full relative geoguesser-image-container"
                                    initial={{ scale: 1.1, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                >
                                    <img
                                        src={`/game-data/hd_maps/${targetMapId}.webp`}
                                        className="w-full h-full object-cover opacity-90 transition-all duration-1000 ease-out"
                                        alt="Target"
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20" />

                                    {/* Hint Overlay (Floating in image) */}
                                    <div className="absolute bottom-4 left-4 md:bottom-10 md:left-10 flex items-center gap-2 md:gap-5">
                                        <div className="w-8 h-8 md:w-16 md:h-16 rounded-xl md:rounded-[2rem] bg-emerald-500/20 border border-emerald-500/30 backdrop-blur-2xl flex items-center justify-center shadow-[0_0_50px_rgba(16,185,129,0.2)]">
                                            <Target className="w-4 h-4 md:w-8 md:h-8 text-emerald-500" />
                                        </div>
                                        <div className="space-y-0 md:space-y-1">
                                            <h2 className="text-white font-black text-sm md:text-4xl uppercase italic tracking-tighter drop-shadow-2xl">Où est-ce ?</h2>
                                            <p className="text-emerald-400/60 text-[6px] md:text-xs font-black uppercase tracking-[0.2em] md:tracking-[0.4em]">Analyse le décor</p>
                                        </div>
                                    </div>
                                </motion.div>
                            ) : (
                                <div className="flex flex-col items-center gap-4 text-white/10 uppercase font-black italic">
                                    <Loader2 className="animate-spin" size={32} />
                                    <p className="tracking-widest text-[10px]">Initialisation...</p>
                                </div>
                            )}
                        </div>

                        {/* 🗺️ PANEL INTERACTIF À DROITE (CARTE COMPLÈTE) */}
                        <div className="flex-1 lg:flex-none lg:w-[35vw] lg:max-w-[850px] lg:min-w-[500px] border-l border-white/5 bg-[#080b0e] flex flex-col relative z-20 shadow-[-20px_0_50px_rgba(0,0,0,0.5)] min-h-0">

                            {/* Integrated Multi-Leaderboard (Top of panel - Fixed Height) */}
                            {!isSoloMode && (
                                <div className="h-[180px] md:h-[280px] shrink-0 bg-black/40 p-3 md:p-6 flex flex-col border-b border-white/5">
                                    <div className="flex items-center justify-between mb-4">
                                        <h4 className="text-white/20 text-[10px] font-black uppercase tracking-[0.4em] flex items-center gap-2 italic">
                                            <Users size={14} /> Joueurs du Salon
                                        </h4>
                                        <span className="text-emerald-500/40 text-[9px] font-black uppercase tracking-widest italic">{activeSession?.participants?.length || 1} Connectés</span>
                                    </div>
                                    <div className="flex-1 overflow-y-auto pr-2 space-y-2 custom-scrollbar list-none">
                                        {[...(activeSession?.participants || [])].sort((a: any, b: any) => (b.score || 0) - (a.score || 0)).map((p: any, i: number) => {
                                            const isMe = p.userId === currentUserId;
                                            return (
                                                <div key={p.userId} className={`flex items-center justify-between p-3 rounded-2xl transition-all ${isMe ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-white/5'}`}>
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-lg bg-slate-900 border border-white/10 flex items-center justify-center overflow-hidden">
                                                            {p.userAvatar ? (
                                                                <img src={p.userAvatar} alt="" className="w-full h-full object-cover" />
                                                            ) : (
                                                                <div className={`w-full h-full flex items-center justify-center text-[10px] font-black italic ${i === 0 && p.score > 0 ? 'bg-amber-500 text-black' : 'bg-white/10 text-white/40'}`}>
                                                                    {i === 0 && p.score > 0 ? '👑' : i + 1}
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div className="flex flex-col">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-white text-[11px] font-black uppercase italic tracking-wider">{p.userName}</span>
                                                                {isMe && <span className="px-1 py-0.5 rounded bg-emerald-500 text-[7px] text-black font-black uppercase italic">Toi</span>}
                                                            </div>
                                                            {!p.hasGuessed ? (
                                                                <span className="text-[8px] text-white/20 font-bold uppercase italic flex items-center gap-1">
                                                                    <Clock size={8} className="animate-spin-slow" /> Réfléchit...
                                                                </span>
                                                            ) : (
                                                                <span className="text-[8px] text-emerald-500 font-bold uppercase italic flex items-center gap-1">
                                                                    <CheckCircle2 size={8} /> Prêt !
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        <span className="text-lg font-black text-emerald-500 italic leading-none">{p.score}</span>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Panel Header */}
                            <div className="h-14 shrink-0 px-6 flex items-center justify-between border-b border-white/5 bg-black/20">
                                <div className="flex items-center gap-3">
                                    <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_15px_#10b981]" />
                                    <h3 className="text-white font-black text-[10px] uppercase tracking-widest italic">Carte Tactique</h3>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="flex items-center gap-1 mr-2 border-r border-white/10 pr-3">
                                        <button
                                            onClick={() => setMinimapRecenterTrigger(t => t + 999)} // Use specific pattern for zoom in
                                            className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 text-white/40 hover:text-white border border-white/5 transition-all active:scale-95"
                                            title="Zoomer"
                                        >
                                            <Plus size={14} />
                                        </button>
                                        <button
                                            onClick={() => setMinimapRecenterTrigger(t => t - 999)} // Use specific pattern for zoom out
                                            className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 text-white/40 hover:text-white border border-white/5 transition-all active:scale-95"
                                            title="Dézoomer"
                                        >
                                            <Minus size={14} />
                                        </button>
                                    </div>
                                    <button
                                        onClick={() => setMinimapRecenterTrigger(t => t > 0 && t < 900 ? t + 1 : 1)}
                                        className="px-4 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/40 hover:text-white border border-white/5 transition-all flex items-center gap-2 active:scale-95"
                                    >
                                        <Compass size={12} />
                                        <span className="text-[9px] font-black uppercase italic">Recentrer</span>
                                    </button>
                                </div>
                            </div>

                            {/* Integrated Map - Fixed flexible container */}
                            <div className="flex-1 relative bg-slate-950 overflow-hidden min-h-[400px]">
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
                                    isMiniMap={true}
                                    minimapRecenterTrigger={minimapRecenterTrigger}
                                    participants={activeSession?.participants}
                                    currentUserId={currentUserId}
                                    isSpectator={isCurrentUserSpectator}
                                    minZoom={Math.max((true && selectedWorldId !== 1) ? -3 : -4, -(activeWorld.zoom?.length || 1) - 1)}
                                />

                                {/* Floating Validation Overlay inside panel */}
                                {selectedPosition && gamePhase === 'playing' && !isCurrentUserSpectator && (
                                    <div className="absolute bottom-6 inset-x-6 z-[1000] animate-in slide-in-from-bottom-6 duration-500">
                                        <button
                                            onClick={submitPendingGuess}
                                            className="w-full py-5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-white font-black uppercase text-xs italic tracking-widest shadow-[0_20px_40px_rgba(16,185,129,0.3)] border border-emerald-400/50 transition-all active:scale-95 flex items-center justify-center gap-4"
                                        >
                                            Confirmer ma position <Target size={20} />
                                        </button>
                                    </div>
                                )}

                                {isCurrentUserSpectator && gamePhase === 'playing' && (
                                    <div className="absolute top-6 inset-x-6 z-[1000] animate-in slide-in-from-top-6 duration-500">
                                        <div className="w-full py-4 rounded-2xl bg-[#a78bfa]/10 backdrop-blur-xl border border-[#a78bfa]/20 flex items-center justify-center gap-3 shadow-[0_10px_30px_rgba(167,139,250,0.1)]">
                                            <div className="w-2 h-2 rounded-full bg-[#a78bfa] animate-pulse" />
                                            <span className="text-[#a78bfa] font-black uppercase text-[10px] tracking-[0.2em] italic drop-shadow-sm">Mode Spectateur — Observation seule</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* 🗺️ MODE NAVIGATION CARTE CLASSIQUE */}
                {activeTab === 'map' && (
                    <div className="relative w-full h-full">
                        <LeafletMapCore
                            activeWorld={activeWorld}
                            selectedWorldId={selectedWorldId}
                            activeMaps={activeMaps}
                            mapsByCoords={allWorldMapsByCoords}
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
                            isMiniMap={false}
                            minimapRecenterTrigger={minimapRecenterTrigger}
                                    participants={activeSession?.participants}
                                    currentUserId={currentUserId}
                                    isSpectator={isCurrentUserSpectator}
                            minZoom={Math.max((false && selectedWorldId !== 1) ? -3 : -4, -(activeWorld.zoom?.length || 1) - 1)}
                        />
                    </div>
                )}

                {/* Game HUD Overlay - Portaled to Header */}
                {activeTab === 'games' && gamePhase !== 'idle' && activeSession && (
                    <>
                        {typeof document !== 'undefined' && document.getElementById('sigil-geoguesser-header-hud') ? (
                            createPortal(
                                <GeoguesserHUD
                                    round={activeSession.currentRound || 1}
                                    maxRounds={activeSession.maxRounds || 5}
                                    timeLeft={timeLeft}
                                    score={score}
                                    gamePhase={gamePhase}
                                    spectators={activeSession.participants?.filter((p: any) => p.isSpectator)}
                                />,
                                document.getElementById('sigil-geoguesser-header-hud')!
                            )
                        ) : (
                            <div className="absolute top-4 sm:top-10 left-1/2 -translate-x-1/2 z-[700] pointer-events-none w-full sm:w-auto px-4 sm:px-0">
                                <GeoguesserHUD
                                    round={activeSession.currentRound || 1}
                                    maxRounds={activeSession.maxRounds || 5}
                                    timeLeft={timeLeft}
                                    score={score}
                                    gamePhase={gamePhase}
                                    spectators={activeSession.participants?.filter((p: any) => p.isSpectator)}
                                />
                            </div>
                        )}

                        {/* QUITTER LA PARTIE BUTTON - Portaled to Header */}
                        {typeof document !== 'undefined' && document.getElementById('sigil-geoguesser-header-actions') ? (
                            createPortal(
                                <button
                                    onClick={handleLeaveSession}
                                    className="px-4 py-2 sm:px-6 sm:py-3 rounded-lg sm:rounded-xl bg-[#ff4757] hover:bg-[#ff6b81] text-white font-black uppercase text-[10px] sm:text-xs italic border-b-[4px] border-black/20 transition-all flex items-center gap-2 shadow-[0_10px_20px_rgba(255,71,87,0.2)] active:translate-y-1 active:border-b-0 hover:scale-105"
                                >
                                    <LogOut size={16} />
                                    <span>Quitter la partie</span>
                                </button>,
                                document.getElementById('sigil-geoguesser-header-actions')!
                            )
                        ) : (
                            <div className="absolute top-4 left-4 sm:top-6 sm:left-8 pointer-events-auto z-[800]">
                                <button
                                    onClick={handleLeaveSession}
                                    className="px-5 py-3 sm:px-8 sm:py-4 rounded-xl sm:rounded-2xl bg-[#ff4757] hover:bg-[#ff6b81] text-white font-black uppercase text-[10px] sm:text-xs italic border-b-[4px] sm:border-b-[8px] border-black/20 transition-all flex items-center gap-3 shadow-[0_20px_40px_rgba(255,71,87,0.3)] active:translate-y-1 active:border-b-0 hover:scale-105"
                                >
                                    <LogOut size={18} className="sm:w-5 sm:h-5" />
                                    <span>Quitter la partie</span>
                                </button>
                            </div>
                        )}
                    </>
                )}

                {/* Result Screen Full Overlay (Inter-round) */}
                <AnimatePresence>
                    {gamePhase === 'result' && activeSession && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 z-[1100] bg-black/60 backdrop-blur-md pointer-events-auto flex flex-col items-center justify-center p-4 md:p-8"
                        >
                            <motion.div
                                initial={{ y: 50, opacity: 0, scale: 0.95 }}
                                animate={{ y: 0, opacity: 1, scale: 1 }}
                                className="w-full max-w-6xl bg-[#0d111a]/95 backdrop-blur-[40px] border border-white/10 rounded-[3rem] md:rounded-[4rem] shadow-[0_50px_100px_rgba(0,0,0,0.9)] p-6 md:p-10 pointer-events-auto relative overflow-hidden flex flex-col"
                            >
                                <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-emerald-500/[0.03] rounded-full blur-[120px] -translate-y-1/2 translate-x-1/4 pointer-events-none" />

                                {/* Header: More compact for horizontal layout */}
                                <div className="flex items-center justify-between mb-8 gap-6 border-b border-white/5 pb-8 relative z-10">
                                    <div className="flex items-center gap-5">
                                        <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 border border-emerald-500/20 shadow-[0_0_40px_rgba(16,185,129,0.1)]">
                                            <Trophy size={28} />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-3 mb-1">
                                                <h3 className="text-white font-black text-3xl uppercase italic leading-none tracking-tighter">Round {activeSession.currentRound}</h3>
                                                <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider ${activeSession.state === 'IN_PROGRESS' ? 'bg-amber-500/20 text-amber-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                                                    {activeSession.state === 'IN_PROGRESS' ? 'En attente des joueurs' : 'Terminé'}
                                                </span>
                                            </div>
                                            <p className="text-white/20 text-[10px] font-black uppercase tracking-[0.3em] italic">Analyse des Précisions Géographiques</p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-4">
                                        <div className="px-5 py-3 rounded-2xl bg-white/5 border border-white/5 flex flex-col items-center min-w-[100px]">
                                            <span className="text-white/20 text-[8px] font-black uppercase tracking-[0.2em] mb-1 italic">Prochain Round dans</span>
                                            <span className="text-white font-black text-2xl italic tracking-tighter leading-none">{timeLeft}s</span>
                                        </div>
                                        {(activeSession?.hostId === currentUserId || isSoloMode) && activeSession.state !== 'IN_PROGRESS' && (
                                            <motion.button
                                                whileHover={{ scale: 1.02, y: -2 }}
                                                whileTap={{ scale: 0.98 }}
                                                onClick={handleNextRound}
                                                className="px-8 py-4 rounded-2xl bg-emerald-500 text-white font-black uppercase text-xs italic transition-all flex items-center gap-3 border-b-4 border-emerald-700 shadow-[0_20px_40px_rgba(16,185,129,0.2)] hover:shadow-[0_25px_50px_rgba(16,185,129,0.3)]"
                                            >
                                                <span>Suivant</span>
                                                <ChevronRight size={18} />
                                            </motion.button>
                                        )}
                                    </div>
                                </div>

                                <div className="flex flex-col lg:flex-row gap-10 flex-1 min-h-0 relative z-10">
                                    {/* Left Side: Result Analysis & Comparison */}
                                    <div className="flex-1 flex flex-col gap-6">
                                        {guessResult && (
                                            <>
                                                <div className="p-6 rounded-[2.5rem] bg-white/[0.02] border border-white/5 flex items-center justify-between overflow-hidden relative group">
                                                    <div className="flex items-center gap-6 relative z-10">
                                                        <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 shadow-inner">
                                                            <Target className="text-emerald-400 w-8 h-8" />
                                                        </div>
                                                        <div>
                                                            <div className="text-white/20 text-[10px] font-black uppercase tracking-[0.2em] mb-1 italic">Score Précision</div>
                                                            <div className="text-white font-black text-3xl italic flex items-center gap-3">
                                                                {Math.round(guessResult.distance)} Maps
                                                                <span className="text-emerald-500/40 text-[14px] font-bold uppercase tracking-widest">de distance</span>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Progress Track */}
                                                    <div className="flex-1 max-w-[200px] hidden xl:block">
                                                        <div className="h-2 bg-white/5 rounded-full overflow-hidden relative">
                                                            <motion.div
                                                                initial={{ width: "100%" }}
                                                                animate={{ width: `${Math.max(0, 100 - (guessResult.distance / 20) * 100)}%` }}
                                                                className="absolute inset-y-0 left-0 bg-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.5)]"
                                                            />
                                                        </div>
                                                        <div className="flex justify-between mt-2">
                                                            <span className="text-[8px] font-black text-white/10 uppercase italic">0 km</span>
                                                            <span className="text-[8px] font-black text-white/10 uppercase italic">Maximum</span>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-2 gap-6 flex-1">
                                                    {/* Your Choice */}
                                                    <div className="flex flex-col gap-3 h-full">
                                                        <div className="flex items-center justify-between px-2">
                                                            <div className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] italic flex items-center gap-2">
                                                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                                                Ton Choix
                                                            </div>
                                                            {(() => {
                                                                const me = activeSession.participants?.find((p: any) =>
                                                                    String(p.userId) === String(currentUserId) ||
                                                                    (currentUserIdRef.current && String(p.userId) === String(currentUserIdRef.current))
                                                                );
                                                                const bestGuess = guessResult?.guess || me?.lastGuess;
                                                                const mId = bestGuess?.mapId;
                                                                if (mId) {
                                                                    return (
                                                                        <span className="text-[8px] font-black text-emerald-500/50 uppercase tracking-widest italic truncate max-w-[150px]">
                                                                            {subAreasById.get(allMapsById.get(mId)?.subAreaId)?.name?.fr || 'Zone Inconnue'}
                                                                        </span>
                                                                    );
                                                                }
                                                                return null;
                                                            })()}
                                                        </div>
                                                        <div className="flex-1 bg-slate-900 rounded-[2rem] border border-white/10 overflow-hidden shadow-2xl relative group ring-1 ring-white/5">
                                                            {(() => {
                                                                const me = activeSession.participants?.find((p: any) =>
                                                                    String(p.userId) === String(currentUserId) ||
                                                                    (currentUserIdRef.current && String(p.userId) === String(currentUserIdRef.current))
                                                                );
                                                                const bestGuess = guessResult?.guess || me?.lastGuess;
                                                                const mId = bestGuess?.mapId;

                                                                if (mId) {
                                                                    return <img
                                                                        src={`/game-data/hd_maps/${mId}.webp`}
                                                                        className="w-full h-full object-cover transition-transform group-hover:scale-110 duration-700"
                                                                        alt="Ton choix"
                                                                    />;
                                                                } else if (bestGuess) {
                                                                    return (
                                                                        <div className="w-full h-full flex items-center justify-center flex-col gap-4 bg-slate-950/50">
                                                                            <div className="w-12 h-12 rounded-full border-2 border-emerald-500/20 flex items-center justify-center">
                                                                                <MapIcon className="text-emerald-500/50" size={24} />
                                                                            </div>
                                                                            <div className="text-center">
                                                                                <span className="text-[10px] uppercase font-black italic tracking-widest text-emerald-500/50">Position Validée</span>
                                                                                <p className="text-[8px] font-mono text-white/20 mt-1">[{bestGuess.x}, {bestGuess.y}]</p>
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                } else {
                                                                    return (
                                                                        <div className="w-full h-full flex items-center justify-center flex-col gap-4 text-white/10">
                                                                            <div className="w-12 h-12 rounded-full border-2 border-dashed border-white/10 flex items-center justify-center">
                                                                                <div className="w-2 h-2 rounded-full bg-white/5" />
                                                                            </div>
                                                                            <span className="text-[10px] uppercase font-black italic tracking-widest">Aucune décision prise</span>
                                                                        </div>
                                                                    );
                                                                }
                                                            })()}
                                                            <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/60 to-transparent pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity" />
                                                        </div>
                                                    </div>

                                                    {/* Solution */}
                                                    <div className="flex flex-col gap-3 h-full">
                                                        <div className="flex items-center justify-between px-2">
                                                            <div className="text-[10px] font-black text-rose-500/60 uppercase tracking-[0.2em] italic flex items-center gap-2">
                                                                <div className="w-1.5 h-1.5 rounded-full bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.5)]" />
                                                                La Solution
                                                            </div>
                                                            <span className="text-[8px] font-black text-rose-500/30 uppercase tracking-widest italic">
                                                                {subAreasById.get(allMapsById.get(targetMapId)?.subAreaId)?.name?.fr || 'Cible du Round'}
                                                            </span>
                                                        </div>
                                                        <div className="flex-1 bg-slate-900 rounded-[2rem] border border-rose-500/20 overflow-hidden shadow-2xl relative group ring-1 ring-rose-500/10">
                                                            {activeSession.state !== 'IN_PROGRESS' ? (
                                                                <>
                                                                    <img
                                                                        src={`/game-data/hd_maps/${targetMapId}.webp`}
                                                                        className="w-full h-full object-cover transition-transform group-hover:scale-110 duration-700"
                                                                        alt="Solution"
                                                                    />
                                                                    <div className="absolute inset-0 bg-rose-500/5 pointer-events-none" />
                                                                    <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-rose-950/40 to-transparent pointer-events-none" />
                                                                </>
                                                            ) : (
                                                                <div className="w-full h-full flex flex-col items-center justify-center gap-4 bg-slate-950/50 backdrop-blur-sm px-6">
                                                                    <div className="w-12 h-12 border-4 border-rose-500/20 border-t-rose-500 rounded-full animate-spin" />
                                                                    <p className="text-rose-500/50 text-[10px] font-black uppercase italic tracking-widest text-center">
                                                                        Analyse en cours...<br />
                                                                        La solution sera révélée dès que tout le monde aura joué.
                                                                    </p>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </>
                                        )}
                                    </div>

                                    {/* Right Side: Leaderboard */}
                                    <div className="w-full lg:w-[400px] flex flex-col pt-2 lg:pt-0">
                                        <div className="flex items-center justify-between mb-5 px-4">
                                            <div className="text-white/20 text-[10px] font-black uppercase tracking-[0.3em] italic">Classement Round</div>
                                            <div className="px-3 py-1 bg-zinc-800 rounded-lg text-white/40 text-[9px] font-black italic tracking-widest">
                                                {activeSession.participants?.filter((p: any) => !p.isSpectator).length} / 8 JOUEURS
                                            </div>
                                        </div>

                                        <div className="flex-1 space-y-3 overflow-y-auto pr-2 custom-scrollbar max-h-[400px]">
                                            {activeSession.participants?.filter((p: any) => !p.isSpectator).sort((a: any, b: any) => (b.lastGuess?.score || 0) - (a.lastGuess?.score || 0)).map((p: any, i: number) => {
                                                const dist = p.lastGuess?.distance ? Math.round(p.lastGuess.distance) : null;
                                                const isMe = p.userId === currentUserId;
                                                return (
                                                    <motion.div
                                                        initial={{ opacity: 0, x: 20 }}
                                                        animate={{ opacity: 1, x: 0 }}
                                                        transition={{ delay: i * 0.05 }}
                                                        key={p.userId}
                                                        className={`flex items-center justify-between p-4 rounded-3xl border transition-all ${isMe ? 'bg-emerald-500/10 border-emerald-500/30 shadow-[0_10px_30px_rgba(16,185,129,0.05)]' : 'bg-white/[0.03] border-white/5 hover:bg-white/[0.06]'}`}
                                                    >
                                                        <div className="flex items-center gap-4">
                                                            <div className="relative shrink-0">
                                                                <div className="w-12 h-12 rounded-2xl bg-slate-900 border border-white/10 flex items-center justify-center overflow-hidden shadow-inner">
                                                                    {p.userAvatar ? (
                                                                        <img src={p.userAvatar} alt="" className="w-full h-full object-cover" />
                                                                    ) : (
                                                                        <div className="w-full h-full bg-slate-800 flex items-center justify-center text-white/10 font-black text-[10px] uppercase">
                                                                            {p.userName?.charAt(0)}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                                <div className={`absolute -top-1.5 -left-1.5 w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-black italic shadow-2xl z-10 ${i === 0 ? 'bg-amber-500 text-black shadow-amber-500/30' : i === 1 ? 'bg-slate-300 text-black' : i === 2 ? 'bg-amber-700 text-white' : 'bg-white/10 text-white/40'}`}>
                                                                    {i + 1}
                                                                </div>
                                                            </div>

                                                            <div className="flex flex-col min-w-0">
                                                                <span className={`text-xs font-black uppercase tracking-tight italic truncate max-w-[120px] ${isMe ? 'text-emerald-400' : 'text-white/80'}`}>
                                                                    {p.userName}
                                                                </span>
                                                                <div className="flex items-center gap-2">
                                                                    {dist !== null ? (
                                                                        <span className="text-[10px] font-black text-amber-500 italic leading-none">{dist} <span className="text-[8px] opacity-40 uppercase">Maps</span></span>
                                                                    ) : (
                                                                        <span className="text-[8px] font-black text-white/10 uppercase tracking-widest italic">Absent</span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <div className="flex flex-col items-end gap-0.5">
                                                            <div className="flex items-center gap-2">
                                                                <span className={`font-black text-lg italic leading-none ${isMe ? 'text-emerald-400' : 'text-white'} ${(p.lastGuess?.score || 0) > 4000 ? 'text-amber-400 drop-shadow-[0_0_10px_rgba(251,191,36,0.2)]' : ''}`}>
                                                                    +{p.lastGuess?.score || 0}
                                                                </span>
                                                                {i === 0 && <Crown size={14} className="text-amber-500" strokeWidth={2.5} />}
                                                            </div>
                                                            {p.lastGuess?.mapId && (
                                                                <span className="text-[7px] font-black text-white/20 uppercase tracking-[0.1em] italic truncate max-w-[90px]">
                                                                    {subAreasById.get(allMapsById.get(p.lastGuess.mapId)?.subAreaId)?.name?.fr || "Zone Cache"}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </motion.div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Final Game Summary Modal */}
                <AnimatePresence>
                    {gamePhase === 'summary' && activeSession && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 z-[2000] bg-slate-950/90 backdrop-blur-xl flex items-center justify-center p-4 md:p-8 overflow-y-auto"
                        >
                            <motion.div
                                initial={{ scale: 0.9, y: 20 }}
                                animate={{ scale: 1, y: 0 }}
                                className="max-w-2xl w-full bg-[#0d111a] border border-white/10 rounded-3xl md:rounded-[3rem] p-6 md:p-12 shadow-[0_50px_100px_rgba(0,0,0,0.8)] flex flex-col items-center my-auto"
                            >
                                <div className="w-16 h-16 md:w-24 md:h-24 rounded-[1.5rem] md:rounded-[2rem] bg-indigo-500/5 flex items-center justify-center mb-4 md:mb-8 shrink-0">
                                    <Trophy className="w-8 h-8 md:w-12 md:h-12 text-indigo-400 drop-shadow-[0_0_20px_rgba(129,140,248,0.5)]" />
                                </div>

                                <h2 className="text-white font-black text-2xl md:text-5xl uppercase italic tracking-tighter mb-2 text-center">Partie Terminée</h2>
                                <p className="text-white/20 font-black uppercase tracking-[0.4em] text-[8px] md:text-[10px] mb-6 md:mb-12 italic">Stats Globales SigilGuesser</p>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8 w-full mb-6 md:mb-12">
                                    <div className="p-4 md:p-8 rounded-[1.5rem] md:rounded-[2rem] bg-indigo-500/5 border border-indigo-500/10 flex flex-col items-center">
                                        <span className="text-indigo-400 text-[8px] md:text-[10px] font-black uppercase tracking-widest mb-1 md:mb-2">Score Total</span>
                                        <span className="text-white font-black text-2xl md:text-4xl italic tracking-tight">{score}</span>
                                    </div>
                                    <div className="p-4 md:p-8 rounded-[1.5rem] md:rounded-[2rem] bg-emerald-500/5 border border-emerald-500/10 flex flex-col items-center">
                                        <span className="text-emerald-400 text-[8px] md:text-[10px] font-black uppercase tracking-widest mb-1 md:mb-2">Résultat</span>
                                        <span className="text-white font-black text-2xl md:text-4xl italic tracking-tight">Fin</span>
                                    </div>
                                </div>

                                <div className="w-full space-y-3 mb-12 max-h-60 overflow-y-auto pr-2 scrollbar-hide">
                                    {activeSession.participants?.filter((p: any) => !p.isSpectator).sort((a: any, b: any) => b.score - a.score).map((p: any, i: number) => (
                                        <div key={p.userId} className={`flex items-center gap-4 p-4 rounded-2xl border ${p.userId === currentUserId ? 'bg-indigo-500/10 border-indigo-500/30' : 'bg-white/5 border-white/5'}`}>
                                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black italic ${i === 0 ? 'bg-amber-500 text-black' : i === 1 ? 'bg-slate-300 text-black' : i === 2 ? 'bg-amber-700 text-white' : 'bg-white/10 text-white/40'}`}>
                                                {i + 1}
                                            </div>
                                            <div className="w-10 h-10 rounded-xl bg-slate-900 border border-white/10 flex items-center justify-center overflow-hidden">
                                                {p.userAvatar ? (
                                                    <img src={p.userAvatar} alt="" className="w-full h-full object-cover" />
                                                ) : (
                                                    <span className="text-white/20 font-bold text-xs">?</span>
                                                )}
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-white font-black text-xs uppercase italic">{p.userName}</span>
                                            </div>
                                            <div className="ml-auto text-white font-black italic">{p.score} <span className="text-[10px] text-white/30 font-normal">pts</span> </div>
                                        </div>
                                    ))}
                                </div>

                                <div className="flex gap-4">
                                    <button
                                        onClick={handleReplay}
                                        className="px-10 py-5 rounded-2xl bg-emerald-500 text-white font-black uppercase text-sm italic shadow-2xl shadow-emerald-500/20 hover:scale-[1.05] transition-all active:scale-[0.98] flex items-center gap-2"
                                    >
                                        <RotateCcw size={18} />
                                        Rejouer
                                    </button>
                                    <button
                                        onClick={handleLeaveSession}
                                        className="px-10 py-5 rounded-2xl bg-indigo-500 text-white font-black uppercase text-sm italic shadow-2xl shadow-indigo-500/20 hover:scale-[1.05] transition-all active:scale-[0.98]"
                                    >
                                        Retour au Menu
                                    </button>
                                </div>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>
                {selectedPosition && activeTab === 'map' && (
                    <MapDetailsPanel
                        position={selectedPosition}
                        subAreaName={
                            (subAreasById.get(
                                (selectedPosition.mapId ? mapsById.get(selectedPosition.mapId) : mapsByCoords.get(`${selectedPosition.x},${selectedPosition.y}`))?.subAreaId
                            )?.name?.fr) ||
                            (typeof subAreasById.get(
                                (selectedPosition.mapId ? mapsById.get(selectedPosition.mapId) : mapsByCoords.get(`${selectedPosition.x},${selectedPosition.y}`))?.subAreaId)?.name === 'string'
                                ? subAreasById.get((selectedPosition.mapId ? mapsById.get(selectedPosition.mapId) : mapsByCoords.get(`${selectedPosition.x},${selectedPosition.y}`))?.subAreaId)?.name
                                : undefined)
                        }
                        onClose={() => setSelectedPosition(null)}
                        guildId={guildId}
                        onOpenZoneDetails={() => setShowZoneDetail(true)}
                    />
                )}

                {showZoneDetail && selectedPosition && (
                    <ZoneDetailModal
                        isOpen={showZoneDetail}
                        onClose={() => setShowZoneDetail(false)}
                        guildId={guildId}
                        position={selectedPosition}
                        zoneName={
                            (subAreasById.get(
                                (selectedPosition.mapId ? mapsById.get(selectedPosition.mapId) : mapsByCoords.get(`${selectedPosition.x},${selectedPosition.y}`))?.subAreaId
                            )?.name?.fr) ||
                            (typeof subAreasById.get(
                                (selectedPosition.mapId ? mapsById.get(selectedPosition.mapId) : mapsByCoords.get(`${selectedPosition.x},${selectedPosition.y}`))?.subAreaId)?.name === 'string'
                                ? subAreasById.get((selectedPosition.mapId ? mapsById.get(selectedPosition.mapId) : mapsByCoords.get(`${selectedPosition.x},${selectedPosition.y}`))?.subAreaId)?.name
                                : "Zone Inconnue")
                        }
                    />
                )}

                {/* --- GAMES TAB --- */}
                {activeTab === 'games' && !activeSession && gamePhase === 'idle' && (
                    <div className="absolute inset-0 bg-[#080b12] z-[500] overflow-y-auto pt-24 pb-20 scrollbar-hide">
                        {/* Background Decorative Elements */}
                        <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-emerald-500/5 to-transparent pointer-events-none" />
                        <div className="absolute top-1/4 -left-20 w-80 h-80 bg-emerald-500/10 rounded-full blur-[120px] pointer-events-none" />
                        <div className="absolute top-1/2 -right-20 w-80 h-80 bg-blue-500/10 rounded-full blur-[120px] pointer-events-none" />

                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="p-4 md:p-8 lg:p-12 max-w-[1600px] mx-auto space-y-8 lg:space-y-16 relative"
                        >
                            <div className="flex flex-col gap-2 md:ml-10">
                                <h2 className="text-white font-black text-2xl md:text-4xl lg:text-5xl uppercase italic tracking-tighter flex items-center gap-3 lg:gap-4 leading-tight">
                                    <div className="w-8 lg:w-12 h-1 bg-gradient-to-r from-purple-500 to-transparent rounded-full shrink-0" />
                                    L'Arène des Sigils
                                </h2>
                                <p className="text-white/30 text-[10px] md:text-sm font-medium uppercase tracking-widest leading-relaxed max-w-2xl">
                                    Défiez vos alliés dans des épreuves légendaires.
                                </p>
                            </div>

                            <div className="grid grid-cols-1 xl:grid-cols-4 gap-8 items-start">
                                <div className="xl:col-span-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4 gap-6">
                                    {/* Geoguesser Card */}
                                    <motion.div
                                        whileHover={getGameStatus('guesser').isEnabled ? { y: -5 } : {}}
                                        className={cn(
                                            "group relative bg-[#0a0f18]/60 backdrop-blur-3xl border rounded-[2.5rem] p-8 flex flex-col transition-all shadow-2xl overflow-hidden h-full",
                                            getGameStatus('guesser').isEnabled 
                                                ? "hover:border-emerald-500/40 hover:bg-[#0a0f18]/80 border-white/5" 
                                                : "border-red-500/20 grayscale opacity-70"
                                        )}
                                    >
                                        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-[60px] group-hover:bg-emerald-500/10 transition-all duration-700" />

                                        <div className="relative z-10 flex flex-col h-full">
                                            <div className="flex items-start justify-between mb-6">
                                                <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 group-hover:scale-110 transition-all duration-300">
                                                    <Target className="text-emerald-400 w-8 h-8" strokeWidth={2.5} />
                                                </div>
                                                <div className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[8px] font-black uppercase tracking-widest italic">
                                                    {getGameStatus('guesser').isEnabled ? 'EXPLORATION' : 'MAINTENANCE'}
                                                </div>
                                            </div>

                                            <h3 className="text-white font-black text-2xl uppercase italic mb-1 tracking-tight group-hover:text-emerald-400 transition-colors">Sigil-Guesser</h3>
                                            <div className="mb-4">
                                                <span className="text-emerald-500/60 text-[9px] font-black uppercase tracking-[0.2em] italic">"Où suis-je ? Le Zaap est cassé !"</span>
                                            </div>
                                            <p className="text-white/40 text-[10px] font-medium leading-relaxed mb-8 h-12 overflow-hidden">
                                                {getGameStatus('guesser').isEnabled 
                                                    ? "Un mystérieux incident de Zaap vous a projeté dans l'inconnu. Saurez-vous identifier ce fragment du Monde des Douze pour retrouver votre chemin ?"
                                                    : getGameStatus('guesser').message}
                                            </p>

                                            <div className="space-y-3 mt-auto">
                                                {getGameStatus('guesser').isEnabled ? (
                                                    <>
                                                        <button
                                                            onClick={handleCreateRoom}
                                                            className="w-full py-4 rounded-xl bg-emerald-500 text-white font-black uppercase text-[10px] italic shadow-lg shadow-emerald-500/20 hover:bg-emerald-400 hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2"
                                                        >
                                                            <Plus size={14} /> Créer un Salon
                                                        </button>
                                                        <button
                                                            onClick={handleSoloMode}
                                                            className="w-full py-4 rounded-xl bg-white/5 text-white/60 font-black uppercase text-[10px] italic border border-white/10 hover:bg-white/10 hover:text-white transition-all flex items-center justify-center gap-2"
                                                        >
                                                            <Compass size={14} /> Jouer Solo
                                                        </button>
                                                    </>
                                                ) : (
                                                    <div className="w-full py-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-500 text-center text-[10px] font-black uppercase italic tracking-widest">
                                                        Indisponible
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </motion.div>

                                    {/* Sigil-Draw Card */}
                                    <motion.div
                                        whileHover={getGameStatus('draw').isEnabled ? { y: -5 } : {}}
                                        className={cn(
                                            "group relative bg-[#0a0f18]/60 backdrop-blur-3xl border rounded-[2.5rem] p-8 flex flex-col transition-all shadow-2xl overflow-hidden h-full",
                                            getGameStatus('draw').isEnabled 
                                                ? "hover:border-blue-500/40 hover:bg-[#0a0f18]/80 border-white/5" 
                                                : "border-red-500/20 grayscale opacity-70"
                                        )}
                                    >
                                        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-[60px] group-hover:bg-blue-500/10 transition-all duration-700" />

                                        <div className="relative z-10 flex flex-col h-full">
                                            <div className="flex items-start justify-between mb-6">
                                                <div className="w-16 h-16 rounded-2xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20 group-hover:scale-110 transition-all duration-300">
                                                    <Palette className="text-blue-400 w-8 h-8" strokeWidth={2.5} />
                                                </div>
                                                <div className="px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[8px] font-black uppercase tracking-widest italic">
                                                    {getGameStatus('draw').isEnabled ? 'DESSIN' : 'MAINTENANCE'}
                                                </div>
                                            </div>

                                            <h3 className="text-white font-black text-2xl uppercase italic mb-1 tracking-tight group-hover:text-blue-400 transition-colors">Sigil-Draw</h3>
                                            <div className="mb-4">
                                                <span className="text-blue-400/60 text-[9px] font-black uppercase tracking-[0.2em] italic">"L'art délicat de l'Esquisse d'Ecaflip"</span>
                                            </div>
                                            <p className="text-white/40 text-[10px] font-medium leading-relaxed mb-8 h-12 overflow-hidden">
                                                {getGameStatus('draw').isEnabled 
                                                    ? "Maîtrisez le pinceau de Pandala. Faites deviner les reliques et légendes aux autres Douziens par la force du trait."
                                                    : getGameStatus('draw').message}
                                            </p>

                                            <div className="space-y-3 mt-auto">
                                                {getGameStatus('draw').isEnabled ? (
                                                    <>
                                                        <a
                                                            href={`/dashboard/${guildId}/mini-jeux/skribbl`}
                                                            className="w-full py-4 rounded-xl bg-blue-600 text-white font-black uppercase text-[10px] italic shadow-lg shadow-blue-600/20 hover:bg-blue-500 hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2"
                                                        >
                                                            <Plus size={14} /> Créer un Salon
                                                        </a>
                                                        <button className="w-full py-4 rounded-xl bg-white/5 text-white/20 font-black uppercase text-[10px] italic border border-white/5 cursor-not-allowed flex items-center justify-center gap-2">
                                                            Solo bientôt
                                                        </button>
                                                    </>
                                                ) : (
                                                    <div className="w-full py-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-500 text-center text-[10px] font-black uppercase italic tracking-widest">
                                                        Indisponible
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </motion.div>

                                    {/* Sigil-Phone Card */}
                                    <motion.div
                                        whileHover={getGameStatus('phone').isEnabled ? { y: -5 } : {}}
                                        className={cn(
                                            "group relative bg-[#0a0f18]/60 backdrop-blur-3xl border rounded-[2.5rem] p-8 flex flex-col transition-all shadow-2xl overflow-hidden h-full",
                                            getGameStatus('phone').isEnabled 
                                                ? "hover:border-amber-500/40 hover:bg-[#0a0f18]/80 border-white/5" 
                                                : "border-red-500/20 grayscale opacity-70"
                                        )}
                                    >
                                        <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-[60px] group-hover:bg-amber-500/10 transition-all duration-700" />

                                        <div className="relative z-10 flex flex-col h-full">
                                            <div className="flex items-start justify-between mb-6">
                                                <div className="w-16 h-16 rounded-2xl bg-amber-500/10 flex items-center justify-center border border-amber-500/20 group-hover:scale-110 transition-all duration-300">
                                                    <Smartphone className="text-amber-500 w-8 h-8" strokeWidth={2.5} />
                                                </div>
                                                <div className="px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-500 text-[8px] font-black uppercase tracking-widest italic">
                                                    {getGameStatus('phone').isEnabled ? 'FUN' : 'MAINTENANCE'}
                                                </div>
                                            </div>

                                            <h3 className="text-white font-black text-2xl uppercase italic mb-1 tracking-tight group-hover:text-amber-500 transition-colors">Sigil-Phone</h3>
                                            <div className="mb-4">
                                                <span className="text-amber-500/60 text-[9px] font-black uppercase tracking-[0.2em] italic">"L'écho déformé d'Astrub"</span>
                                            </div>
                                            <p className="text-white/40 text-[10px] font-medium leading-relaxed mb-8 h-12 overflow-hidden">
                                                {getGameStatus('phone').isEnabled 
                                                    ? "Un message s'est perdu dans les égouts d'Astrub. Entre gribouillages et quiproquos, recréez l'histoire la plus absurde du serveur !"
                                                    : getGameStatus('phone').message}
                                            </p>

                                            <div className="space-y-3 mt-auto">
                                                {getGameStatus('phone').isEnabled ? (
                                                    <>
                                                        <a
                                                            href={`/dashboard/${guildId}/mini-jeux/gartic`}
                                                            className="w-full py-4 rounded-xl bg-amber-600 text-white font-black uppercase text-[10px] italic shadow-lg shadow-amber-600/20 hover:bg-amber-500 hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2"
                                                        >
                                                            <Plus size={14} /> Créer un Salon
                                                        </a>
                                                        <button className="w-full py-4 rounded-xl bg-white/5 text-white/20 font-black uppercase text-[10px] italic border border-white/5 cursor-not-allowed flex items-center justify-center gap-2">
                                                            Solo bientôt
                                                        </button>
                                                    </>
                                                ) : (
                                                    <div className="w-full py-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-500 text-center text-[10px] font-black uppercase italic tracking-widest">
                                                        Indisponible
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </motion.div>

                                {/* Sigil King Card */}
                                <motion.div
                                    whileHover={getGameStatus('king').isEnabled ? { y: -5 } : {}}
                                    className={cn(
                                        "group relative bg-[#0a0f18]/60 backdrop-blur-3xl border rounded-[2.5rem] p-8 flex flex-col transition-all shadow-2xl overflow-hidden h-full",
                                        getGameStatus('king').isEnabled 
                                            ? "hover:border-amber-600/40 hover:bg-[#0a0f18]/80 border-white/5" 
                                            : "border-red-500/20 grayscale opacity-70"
                                    )}
                                >
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-amber-600/5 rounded-full blur-[60px] group-hover:bg-amber-600/10 transition-all duration-700" />
                                    
                                    <div className="relative z-10 flex flex-col h-full">
                                        <div className="flex items-start justify-between mb-6">
                                            <div className="w-16 h-16 rounded-2xl bg-amber-600/10 flex items-center justify-center border border-amber-600/20 group-hover:scale-110 transition-all duration-300 text-2xl">
                                                👑
                                            </div>
                                            <div className="px-3 py-1 rounded-full bg-amber-600/10 border border-amber-600/20 text-amber-500 text-[8px] font-black uppercase tracking-widest italic">
                                                {getGameStatus('king').isEnabled ? 'CARTES' : 'MAINTENANCE'}
                                            </div>
                                        </div>

                                        <h3 className="text-white font-black text-2xl uppercase italic mb-1 tracking-tight group-hover:text-amber-500 transition-colors">Sigil King</h3>
                                        <div className="mb-4">
                                            <span className="text-amber-600/60 text-[9px] font-black uppercase tracking-[0.2em] italic">"Le Roi des Titans attend son adversaire"</span>
                                        </div>
                                        <p className="text-white/40 text-[10px] font-medium leading-relaxed mb-8 h-12 overflow-hidden">
                                            {getGameStatus('king').isEnabled 
                                                ? "Misez sur vos plis, jouez vos Incarnations et capturez Ogrest ! Un jeu de cartes stratégique inspiré de Skull King, dans l'univers du Monde des Douze."
                                                : getGameStatus('king').message}
                                        </p>

                                        <div className="space-y-3 mt-auto">
                                            {getGameStatus('king').isEnabled ? (
                                                <>
                                                    <a
                                                        href={`/dashboard/${guildId}/mini-jeux/sigil-king`}
                                                        className="w-full py-4 rounded-xl bg-amber-600 text-white font-black uppercase text-[10px] italic shadow-lg shadow-amber-600/20 hover:bg-amber-500 hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2"
                                                    >
                                                        <Plus size={14} /> Créer un Salon
                                                    </a>
                                                    <button className="w-full py-4 rounded-xl bg-white/5 text-white/20 font-black uppercase text-[10px] italic border border-white/5 cursor-not-allowed flex items-center justify-center gap-2">
                                                        Solo bientôt
                                                    </button>
                                                </>
                                            ) : (
                                                <div className="w-full py-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-500 text-center text-[10px] font-black uppercase italic tracking-widest">
                                                    Indisponible
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </motion.div>

                                    {/* Active Lobbies - Inline for better flow */}
                                    <div className="md:col-span-2 lg:col-span-2 xl:col-span-4 mt-4 lg:mt-6">
                                        <div className="flex items-center gap-4 mb-4 lg:mb-6">
                                            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                            <h4 className="text-white/30 font-black uppercase text-xs tracking-[0.2em]">Salons en attente de joueurs</h4>
                                            <div className="flex-1 h-px bg-white/5" />
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-4 max-h-[180px] lg:max-h-[240px] overflow-y-auto pr-2 custom-scrollbar">
                                            {(availableSessions.length === 0 && skribblRooms.length === 0 && garticRooms.length === 0 && sigilKingRooms.length === 0) ? (
                                                <div className="col-span-full h-20 lg:h-28 flex items-center justify-center border border-dashed border-white/5 rounded-2xl bg-white/[0.02] text-white/10 italic font-black uppercase text-[10px] tracking-[0.2em] text-center px-4">
                                                    Aucun salon actif • Créez le vôtre pour commencer
                                                </div>
                                            ) : (
                                                <>
                                                    {sigilKingRooms.map(room => (
                                                        <div key={room.roomId} className="p-4 bg-white/5 border border-amber-500/10 rounded-xl flex items-center justify-between group/lobby hover:bg-amber-500/5 transition-all">
                                                            <div className="flex flex-col min-w-0 pr-2">
                                                                <span className="text-white font-bold text-xs uppercase italic truncate">{room.hostName}</span>
                                                                <span className="text-amber-500/40 text-[10px] font-black uppercase mt-0.5 whitespace-nowrap">King • {room.playerCount}/6</span>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <a href={`/dashboard/${guildId}/mini-jeux/sigil-king?room=${room.roomId}`} className="px-3 lg:px-4 py-1.5 lg:py-2 rounded-lg bg-amber-600 text-white font-black uppercase text-[10px] shadow-md shadow-amber-600/20 opacity-90 hover:opacity-100 transition-all text-center">Join</a>
                                                                <a href={`/dashboard/${guildId}/mini-jeux/sigil-king?room=${room.roomId}&spectate=true`} className="px-2 lg:px-3 py-1.5 lg:py-2 rounded-lg bg-white/5 text-white/40 hover:text-white font-black uppercase text-[10px] transition-all text-center">Watch</a>
                                                            </div>
                                                        </div>
                                                    ))}
                                                    {availableSessions.map(room => (
                                                        <div key={room.id} className="p-4 bg-white/5 border border-emerald-500/10 rounded-xl flex items-center justify-between group/lobby hover:bg-emerald-500/5 transition-all">
                                                            <div className="flex flex-col min-w-0 pr-2">
                                                                <span className="text-white font-bold text-xs uppercase italic truncate">{room.hostName}</span>
                                                                <span className="text-emerald-500/40 text-[10px] font-black uppercase mt-0.5 whitespace-nowrap">Guesser • {room.playerCount}/8</span>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <button onClick={() => handleJoinRoom(room)} className="px-3 lg:px-4 py-1.5 lg:py-2 rounded-lg bg-emerald-500 text-white font-black uppercase text-[10px] shadow-md shadow-emerald-500/20 opacity-90 hover:opacity-100 transition-all">Join</button>
                                                                <button onClick={() => handleJoinRoom(room, true)} className="px-2 lg:px-3 py-1.5 lg:py-2 rounded-lg bg-white/5 text-white/40 hover:text-white font-black uppercase text-[10px] transition-all">Watch</button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                    {skribblRooms.map(room => (
                                                        <div key={room.roomId} className="p-4 bg-white/5 border border-blue-500/10 rounded-xl flex items-center justify-between group/lobby hover:bg-blue-500/5 transition-all">
                                                            <div className="flex flex-col min-w-0 pr-2">
                                                                <span className="text-white font-bold text-xs uppercase italic truncate">{room.hostName}</span>
                                                                <span className="text-blue-500/40 text-[10px] font-black uppercase mt-0.5 whitespace-nowrap">Draw • {room.playerCount}/8</span>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <a href={`/dashboard/${guildId}/mini-jeux/skribbl?room=${room.roomId}`} className="px-3 lg:px-4 py-1.5 lg:py-2 rounded-lg bg-blue-500 text-white font-black uppercase text-[10px] shadow-md shadow-blue-500/20 opacity-90 hover:opacity-100 transition-all text-center">Join</a>
                                                                <a href={`/dashboard/${guildId}/mini-jeux/skribbl?room=${room.roomId}&spectate=true`} className="px-2 lg:px-3 py-1.5 lg:py-2 rounded-lg bg-white/5 text-white/40 hover:text-white font-black uppercase text-[10px] transition-all text-center">Watch</a>
                                                            </div>
                                                        </div>
                                                    ))}
                                                    {garticRooms.map(room => (
                                                        <div key={room.roomId} className="p-4 bg-white/5 border border-amber-500/10 rounded-xl flex items-center justify-between group/lobby hover:bg-amber-500/5 transition-all">
                                                            <div className="flex flex-col min-w-0 pr-2">
                                                                <span className="text-white font-bold text-xs uppercase italic truncate">{room.hostName}</span>
                                                                <span className="text-amber-500/40 text-[10px] font-black uppercase mt-0.5 whitespace-nowrap">Phone • {room.playerCount}/8</span>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <a href={`/dashboard/${guildId}/mini-jeux/gartic?room=${room.roomId}`} className="px-3 lg:px-4 py-1.5 lg:py-2 rounded-lg bg-amber-500 text-white font-black uppercase text-[10px] shadow-md shadow-amber-500/20 opacity-90 hover:opacity-100 transition-all text-center">Join</a>
                                                                <a href={`/dashboard/${guildId}/mini-jeux/gartic?room=${room.roomId}&spectate=true`} className="px-2 lg:px-3 py-1.5 lg:py-2 rounded-lg bg-white/5 text-white/40 hover:text-white font-black uppercase text-[10px] transition-all text-center">Watch</a>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Sidebar Leaderboard */}
                                <div className="flex flex-col space-y-4 lg:space-y-6">
                                    <motion.div
                                        initial={{ opacity: 0, x: 20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        className="order-2 lg:order-1 bg-[#0a0f18]/80 backdrop-blur-3xl border border-white/5 rounded-[2rem] lg:rounded-[2.5rem] p-5 lg:p-8 flex flex-col shadow-2xl relative overflow-hidden h-[300px] lg:h-[600px]"
                                    >
                                        <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-[100px] pointer-events-none" />

                                        <div className="flex flex-col gap-3 lg:gap-4 mb-4 lg:mb-6 pb-4 lg:pb-6 border-b border-white/5 shrink-0">
                                            <div className="flex items-center justify-between">
                                                <h3 className="text-white font-black text-xl lg:text-2xl uppercase italic tracking-tighter">Élite</h3>
                                                <div className="px-2 lg:px-3 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center gap-1 lg:gap-1.5">
                                                    <Trophy size={10} className="text-amber-400 lg:w-3 lg:h-3" />
                                                    <span className="text-amber-400 text-[8px] lg:text-[10px] font-black uppercase">Hall of Fame</span>
                                                </div>
                                            </div>

                                            <div className="flex gap-1.5 p-1 bg-black/40 rounded-xl border border-white/5 shrink-0">
                                                <button
                                                    onClick={() => setLadderGame('guesser')}
                                                    className={`flex-1 py-1.5 rounded-lg text-[10px] lg:text-xs font-black uppercase transition-all ${ladderGame === 'guesser' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'text-white/20 hover:text-white/40'}`}
                                                >
                                                    Guesser
                                                </button>
                                                <button
                                                    onClick={() => setLadderGame('skribbl')}
                                                    className={`flex-1 py-1.5 rounded-lg text-[10px] lg:text-xs font-black uppercase transition-all ${ladderGame === 'skribbl' ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20' : 'text-white/20 hover:text-white/40'}`}
                                                >
                                                    DESSIN
                                                </button>
                                                <button
                                                    onClick={() => setLadderGame('king')}
                                                    className={`flex-1 py-1.5 rounded-lg text-[10px] lg:text-xs font-black uppercase transition-all ${ladderGame === 'king' ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/20' : 'text-white/20 hover:text-white/40'}`}
                                                >
                                                    King
                                                </button>
                                            </div>

                                            <div className="flex gap-1.5 p-1 bg-black/40 rounded-xl border border-white/5 shrink-0">
                                                <button
                                                    onClick={() => setLadderType('all_time')}
                                                    className={`flex-1 py-1 lg:py-1.5 rounded-lg text-[8px] lg:text-[10px] font-black uppercase transition-all ${ladderType === 'all_time' ? 'bg-white/10 text-white' : 'text-white/20 hover:text-white/40'}`}
                                                >
                                                    Général
                                                </button>
                                                <button
                                                    onClick={() => setLadderType('month')}
                                                    className={`flex-1 py-1 lg:py-1.5 rounded-lg text-[8px] lg:text-[10px] font-black uppercase transition-all ${ladderType === 'month' ? 'bg-white/10 text-white' : 'text-white/20 hover:text-white/40'}`}
                                                >
                                                    Mensuel
                                                </button>
                                            </div>
                                        </div>

                                        <div className="space-y-2 overflow-y-auto pr-1 custom-scrollbar flex-1 min-h-0">
                                            {isLoadingLadder ? (
                                                <div className="h-full flex items-center justify-center text-white/10 font-black uppercase text-xs animate-pulse">
                                                    Chargement...
                                                </div>
                                            ) : (ladderGame === 'king' ? kingLadder : ladder).length > 0 ? (
                                                (ladderGame === 'king' ? kingLadder : ladder).slice(0, 10).map((entry, index) => (
                                                    <div key={entry.userId || entry.id} className={`p-3 lg:p-4 rounded-xl ${index === 0 ? `bg-gradient-to-r ${ladderGame === 'guesser' ? 'from-emerald-500/10' : ladderGame === 'skribbl' ? 'from-blue-500/10' : 'from-amber-600/10'} to-transparent border ${ladderGame === 'guesser' ? 'border-emerald-500/20' : ladderGame === 'skribbl' ? 'border-blue-500/20' : 'border-amber-600/20'}` : 'bg-white/5 border border-white/5'} flex items-center justify-between group transition-all`}>
                                                        <div className="flex items-center gap-3 lg:gap-4 min-w-0 pr-2">
                                                            <div className={`w-8 h-8 lg:w-10 lg:h-10 rounded-lg flex items-center justify-center font-black text-xs italic shrink-0 ${index === 0 ? (ladderGame === 'guesser' ? 'bg-emerald-500' : ladderGame === 'skribbl' ? 'bg-blue-500' : 'bg-amber-600') + ' text-white' :
                                                                    index === 1 ? 'bg-slate-300 text-slate-900' :
                                                                        index === 2 ? 'bg-amber-700 text-white' :
                                                                            'text-white/20 border border-white/5'
                                                                }`}>
                                                                {index === 0 ? <Crown size={12} className="lg:w-[14px] lg:h-[14px]" /> : index + 1}
                                                            </div>
                                                            <div className="flex flex-col min-w-0">
                                                                <span className="text-white font-bold text-[10px] lg:text-xs uppercase italic truncate">{entry.userName}</span>
                                                                <span className="text-white/20 text-[8px] lg:text-[9px] font-black uppercase tracking-wider">{ladderGame === 'guesser' ? 'Explorateur' : ladderGame === 'skribbl' ? 'Artiste' : 'Titan'}</span>
                                                            </div>
                                                        </div>
                                                        <div className="text-right shrink-0">
                                                            <div className={`${ladderGame === 'guesser' ? 'text-emerald-500' : ladderGame === 'skribbl' ? 'text-blue-500' : 'text-amber-500'} font-black text-[10px] lg:text-xs uppercase italic whitespace-nowrap`}>{entry.bestScore || 0} pts</div>
                                                        </div>
                                                    </div>
                                                ))
                                            ) : (
                                                <div className="h-full flex items-center justify-center text-white/5 font-black uppercase text-[10px] lg:text-xs italic text-center p-4">
                                                    Aucun classement pour le moment
                                                </div>
                                            )}
                                        </div>
                                    </motion.div>

                                    <div className="order-1 lg:order-2 p-5 lg:p-6 bg-white/[0.02] border border-white/5 rounded-[1.5rem] lg:rounded-[2rem] relative overflow-hidden shrink-0">
                                        <div className="flex items-center gap-2 lg:gap-3 mb-2 lg:mb-3">
                                            <div className="p-1 lg:p-1.5 rounded-lg bg-purple-500/10 text-purple-400">
                                                <HelpCircle size={14} className="lg:w-4 lg:h-4" />
                                            </div>
                                            <span className="text-white/30 font-black uppercase text-[10px] lg:text-xs tracking-widest">Saviez-vous ?</span>
                                        </div>
                                        <p className="text-white/40 text-[10px] lg:text-[11px] font-medium leading-relaxed italic pr-2 lg:pr-4">
                                            En mode Spécial de SigilGuesser, vous n'avez que 10 secondes pour trouver la zone !
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}


                {/* --- ACTIVE SESSION LOBBY --- */}
                {activeSession && activeTab === 'games' && gamePhase === 'idle' && (
                    <div className="absolute inset-0 z-[950] bg-black/80 backdrop-blur-xl flex items-center justify-center p-4 md:p-8 pt-24 overflow-y-auto">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="max-w-5xl w-full h-[85vh] md:h-auto md:max-h-[85vh] md:aspect-video bg-[#0d111a] border border-white/10 rounded-[2rem] md:rounded-[3rem] flex flex-col md:flex-row shadow-[0_50px_100px_rgba(0,0,0,0.8)] overflow-hidden"
                        >
                            {/* Lobby Sidebar */}
                            <div className="w-full md:w-80 h-1/2 md:h-full border-b md:border-b-0 md:border-r border-white/5 p-6 md:p-10 bg-black/40 flex flex-col justify-between relative shrink-0">
                                <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-emerald-500/5 to-transparent pointer-events-none" />
                                <div className="relative z-10">
                                    <div className="flex items-center gap-3 mb-8">
                                        <div className="w-3 h-3 rounded-full bg-emerald-500 shadow-[0_0_15px_#10b981]" />
                                        <h2 className="text-white font-black text-3xl uppercase italic leading-none tracking-tight">Salon</h2>
                                    </div>

                                    {!isSoloMode && (
                                        <div className="mb-8">
                                            <span className="text-white/20 text-[9px] font-black uppercase tracking-[0.2em] block mb-3 pl-1">Invitation</span>
                                            <button
                                                onClick={() => {
                                                    const url = `${window.location.origin}${window.location.pathname}#mini-jeux`;
                                                    navigator.clipboard.writeText(url);
                                                    toast.success("Lien copié !");
                                                }}
                                                className="group flex items-center gap-3 px-5 py-4 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 hover:border-emerald-500/30 transition-all w-full"
                                            >
                                                <Copy size={14} className="text-emerald-500" />
                                                <span className="text-white/40 font-bold text-[10px] uppercase truncate">Copié le lien</span>
                                            </button>
                                        </div>
                                    )}

                                    <div className="space-y-6 flex-1 overflow-y-auto pr-2 custom-scrollbar">
                                        <div className="flex flex-wrap gap-2">
                                            <div className="px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-500 text-[10px] font-black uppercase italic">
                                                {isSoloMode ? "Mode Solo" : `${activeSession.participants?.filter((p: any) => !p.isSpectator).length || 0} / 8 Joueurs`}
                                            </div>
                                            <div className="px-4 py-2 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-indigo-500 text-[10px] font-black uppercase italic flex items-center gap-2">
                                                {(activeSession.gameMode === 'SPECIAL') ? 'Mode Spécial' : 'Mode Normal'}
                                                {(activeSession.gameMode === 'SPECIAL') && <Clock size={10} className="text-indigo-400" />}
                                            </div>
                                        </div>
                                        {activeSession.hostId === currentUserId && (
                                            <div className="space-y-6">
                                                <div className="pt-6 border-t border-white/5">
                                                    <span className="text-white/20 text-[9px] font-black uppercase tracking-[0.2em] block mb-4 pl-1">Rounds</span>
                                                    <div className="grid grid-cols-4 gap-2">
                                                        {[3, 5, 10, 20].map(r => (
                                                            <button
                                                                key={r}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    socket?.emit("geoguesser:room:settings", { maxRounds: r });
                                                                    setActiveSession({ ...activeSession, maxRounds: r });
                                                                }}
                                                                className={`py-2 rounded-xl text-[10px] font-black transition-all ${activeSession.maxRounds === r ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30' : 'bg-white/5 text-white/30 hover:bg-white/10'}`}
                                                            >
                                                                {r}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                                <div className="pt-6 border-t border-white/5">
                                                    <span className="text-white/20 text-[9px] font-black uppercase tracking-[0.2em] block mb-4 pl-1">Mode de Jeu</span>
                                                    <div className="grid grid-cols-2 gap-2">
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                const m = 'NORMAL';
                                                                socket?.emit("geoguesser:room:settings", { gameMode: m });
                                                                setActiveSession({ ...activeSession, gameMode: m });
                                                            }}
                                                            className={`py-3 rounded-xl text-[9px] font-black uppercase transition-all ${(!activeSession.gameMode || activeSession.gameMode === 'NORMAL') ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/30' : 'bg-white/5 text-white/30 hover:bg-white/10'}`}
                                                        >
                                                            Normal
                                                        </button>
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                const m = 'SPECIAL';
                                                                socket?.emit("geoguesser:room:settings", { gameMode: m });
                                                                setActiveSession({ ...activeSession, gameMode: m });
                                                            }}
                                                            className={`py-3 rounded-xl text-[9px] font-black uppercase transition-all ${activeSession.gameMode === 'SPECIAL' ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/30' : 'bg-white/5 text-white/30 hover:bg-white/10'}`}
                                                        >
                                                            Spécial
                                                        </button>
                                                    </div>
                                                    {activeSession.gameMode === 'SPECIAL' && (
                                                        <motion.p
                                                            initial={{ opacity: 0, x: -10 }}
                                                            animate={{ opacity: 1, x: 0 }}
                                                            className="mt-4 text-[8px] text-amber-400 font-black uppercase italic tracking-[0.2em] pl-1 flex items-center gap-2"
                                                        >
                                                            <Clock size={10} className="animate-bounce" />
                                                            Défi : 10 secondes par round
                                                        </motion.p>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <button
                                    onClick={handleLeaveSession}
                                    className="w-full py-5 mt-6 rounded-2xl bg-red-500/10 text-red-500 font-black uppercase text-[10px] italic hover:bg-red-500 hover:text-white transition-all border border-red-500/10 shadow-lg active:scale-95 flex-shrink-0 flex items-center justify-center gap-2"
                                >
                                    <LogOut size={14} />
                                    <span>{activeSession.hostId === currentUserId ? 'Dissoudre le Salon' : 'Quitter le Salon'}</span>
                                </button>
                            </div>

                            {/* Player List */}
                            <div className="flex-1 p-6 md:p-10 flex flex-col relative bg-[#0a0d14] h-1/2 md:h-full overflow-y-auto custom-scrollbar">
                                <div className="flex flex-col md:flex-row items-center justify-between mb-6 gap-4 sticky top-0 bg-[#0a0d14] z-20 pb-4 border-b border-white/5">
                                    <div className="flex flex-col">
                                        <h3 className="text-white/40 font-black uppercase text-[10px] tracking-[0.3em]">Participants connectés</h3>
                                        <div className="flex items-center gap-2 mt-1">
                                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                            <span className="text-emerald-500/60 text-[9px] font-black uppercase tracking-widest italic">
                                                {activeSession.participants?.filter((p: any) => !p.isSpectator).length || 0} / 8 Places occupées
                                            </span>
                                        </div>
                                    </div>
                                    {((activeSession.hostId === currentUserId) || isSoloMode) && (
                                        <button
                                            onClick={handleStartRoomGame}
                                            disabled={!isSoloMode && (activeSession.participants?.filter((p: any) => !p.isSpectator).length || 0) < 2}
                                            className={cn(
                                                "w-full md:w-auto px-8 md:px-12 py-3 md:py-4 rounded-xl md:rounded-2xl text-white font-black uppercase text-[10px] md:text-sm italic shadow-[0_15px_30px_-5px_rgba(16,185,129,0.5)] transition-all active:scale-95 flex items-center justify-center gap-3 border shrink-0",
                                                (!isSoloMode && (activeSession.participants?.filter((p: any) => !p.isSpectator).length || 0) < 2)
                                                    ? "bg-zinc-800 border-zinc-700 opacity-50 cursor-not-allowed grayscale"
                                                    : "bg-emerald-500 border-emerald-400 hover:-translate-y-1 hover:shadow-[0_25px_45px_-5px_rgba(16,185,129,0.6)]"
                                            )}
                                        >
                                            <Play size={16} fill="currentColor" className="shrink-0" />
                                            <span className="truncate">{(!isSoloMode && (activeSession.participants?.filter((p: any) => !p.isSpectator).length || 0) < 2) ? "Attente de joueurs" : "Lancer l'Épreuve"}</span>
                                        </button>
                                    )}
                                </div>

                                {/* Spectators Section */}
                                {activeSession.participants?.filter((p: any) => p.isSpectator && p.isConnected).length > 0 && (
                                    <div className="mb-8 flex items-center gap-4 bg-emerald-500/5 border border-emerald-500/20 p-4 rounded-3xl animate-in fade-in slide-in-from-top-2 duration-700">
                                        <div className="flex flex-col shrink-0 pr-4 border-r border-emerald-500/10">
                                            <span className="text-emerald-500 font-black uppercase text-[10px] tracking-widest mb-0.5 mt-0.5">
                                                En observation
                                            </span>
                                            <span className="text-emerald-500/40 text-[8px] font-bold uppercase italic whitespace-nowrap">
                                                {activeSession.participants?.filter((p: any) => p.isSpectator && p.isConnected).length} spectateur(s)
                                            </span>
                                        </div>
                                        <div className="flex items-center -space-x-3 overflow-hidden">
                                            {activeSession.participants?.filter((p: any) => p.isSpectator && p.isConnected).map((s: any) => (
                                                <div 
                                                    key={s.id} 
                                                    className="relative group shrink-0"
                                                    title={`${s.userName} regarde la partie`}
                                                >
                                                    <div className="w-10 h-10 rounded-2xl border-2 border-[#0a0d14] bg-slate-900 flex items-center justify-center overflow-hidden hover:scale-110 hover:-translate-y-1 transition-all z-10 hover:z-20 relative shadow-xl">
                                                        {s.userAvatar ? (
                                                            <img src={s.userAvatar} alt="" className="w-full h-full object-cover" />
                                                        ) : (
                                                            <span className="text-white/40 font-black text-[10px] uppercase italic">{s.userName?.[0] || 'S'}</span>
                                                        )}
                                                        <div className="absolute inset-0 bg-emerald-500/10" />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="flex-1 text-right">
                                            <span className="text-emerald-500/30 text-[9px] font-black uppercase italic tracking-tighter">Ils guettent vos faits et gestes...</span>
                                        </div>
                                    </div>
                                )}

                                <div className="flex-1 overflow-y-auto grid grid-cols-2 gap-4 auto-rows-max pr-4 custom-scrollbar">
                                    {activeSession.participants?.filter((p: any) => !p.isSpectator).map((p: any) => (
                                        <motion.div
                                            initial={{ opacity: 0, x: -10 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            key={p.id}
                                            className="p-6 rounded-[2.5rem] bg-white/[0.03] border border-white/5 flex items-center gap-5 hover:bg-white/[0.06] hover:border-emerald-500/30 transition-all group"
                                        >
                                            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 flex items-center justify-center border border-emerald-500/20 group-hover:scale-110 transition-transform overflow-hidden">
                                                {p.userAvatar ? (
                                                    <img src={p.userAvatar} alt="" className="w-full h-full object-cover" />
                                                ) : (
                                                    <span className="text-emerald-500 font-black text-lg italic">{p.userName?.[0]?.toUpperCase() || 'J'}</span>
                                                )}
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-white font-black text-sm uppercase italic tracking-tight">{p.userName}</span>
                                                {p.userId === activeSession.hostId && (
                                                    <span className="text-emerald-500 text-[9px] font-black uppercase tracking-widest mt-1 flex items-center gap-2">
                                                        <Crown size={10} /> Maitre du Salon
                                                    </span>
                                                )}
                                            </div>
                                        </motion.div>
                                    ))}

                                    {!isSoloMode && Array.from({ length: Math.max(0, 8 - (activeSession.participants?.filter((p: any) => !p.isSpectator).length || 0)) }).map((_, i) => (
                                        <div key={`empty-${i}`} className="p-6 rounded-[2.5rem] bg-white/[0.01] border border-dashed border-white/5 flex items-center gap-5 opacity-40">
                                            <div className="w-14 h-14 rounded-2xl border border-dashed border-white/10 flex items-center justify-center">
                                                <div className="w-2 h-2 rounded-full bg-white/5" />
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-white/20 font-black uppercase text-[10px] tracking-widest italic">Libre</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}

                {/* Countdown Overlay */}
                <AnimatePresence>
                    {gamePhase === 'countdown' && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 z-[2500] bg-black/80 backdrop-blur-3xl flex items-center justify-center"
                        >
                            <motion.div
                                key={timeLeft}
                                initial={{ scale: 0.5, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 1.5, opacity: 0 }}
                                transition={{ duration: 0.5, ease: "backOut" }}
                                className="flex flex-col items-center"
                            >
                                <span className="text-[180px] font-black italic text-emerald-500 drop-shadow-[0_0_50px_rgba(16,185,129,0.5)] leading-none">
                                    {timeLeft}
                                </span>
                                <span className="text-white/20 font-black uppercase tracking-[1em] text-xl mt-4 italic">
                                    Préparez-vous
                                </span>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Rules Modal */}
                <AnimatePresence>
                    {showRules && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setShowRules(false)}
                            className="fixed inset-0 z-[3000] bg-black/90 backdrop-blur-2xl flex items-center justify-center p-8"
                        >
                            <motion.div
                                initial={{ scale: 0.9, y: 30 }}
                                animate={{ scale: 1, y: 0 }}
                                exit={{ scale: 0.9, y: 30 }}
                                onClick={e => e.stopPropagation()}
                                className="max-w-xl w-full bg-[#0d111a] border border-white/10 rounded-[3rem] p-12 relative overflow-hidden"
                            >
                                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-[100px] pointer-events-none" />
                                <h2 className="text-white font-black text-4xl uppercase italic mb-8 tracking-tighter">Règles du SigilGuesser</h2>
                                <div className="space-y-6">
                                    {[
                                        { t: "Objectif", d: "Trouvez l'emplacement exact de l'image affichée sur la carte." },
                                        { t: "Précision", d: "Plus vous êtes proche du point d'origine, plus vous gagnez de points (max 1000)." },
                                        { t: "Temps", d: "Vous avez un temps limité par round pour valider votre position." },
                                        { t: "Multi-Mondes", d: "Attention ! La cible peut être sur Incarnam, Pandala ou d'autres mondes." }
                                    ].map((rule, i) => (
                                        <div key={i} className="flex gap-5">
                                            <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400 font-black italic shrink-0">
                                                {i + 1}
                                            </div>
                                            <div>
                                                <h4 className="text-white font-black text-xs uppercase italic mb-1">{rule.t}</h4>
                                                <p className="text-white/40 text-[11px] font-medium leading-relaxed">{rule.d}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <button
                                    onClick={() => setShowRules(false)}
                                    className="mt-12 w-full py-5 rounded-2xl bg-white/5 text-white/40 font-black uppercase text-xs italic hover:bg-white/10 hover:text-white transition-all border border-white/5"
                                >
                                    J'ai compris
                                </button>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Dungeon Detail Modal */}
                {selectedDungeon && (
                    <DungeonDetailModal
                        isOpen={!!selectedDungeon}
                        onClose={() => setSelectedDungeon(null)}
                        dungeons={selectedDungeon}
                        guildId={guildId}
                    />
                )}
                {/* Perfect Guess Celebration Overlay */}
                <AnimatePresence>
                    {showPerfectCelebration && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 z-[2000] pointer-events-none flex items-center justify-center overflow-hidden"
                        >
                            {/* Particles/Confetti */}
                            {[...Array(20)].map((_, i) => (
                                <motion.div
                                    key={i}
                                    initial={{ 
                                        x: 0, 
                                        y: 0, 
                                        opacity: 1, 
                                        scale: 0 
                                    }}
                                    animate={{ 
                                        x: (Math.random() - 0.5) * 1200, 
                                        y: (Math.random() - 0.5) * 1200, 
                                        opacity: 0, 
                                        scale: Math.random() * 2 + 1,
                                        rotate: Math.random() * 360
                                    }}
                                    transition={{ duration: 3, ease: "easeOut" }}
                                    className="absolute w-4 h-4 rounded-sm bg-emerald-500 shadow-[0_0_25px_#10b981]"
                                />
                            ))}

                            <motion.div
                                initial={{ scale: 0, rotate: -20, y: 150 }}
                                animate={{ 
                                    scale: [0, 1.25, 1], 
                                    rotate: [20, -5, 0],
                                    y: 0
                                }}
                                exit={{ scale: 0, opacity: 0, y: 100 }}
                                className="bg-[#0d111a]/95 backdrop-blur-3xl border-4 border-emerald-500/50 rounded-[4rem] px-24 py-20 flex flex-col items-center gap-10 shadow-[0_60px_120px_rgba(16,185,129,0.4)] relative"
                            >
                                <motion.div 
                                    animate={{ 
                                        scale: [1, 1.15, 1],
                                        rotate: [0, 8, -8, 0]
                                    }}
                                    transition={{ repeat: Infinity, duration: 1.8, ease: "easeInOut" }}
                                    className="w-40 h-40 rounded-full bg-emerald-500 flex items-center justify-center text-black shadow-[0_0_80px_#10b981]"
                                >
                                    <Sparkles size={80} />
                                </motion.div>
                                
                                <div className="text-center">
                                    <h1 className="text-7xl font-black text-white uppercase italic tracking-tighter mb-3 drop-shadow-[0_10px_10px_rgba(0,0,0,1)]">
                                        MAP EXACTE !
                                    </h1>
                                    <p className="text-emerald-400 font-black text-2xl uppercase tracking-[0.3em] animate-pulse">
                                        +250 PTS BONUS
                                    </p>
                                </div>

                                <motion.div
                                    animate={{ y: [0, -12, 0] }}
                                    transition={{ repeat: Infinity, duration: 1.5 }}
                                    className="flex items-center gap-4 bg-white/5 border border-white/10 px-8 py-4 rounded-full shadow-2xl"
                                >
                                    <Trophy className="text-amber-500" size={32} />
                                    <span className="text-white font-black text-2xl italic tracking-tight">LE GÉNIE D'AMAKNA</span>
                                </motion.div>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}

const Sparkles = ({ size }: { size: number }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/><path d="M5 3v4"/><path d="M19 17v4"/><path d="M3 5h4"/><path d="M17 19h4"/></svg>
);

