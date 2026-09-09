'use client';
// dark-locked — module volontairement sombre (V2 Dual-Theme Phase 2C) : ne PAS utiliser les tokens thème-aware ici (voir memo 21/08 + prompt 22/08).

import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import dynamic from 'next/dynamic';
import {
    Search, Map as MapIcon, Loader2, Target, Eye, EyeOff, Trophy,
    Clock, ZoomIn, Compass, ChevronDown, ChevronRight, Plus, Minus, Users, Trash2, X, CheckCircle2, Copy,
    Crown, Play, Palette, Smartphone, HelpCircle, LogOut, RotateCcw, Flag, Rocket, Bomb, Lock, Shield, Mic, Zap, MapPin
} from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { WorldData, MapNode, SubArea, Dungeon } from '@/types/worldmap';
import { submitGeoguesserScore, getGeoguesserLadder } from '@/server/actions/geoguesser-actions';
import { getBombLadder } from '@/server/actions/bomb-actions';
import { searchArchimonstresForMap, getArchimonstresByFilter, type MapSearchFilter } from '@/server/actions/game-data-actions';
import { getOcreDungeonMapIds } from '@/server/actions/ocre-map-actions';
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
        <div className="w-full h-full bg-background flex items-center justify-center">
            <div className="flex flex-col items-center gap-4">
                <div className="w-12 h-12 border-4 border-success/20 border-t-success rounded-full animate-spin" />
                <p className="text-success/50 font-black text-xs uppercase tracking-widest italic">Chargement du Monde...</p>
            </div>
        </div>
    )
});

const GeoguesserHUD = dynamic<any>(() => import('./GeoguesserHUD'), { ssr: false });
const MapDetailsPanel = dynamic<any>(() => import('./MapDetailsPanel'), { ssr: false });
const DungeonDetailModal = dynamic<any>(() => import('./DungeonDetailModal').then(mod => mod.DungeonDetailModal), { ssr: false });
const ZoneDetailModal = dynamic<any>(() => import('./ZoneDetailModal').then(mod => mod.ZoneDetailModal), { ssr: false });
const MapHelpCard = dynamic<any>(() => import('./MapHelpCard').then(mod => mod.MapHelpCard), { ssr: false });
const HarvestOptiFarmPanel = dynamic<any>(() => import('./harvest-opti-farm-panel').then(mod => mod.HarvestOptiFarmPanel), { ssr: false });
const HarvestGpsController = dynamic<any>(() => import('./harvest-gps-controller').then(mod => mod.HarvestGpsController), { ssr: false });

interface InteractiveMapProps {
    worldMap: WorldData;
    initialLadder?: any[];
    initialTab?: 'map' | 'games';
    gameStatuses?: any[];
    initialX?: number;
    initialY?: number;
    initialZoom?: number;
    initialWorldId?: number;
    hideUI?: boolean;
    userName?: string;
    userAvatar?: string;
    isAdmin?: boolean;
    interactive?: boolean;
    /** Affiche le bouton "Choix du Jeu" (navigation vers /mini-jeux) dans le header de la carte. */
    showGameEntry?: boolean;
    /** Active le plein écran à l'arrivée (module carte ouvert via le bouton "Ouvrir en plein écran"). */
    startFullscreen?: boolean;
}

// Retourne l'élément plein écran actif (worldmap, mini-jeux ou bomb)
function getFullscreenEl(): HTMLElement | null {
    return document.getElementById('worldmap-page')
        || document.getElementById('mini-games-page')
        || document.getElementById('sigil-bomb-page');
}

// Force le plein écran du guesser quand une partie est active (monté directement dans le rendu du jeu)
function ForceFullscreen() {
    useEffect(() => {
        const el = getFullscreenEl();
        if (el) {
            el.style.position = 'fixed';
            el.style.inset = '0';
            el.style.width = '100vw';
            el.style.height = '100vh';
            el.style.margin = '0';
            el.style.border = 'none';
            el.style.borderRadius = '0';
            el.style.padding = '0';
            el.style.zIndex = '9999';
            el.classList.add('worldmap-fullscreen');
        }
        document.body.classList.add('map-fullscreen');
    }, []);
    return null;
}

export default function InteractiveMapV2({ 
    worldMap, 
    initialLadder, 
    initialTab, 
    gameStatuses,
    initialX,
    initialY,
    initialZoom,
    initialWorldId,
    hideUI,
    userName,
    userAvatar,
    isAdmin,
    interactive,
    showGameEntry = false,
    startFullscreen = false
}: InteractiveMapProps) {
    const { data: sessionData } = useSession();
    const router = useRouter();
    const currentUserId = sessionData?.user?.id;
    const [selectedWorldId, setSelectedWorldId] = useState(initialWorldId || 1);
    const [activeTab, setActiveTab] = useState<'map' | 'games'>(initialTab || 'map');
    const searchParams = useSearchParams();
    const spectateRoomId = searchParams.get('spectateRoom');
    const autoJoinAttempted = useRef(false);

    // UI States
    const [search, setSearch] = useState('');
    const [showDebugGrid, setShowDebugGrid] = useState(false);
    const [zoneHighlight, setZoneHighlight] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [selectedPosition, setSelectedPosition] = useState<any>(null);
    const [selectedDungeon, setSelectedDungeon] = useState<Dungeon[] | null>(null);
    const [triggerCenterPosition, setTriggerCenterPosition] = useState<{ x: number, y: number } | null>(
        initialX !== undefined && initialY !== undefined ? { x: initialX, y: initialY } : null
    );
    const [isMinimapExpanded, setIsMinimapExpanded] = useState(false);
    const [isMinimapHidden, setIsMinimapHidden] = useState(false);
    const [joiningId, setJoiningId] = useState<string | null>(null);
    const [isCreating, setIsCreating] = useState(false);
    const [minimapRecenterTrigger, setMinimapRecenterTrigger] = useState(0);
    const [showZoneDetail, setShowZoneDetail] = useState(false);
    const [showMapHelp, setShowMapHelp] = useState(false);
    const [autoCopyTravel, setAutoCopyTravel] = useState(false);
    const [activePanelTab, setActivePanelTab] = useState<'map' | 'scores'>('map');
    // Dropdown cliquable du sélecteur de monde (évite le débordement hover + UX claire)
    const [worldDropdownOpen, setWorldDropdownOpen] = useState(false);
    const worldDropdownBtnRef = useRef<HTMLButtonElement>(null);
    const [worldDropdownPos, setWorldDropdownPos] = useState<{ top: number; left: number } | null>(null);

    // Archimonstre search state
    const [archiResults, setArchiResults] = useState<any[]>([]);
    const [isSearchingArchi, setIsSearchingArchi] = useState(false);
    const [highlightSubareaIds, setHighlightSubareaIds] = useState<number[]>([]);
    const [searchFilter, setSearchFilter] = useState<MapSearchFilter>('all');
    // Pré-chargement : résultats affichés quand on clique un filtre sans texte (ex: 🟡 Ocre)
    const [preloadedFilterResults, setPreloadedFilterResults] = useState<any[]>([]);
    const [pendingFilter, setPendingFilter] = useState<MapSearchFilter | null>(null);
    const [isLoadingFilter, setIsLoadingFilter] = useState(false);

    // Charger les résultats du filtre quand on clique une chip SANS texte de recherche
    const loadFilterResults = useCallback(async (f: MapSearchFilter) => {
        if (!search || search.trim().length < 2) {
            setIsLoadingFilter(true);
            try {
                const res = await getArchimonstresByFilter(f);
                setPreloadedFilterResults(res.success ? (res.data || []) : []);
            } catch {
                setPreloadedFilterResults([]);
            } finally {
                setIsLoadingFilter(false);
            }
        }
    }, [search]);

    // Ocre quest dungeons (donjons marqués "Quête Ocre" → icône Dofus Ocre sur la carte)
    const [ocreMapIds, setOcreMapIds] = useState<Set<number>>(new Set());

    // Harvest & Zaaps states
    const [harvestJobs, setHarvestJobs] = useState<any[]>([]);
    const [zaaps, setZaaps] = useState<any[]>([]);
    const [showHarvestPanel, setShowHarvestPanel] = useState(false);
    const [showZaaps, setShowZaaps] = useState(true);
    const [selectedHarvestJobId, setSelectedHarvestJobId] = useState<number>(2); // Bûcheron
    const [selectedHarvestResourceIds, setSelectedHarvestResourceIds] = useState<Set<number>>(new Set());
    const [activeCircuit, setActiveCircuit] = useState<any | null>(null);

    // Load Ocre dungeon mapIds once
    useEffect(() => {
        let cancelled = false;
        getOcreDungeonMapIds().then(ids => {
            if (!cancelled) setOcreMapIds(new Set(ids));
        }).catch(() => {});
        return () => { cancelled = true; };
    }, []);

    // Load harvest resources and zaaps data once
    useEffect(() => {
        let cancelled = false;
        async function loadHarvestData() {
            try {
                const [hRes, zRes] = await Promise.all([
                    fetch('/game-data/harvest-resources.json'),
                    fetch('/game-data/zaaps.json')
                ]);
                if (cancelled) return;
                if (hRes.ok) {
                    const hData = await hRes.json();
                    setHarvestJobs(hData);
                }
                if (zRes.ok) {
                    const zData = await zRes.json();
                    setZaaps(zData);
                }
            } catch (err) {
                console.error("Erreur chargement harvest-resources / zaaps:", err);
            }
        }
        loadHarvestData();
        return () => { cancelled = true; };
    }, []);

    const selectedHarvestResources = useMemo(() => {
        const currentJob = harvestJobs.find((j: any) => j.id === selectedHarvestJobId);
        if (!currentJob) return [];
        return currentJob.resources.filter((r: any) => selectedHarvestResourceIds.has(r.id));
    }, [harvestJobs, selectedHarvestJobId, selectedHarvestResourceIds]);

    const handleToggleHarvestResource = useCallback((resId: number) => {
        setSelectedHarvestResourceIds(prev => {
            const next = new Set(prev);
            if (next.has(resId)) {
                next.delete(resId);
            } else {
                next.add(resId);
            }
            return next;
        });
    }, []);

    const handleSelectAllHarvestUpToLevel = useCallback((level: number) => {
        const currentJob = harvestJobs.find((j: any) => j.id === selectedHarvestJobId);
        if (!currentJob) return;
        const upToLevel = currentJob.resources.filter((r: any) => r.level <= level).map((r: any) => r.id);
        setSelectedHarvestResourceIds(new Set(upToLevel));
    }, [harvestJobs, selectedHarvestJobId]);

    const [completedHarvestSteps, setCompletedHarvestSteps] = useState<Set<number>>(new Set());

    const handleClearHarvestResources = useCallback(() => {
        setSelectedHarvestResourceIds(new Set());
        setActiveCircuit(null);
        setCompletedHarvestSteps(new Set());
    }, []);

    const handleSelectCircuit = useCallback((circuit: any) => {
        setActiveCircuit(circuit);
        setCompletedHarvestSteps(new Set());
        if (circuit && circuit.worldId && circuit.worldId !== selectedWorldId) {
            setSelectedWorldId(circuit.worldId);
        }
    }, [selectedWorldId]);

    const handleToggleHarvestStep = useCallback((stepIdx: number) => {
        setCompletedHarvestSteps(prev => {
            const next = new Set(prev);
            if (next.has(stepIdx)) {
                next.delete(stepIdx);
            } else {
                next.add(stepIdx);
            }
            return next;
        });
    }, []);

    // Mini-Jeux States
    const [gamePhase, setGamePhase] = useState<'idle' | 'countdown' | 'playing' | 'result' | 'summary'>('idle');
    const [activeSession, setActiveSession] = useState<any>(null);
    const [availableSessions, setAvailableSessions] = useState<any[]>([]);

    const [bombRooms, setBombRooms] = useState<any[]>([]);
    const [guessResult, setGuessResult] = useState<any>(null);
    const [timeLeft, setTimeLeft] = useState(30);
    const [score, setScore] = useState(0);
    const [zoomPhase, setZoomPhase] = useState(0);
    const [isSoloMode, setIsSoloMode] = useState(false);
    const [showRules, setShowRules] = useState(false);
    const [isLeavingSession, setIsLeavingSession] = useState(false);
    const [showPerfectCelebration, setShowPerfectCelebration] = useState(false);
    const [showHDMap, setShowHDMap] = useState(true);
    const [playerLeftNotice, setPlayerLeftNotice] = useState<string | null>(null);


    // Leaderboard States
    const [ladder, setLadder] = useState<any[]>(initialLadder || []);
    const [ladderType, setLadderType] = useState<'all_time' | 'month'>('all_time');
    const [ladderGame, setLadderGame] = useState<'guesser' | 'bomb'>('guesser');
    const [isLoadingLadder, setIsLoadingLadder] = useState(false);
    const [gamesSubTab, setGamesSubTab] = useState<'arena' | 'ladder'>('arena');

    const guildId = typeof window !== 'undefined' ? window.location.pathname.split('/')[2] : '';

    const [socket, setSocket] = useState<Socket | null>(null);
    const reportedMapsRef = useRef<Set<number>>(new Set());

    
    // Auto-sync state if initial props change (essential for embedded usage like Dungeon Finder)
    useEffect(() => {
        if (initialWorldId !== undefined) setSelectedWorldId(initialWorldId);
        if (initialX !== undefined && initialY !== undefined) {
            setTriggerCenterPosition({ x: initialX, y: initialY });
        }
    }, [initialWorldId, initialX, initialY]);

    // Positionne le dropdown au-dessus de la navbar via portal (fixed + z très élevé).
    // Se déclenche quand on ouvre. On ferme UNIQUEMENT au resize (et au clic extérieur via l'overlay)
    // — PAS au scroll global (sinon la molette scrollerait dans le panel fermerait le dropdown).
    useEffect(() => {
        if (!worldDropdownOpen) return;
        const update = () => {
            const rect = worldDropdownBtnRef.current?.getBoundingClientRect();
            if (rect) setWorldDropdownPos({ top: rect.bottom + 8, left: rect.right - 240 });
        };
        update();
        const onResize = () => setWorldDropdownOpen(false);
        window.addEventListener('resize', onResize);
        return () => {
            window.removeEventListener('resize', onResize);
        };
    }, [worldDropdownOpen]);

    // ── Debounced archimonstre search (transmet le filtre actif au serveur) ──
    useEffect(() => {
        if (!search || search.trim().length < 2) {
            setArchiResults([]);
            // Note: highlightSubareaIds has its own 8s timer — don't clear it here
            return;
        }
        const timer = setTimeout(async () => {
            setIsSearchingArchi(true);
            try {
                const res = await searchArchimonstresForMap(search.trim(), searchFilter);
                if (res.success && res.data) {
                    setArchiResults(res.data);
                } else {
                    setArchiResults([]);
                }
            } catch {
                setArchiResults([]);
            } finally {
                setIsSearchingArchi(false);
            }
        }, 300);
        return () => clearTimeout(timer);
    }, [search, searchFilter]);

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
        const dungeonMapIds = new Set(worldMap.dungeons?.map(d => d.mapId || d.entranceMapId).filter(Boolean) || []);
        return worldMap.maps.filter(m => {
            const isTargetWorld = m.worldMap === selectedWorldId;
            const isDungeon = dungeonMapIds.has(m.id);
            const isEntryToDungeonFromMain = (selectedWorldId === 1 && m.worldMap === -1 && isDungeon);

            if (isTargetWorld || isEntryToDungeonFromMain) {
                if (selectedWorldId === 1 && m.outdoor === false && !isDungeon) {
                    return false;
                }
                return true;
            }
            return false;
        });
    }, [worldMap.maps, selectedWorldId, worldMap.dungeons]);

    const visibleWorlds = useMemo(() => {
        // Filtre les mondes ayant des maps ; si le filtre ne renvoie rien (ex: données chargées
        // partiellement ou monde sans maps), on retombe sur TOUS les mondes pour ne jamais vider le dropdown.
        const withMaps = worldMap.worlds?.filter(w => worldMap.maps?.some(m => m.worldMap === w.id)) || [];
        return withMaps.length > 0 ? withMaps : (worldMap.worlds || []);
    }, [worldMap.worlds, worldMap.maps]);

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

        // Archimonstre result
        if (item.isArchi) {
            // Résout le monde cible : refuse les mondes invalides (<=0) pour éviter `w-1` (map vide).
            let targetWorld = Number(item.worldMapId);
            if (!targetWorld || targetWorld <= 0) {
                const m = item.centerX !== null && item.centerY !== null
                    ? worldMap.maps?.find(mm => mm.x === item.centerX && mm.y === item.centerY)
                    : undefined;
                targetWorld = m && m.worldMap > 0 ? m.worldMap : (selectedWorldId || 1);
            }
            const needsWorldChange = targetWorld > 0 && targetWorld !== selectedWorldId;

            const applyHighlight = () => {
                if (item.centerX !== null && item.centerY !== null) {
                    setTriggerCenterPosition({ x: item.centerX, y: item.centerY });
                }
                if (item.subAreaIds?.length > 0) {
                    setHighlightSubareaIds(item.subAreaIds);
                    setTimeout(() => setHighlightSubareaIds([]), 8000);
                }
            };

            if (needsWorldChange) {
                setSelectedWorldId(targetWorld);
                // Wait for Leaflet canvas to remount before applying highlight
                setTimeout(applyHighlight, 650);
            } else {
                applyHighlight();
            }

            setSearch('');
            setArchiResults([]);
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
    }, [worldMap.maps, selectedWorldId]);

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

            // Masquer les "60 dj expéditions" (et autres expéditions) de la WorldMap
            const name = typeof d.name === 'string' ? d.name : (d.name?.fr || '');
            if (name.toLowerCase().includes('expédition')) return;

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
            if (mapNode) results.push({ mapId, dungeons, mapNode, isOcreQuest: ocreMapIds.has(mapId) });
        });
        return results;
    }, [activeMaps.length, mapsById, dungeonsByMapId, ocreMapIds]);

    // NEW: Comprehensive index of ALL maps at a coordinate (for layer switching)
    const allLayersByCoords = useMemo(() => {
        const index = new Map<string, MapNode[]>();
        worldMap.maps?.forEach(m => {
            const isRelevant = m.worldMap === selectedWorldId || (selectedWorldId === 1 && m.worldMap === -1);
            if (isRelevant) {
                const key = `${m.x},${m.y}`;
                if (!index.has(key)) index.set(key, []);
                index.get(key)!.push(m);
            }
        });
        return index;
    }, [worldMap.maps, selectedWorldId]);

    const allWorldMapsByCoords = useMemo(() => {
        const index = new Map<string, MapNode>();
        allLayersByCoords.forEach((layers, key) => {
            // Priority Sort:
            // 1. Altitude 0 (Ground)
            // 2. Outdoor = true
            // 3. WorldMap matching (not -1)
            // 4. Lowest ID
            const sorted = [...layers].sort((a, b) => {
                // Ground level (altitude 0) always first
                if (a.altitude === 0 && b.altitude !== 0) return -1;
                if (b.altitude === 0 && a.altitude !== 0) return 1;
                
                // Outdoor maps second
                if (a.outdoor && !b.outdoor) return -1;
                if (b.outdoor && !a.outdoor) return 1;
                
                // Pure world match
                if (a.worldMap === selectedWorldId && b.worldMap !== selectedWorldId) return -1;
                if (b.worldMap === selectedWorldId && a.worldMap !== selectedWorldId) return 1;
                
                return a.id - b.id;
            });
            index.set(key, sorted[0]);
        });
        return index;
    }, [allLayersByCoords, selectedWorldId]);

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
                : await getBombLadder(guildId, ladderType);
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

    // Plein écran automatique pendant les parties (Sigil Guesser & Bomb)
    const applyFullscreen = useCallback((fs: boolean) => {
        setIsFullscreen(fs);
        const el = getFullscreenEl();
        if (el) {
            el.classList.toggle('worldmap-fullscreen', fs);
            // Force inline (plus robuste que le CSS) : plein écran total sans bords
            el.style.position = fs ? 'fixed' : '';
            el.style.top = fs ? '0px' : '';
            el.style.left = fs ? '0px' : '';
            el.style.right = fs ? '0px' : '';
            el.style.bottom = fs ? '0px' : '';
            el.style.width = fs ? '100vw' : '';
            el.style.height = fs ? '100vh' : '';
            el.style.margin = fs ? '0px' : '';
            el.style.borderRadius = fs ? '0px' : '';
            el.style.border = fs ? 'none' : '';
            el.style.padding = fs ? '0px' : '';
            el.style.zIndex = fs ? '9999' : '';
        }
        document.body.classList.toggle('map-fullscreen', fs);
    }, []);

    useEffect(() => {
        // Plein écran à l'arrivée pour le module carte (prop startFullscreen, ouvert via le
        // bouton "Ouvrir la carte en plein écran" depuis la page d'accueil de la carte).
        // Sans ce prop, et pour les mini-cartes (hideUI), on reste en plein écran uniquement
        // pendant une partie.
        const startFs = !!startFullscreen && !hideUI;
        const inGame = gamePhase !== 'idle';
        applyFullscreen(startFs || inGame);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [gamePhase, hideUI, startFullscreen, applyFullscreen]);

    // Secours : vérifie périodiquement et force le plein écran tant qu'une partie est active
    useEffect(() => {
        const interval = setInterval(() => {
            if (gamePhase !== 'idle') applyFullscreen(true); // force seulement pendant la partie
        }, 600);
        return () => clearInterval(interval);
    }, [gamePhase, applyFullscreen]);

    // Nettoyage du plein écran à la sortie de la page (retour accueil carte / dashboard = normal).
    // On réinitialise aussi les styles inline posés par applyFullscreen (position:fixed,
    // width:100vw, z-index:9999, inset...) sinon la carte reste en overlay et casse l'accueil
    // après fermeture (vue « par-dessus la navbar »).
    useEffect(() => {
        return () => {
            setIsFullscreen(false);
            ['worldmap-page', 'mini-games-page', 'sigil-bomb-page'].forEach((id) => {
                const el = document.getElementById(id);
                if (el) {
                    el.classList.remove('worldmap-fullscreen');
                    ['position', 'top', 'left', 'right', 'bottom', 'width', 'height', 'margin', 'borderRadius', 'border', 'padding', 'zIndex', 'inset'].forEach((prop) => {
                        (el.style as any)[prop] = '';
                    });
                }
            });
            document.body.classList.remove('map-fullscreen');
        };
    }, []);

    useEffect(() => {
        // Initial fetch
        fetchLobbies();
        
        // Poll every 10s
        const interval = setInterval(() => {
            fetchLobbies();
        }, 10000);
        
        return () => clearInterval(interval);
    }, [fetchLobbies]);

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
            withCredentials: true,
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
                    pseudo: userName || sessionData?.user?.name || "Joueur",
                    avatarUrl: userAvatar || sessionData?.user?.image,
                    maxRounds: currentSession.maxRounds,
                    timePerRound: currentSession.timePerRound
                });
            }
            newSocket.emit("geoguesser:room:list");
            newSocket.emit("bomb:room:list");
        });

        newSocket.on("geoguesser:room:list", (rooms) => setAvailableSessions(rooms || []));

        newSocket.on("bomb:room:list", (rooms) => setBombRooms(rooms || []));

        newSocket.on("geoguesser:player:joined", (data: any) => {
            if (data.userId !== currentUserId) {
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

            const me = state.participants?.find((p: any) => p.userId === currentUserIdRef.current);

            // Host migration notification
            if (activeSession && state.hostId !== activeSession.hostId) {
                // Use local variable currentUserId from state
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

            // setActiveSession(state); // Move this after drift check or optimize it
            const serverTime = state.timeLeft ?? 0;
            const stateRef = activeSessionRef.current;
            
            // Only update session if important data changed (avoiding flickering from timeLeft)
            const importantDataChanged = 
                !stateRef || 
                state.state !== stateRef.state || 
                state.currentRound !== stateRef.currentRound || 
                state.hostId !== stateRef.hostId ||
                JSON.stringify(state.participants?.map((p: any) => ({ userId: p.userId, hasGuessed: p.hasGuessed, score: p.score }))) !== 
                JSON.stringify(stateRef.participants?.map((p: any) => ({ userId: p.userId, hasGuessed: p.hasGuessed, score: p.score })));

            if (importantDataChanged) {
                setActiveSession(state);
            }
            
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

            // Sync total score state for HUD and Summary
            if (me) {
                setScore(me.score || 0);
            }

            // 2. Sync results ALWAYS if in RESULT or FINISHED, 
            // OR if we already have a guess synced on server but we are locally in 'playing' (recovery)
            if ((state.state === 'RESULT' || state.state === 'FINISHED' || (me?.hasGuessed && gamePhase === 'playing')) && (state.currentMapId || state.targetMapIds) && state.currentRound > 0) {
                const targetId = state.currentMapId || (state.targetMapIds && state.targetMapIds[state.currentRound - 1]);
                const tMap = allMapsById.get(targetId);
                if (tMap) {
                    const newResult = {
                        target: { x: tMap.x, y: tMap.y, worldMap: tMap.worldMap, mapId: targetId },
                        guess: (me?.lastGuess && !me.lastGuess.hidden) ? { ...me.lastGuess, x: me.lastGuess.x, y: me.lastGuess.y, worldId: me.lastGuess.worldId, mapId: me.lastGuess.mapId } : null,
                        distance: me?.lastGuess?.distance || 0,
                        score: me?.lastGuess?.score || 0
                    };
                    
                    // Memoize guessResult to avoid canvas flicker
                    setGuessResult((prev: any) => {
                        if (JSON.stringify(prev) === JSON.stringify(newResult)) return prev;
                        return newResult;
                    });

                    // --- CELEBRATION TRIGGER ---
                    if (me && me.hasGuessed && !me.isSpectator && newResult.distance === 0 && (newState === 'RESULT' || newState === 'FINISHED')) {
                        // Check if we already celebrated this round
                        const celebratedRounds = (window as any)._geoSigilCelebratedRounds || new Set();
                        const roundKey = `${activeSession?.id}-${state.currentRound}`;
                        if (!celebratedRounds.has(roundKey)) {
                            setShowPerfectCelebration(true);
                            celebratedRounds.add(roundKey);
                            (window as any)._geoSigilCelebratedRounds = celebratedRounds;
                            playSoundEffect('success');
                            setTimeout(() => setShowPerfectCelebration(false), 2000);
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
                // #126 : en partie à 2 joueurs, si l'un part en pleine partie → gros popup rassurant
                // (la map en cours continue, les rounds suivants partent quand même).
                const sess = activeSessionRef.current;
                const stateNow = sess?.state as string | undefined;
                if (stateNow === 'IN_PROGRESS' || stateNow === 'RESULT') {
                    const activeCount = (sess?.participants?.filter((p: any) => !p.isSpectator && p.isConnected !== false) || []).length;
                    if (activeCount === 2) setPlayerLeftNotice(data.userName);
                }
            }
        });

        setSocket(newSocket);

        const fbInterval = setInterval(() => {
            fetchLobbiesRef.current();
            if (newSocket.connected) {
                newSocket.emit("geoguesser:room:list");
            }
        }, 5000);

        return () => {
            newSocket.disconnect();
            clearInterval(fbInterval);
        };
    }, [activeTab, guildId]);

    // Game Sounds & Phase Effects (Synchronisé sur le compte à rebours 3... 2... 1... GO!)
    const prevCountdownTimeRef = useRef<number>(-1);
    useEffect(() => {
        if (gamePhase === 'countdown') {
            if (timeLeft > 0 && timeLeft !== prevCountdownTimeRef.current) {
                prevCountdownTimeRef.current = timeLeft;
                playSoundEffect('count');
            }
        } else if (gamePhase === 'playing') {
            if (prevCountdownTimeRef.current !== -1) {
                prevCountdownTimeRef.current = -1;
                playSoundEffect('ding');
            }
        }
    }, [gamePhase, timeLeft]);

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
        if (!socket) return;
        setIsSoloMode(false);
        if (!isSpectator && room.participants?.length >= 8) {
            toast.error("Salon complet (8 joueurs max)");
            return;
        }
        setJoiningId(room.id);
        const res = await joinGeoguesserSession(room.id, isSpectator);
        if (res.success) {
            setActiveSession({ ...room, isSpectator, state: room.state || 'LOBBY' });
            toast.success(isSpectator ? "Mode Spectateur activé !" : "Salon rejoint !");
            socket?.emit("geoguesser:room:join", {
                roomId: room.id,
                guildId,
                userId: currentUserId,
                pseudo: userName || sessionData?.user?.name || "Joueur",
                avatarUrl: userAvatar || sessionData?.user?.image,
                maxRounds: room.maxRounds,
                timePerRound: room.timePerRound,
                isSpectator: isSpectator
            });
            setJoiningId(null);
            setGamePhase('idle');
            setActiveTab('games');
        } else {
            toast.error(res.error || "Erreur");
            setJoiningId(null);
        }
    };

    const handleNextRound = () => {
        if (!socket || gamePhase !== 'result') return;
        playSoundEffect('tick');
        socket.emit("geoguesser:game:next-round");
    };

    const handleCreateRoom = async () => {
        if (!guildId || !socket) return;
        setIsSoloMode(false);
        setIsCreating(true);
        const res = await createGeoguesserSession(guildId);
        if (res.success && res.data) {
            setActiveSession(res.data);
            setGamePhase('idle');
            toast.success("Salon créé !");
            socket?.emit("geoguesser:room:join", {
                roomId: res.data.id,
                guildId,
                userId: currentUserId,
                pseudo: userName || sessionData?.user?.name || "Hôte",
                avatarUrl: userAvatar || sessionData?.user?.image,
                maxRounds: res.data.maxRounds,
                timePerRound: res.data.timePerRound
            });
            setActiveTab('games');
        } else {
            toast.error(res.error || "Erreur lors de la création.");
        }
        setIsCreating(false);
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
                pseudo: userName || sessionData?.user?.name || "Solo Explorer",
                avatarUrl: userAvatar || sessionData?.user?.image,
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

    const handleReportMap = useCallback(() => {
        if (!socket || !activeSession) {
            toast.error("Impossible de signaler la carte pour le moment.");
            return;
        }
        
        const cRound = activeSession.currentRound || 1;
        const mapId = activeSession.currentMapId || (activeSession.targetMapIds && activeSession.targetMapIds[cRound - 1]);
        
        if (!mapId) {
            toast.error("Données de la carte introuvables.");
            return;
        }

        socket.emit("geoguesser:map:report", { mapId });
        toast.info(`Signalement envoyé pour la carte #${mapId} ! Les administrateurs l'examineront.`);
    }, [socket, activeSession]);

    const handleMapClick = async (pos: any) => {
        const me = activeSession?.participants?.find((p: any) => p.userId === currentUserId);
        const isSpectator = activeSession?.isSpectator || me?.isSpectator;
        if (isSpectator && activeTab === 'games') return;

        if (activeTab === 'games' && gamePhase === 'playing' && targetMapId) {
            // SECURITY: Prevent moving the marker if already guessed
            if (me?.hasGuessed) return;
            setSelectedPosition(pos);
        } else if (activeTab === 'map' && !hideUI) {
            setSelectedPosition(pos);
        }
    };

    const handleSubmitGuess = async () => {
        if (!selectedPosition) return;
        setIsMinimapExpanded(false);

        if (socket) {
            socket.emit('geoguesser:guess:submit', {
                x: selectedPosition.x,
                y: selectedPosition.y,
                worldId: selectedWorldId,
                round: activeSession?.currentRound || 1,
                mapId: selectedPosition.mapId
            });
            const isSolo = isSoloMode || (activeSession?.participants?.filter((p: any) => !p.isSpectator).length || 1) <= 1;
            toast.success(isSolo ? "Position validée !" : "Position validée ! En attente des autres joueurs...", { icon: "📍" });
        }
    };

    const handleStartRoomGame = async () => {
        if (!activeSession || !currentUserId || !socket) return;

        // Seul l'hôte effectif peut lancer
        if (activeSession.hostId !== currentUserId && !isSoloMode) {
            toast.error("Seul l'hôte peut lancer la partie");
            return;
        }

        if (!isSoloMode && (activeSession.participants?.length || 0) < 2) {
            toast.error("Un second joueur est requis pour lancer en multi !");
            return;
        }

        socket.emit('geoguesser:game:start', {
            maxRounds: activeSession.maxRounds,
            difficulty: 'easy'
        });
        toast.success("C'est parti !");
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

    // Auto-switch minimap world and reset HD Map visibility when a new target map is set in Geoguesser
    useEffect(() => {
        if (targetMapId) {
            setShowHDMap(true);
        }
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

    if (!activeWorld) return <div className="p-20 text-center text-foreground/20">Initialisation de la carte...</div>;

    return (
        <div className="w-full h-full flex flex-col bg-[#080b12] relative overflow-hidden">
            {/* World Selection Dropdown — porté dans document.body pour passer AU-DESSUS de la navbar */}
            {worldDropdownOpen && worldDropdownPos && typeof document !== 'undefined' && createPortal(
                <>
                    {/* Overlay plein écran pour fermer au clic extérieur */}
                    <div className="fixed inset-0 z-[4999]" onClick={() => setWorldDropdownOpen(false)} />
                    {/* Panel ancré exactement sous le bouton */}
                    <div className="fixed z-[5000] w-60" style={{ top: worldDropdownPos.top, left: Math.max(8, worldDropdownPos.left) }}>
                        <div className="bg-surface border border-border rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.7)] p-2 max-h-[50vh] overflow-y-auto">
                            {visibleWorlds.map(w => (
                                <button
                                    key={w.id}
                                    onClick={() => { setSelectedWorldId(w.id); setWorldDropdownOpen(false); }}
                                    className={`w-full text-left px-3 py-2 rounded-lg text-xs hover:bg-elevated ${selectedWorldId === w.id ? 'text-success' : 'text-muted-foreground'}`}
                                >{w.name.fr}</button>
                            ))}
                        </div>
                    </div>
                </>,
                document.body
            )}
            {/* Header & Controls (Hidden in focused games mode) */}
            {!hideUI && (activeTab === 'map' || !initialTab) && (
                <div className="flex-shrink-0 bg-background/90 backdrop-blur-md border-b border-border px-8 flex items-center justify-between h-[64px] z-[600]">
                    {/* Left: Navigation Tabs (Only if not in focused mode) */}
                    {!initialTab ? (
                        <div className="flex items-center bg-surface p-1 rounded-2xl border border-border h-10">
                            <button
                                onClick={() => setActiveTab('map')}
                                className={`h-full px-6 text-caption font-black uppercase tracking-widest italic transition-all relative flex items-center gap-2 rounded-xl ${activeTab === 'map' ? 'text-success' : 'text-foreground/40 hover:text-foreground/70 hover:bg-surface'}`}
                            >
                                {activeTab === 'map' && <motion.div layoutId="tab-pill" className="absolute inset-0 bg-success rounded-xl " />}
                                <MapIcon size={12} className={`relative z-10 ${activeTab === 'map' ? 'text-success' : 'text-foreground/20'}`} />
                                <span className="relative z-10">Exploration</span>
                            </button>
                            <button
                                onClick={() => setActiveTab('games')}
                                className={`h-full px-6 text-caption font-black uppercase tracking-widest italic transition-all relative flex items-center gap-2 rounded-xl ${activeTab === 'games' ? 'text-success' : 'text-foreground/40 hover:text-foreground/70 hover:bg-surface'}`}
                            >
                                {activeTab === 'games' && <motion.div layoutId="tab-pill" className="absolute inset-0 bg-success rounded-xl " />}
                                <Trophy size={12} className={`relative z-10 ${activeTab === 'games' ? 'text-success' : 'text-foreground/20'}`} />
                                <span className="relative z-10">Mini-Jeux</span>
                            </button>
                        </div>
                    ) : showGameEntry ? (
                        <button 
                            onClick={() => router.push(`/dashboard/${guildId}/mini-jeux`)}
                            className="group flex items-center gap-4 bg-surface hover:bg-elevated px-6 py-2.5 rounded-2xl border border-border transition-all  active:scale-95"
                        >
                            <div className="text-success transition-transform group-hover:rotate-12">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
                                    <rect x="3" y="3" width="7" height="7" />
                                    <rect x="14" y="3" width="7" height="7" />
                                    <rect x="14" y="14" width="7" height="7" />
                                    <rect x="3" y="14" width="7" height="7" />
                                </svg>
                            </div>
                            <span className="text-caption font-black uppercase text-muted-foreground tracking-widest italic">Choix du Jeu</span>
                        </button>
                    ) : null}

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
                                {/* Essential Tools (Visible everywhere) */}
                                <div className="flex items-center gap-2 sm:gap-3">
                                    {/* World Selection (bouton déclencheur ; le panel est porté via portal au-dessus de la navbar) */}
                                    <div className="relative">
                                        <button
                                            ref={worldDropdownBtnRef}
                                            onClick={() => { setWorldDropdownPos(null); setWorldDropdownOpen(o => !o); }}
                                            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-surface/90 hover:bg-elevated border border-border text-foreground font-bold text-caption uppercase tracking-wider transition-all shadow-sm backdrop-blur-md"
                                            title="Changer de Monde ou de Carte"
                                        >
                                            <MapIcon size={13} className="text-success shrink-0" />
                                            <span className="truncate max-w-[90px] sm:max-w-[150px]">{activeWorld.name.fr}</span>
                                            <ChevronDown size={12} className={`text-muted-foreground transition-transform ${worldDropdownOpen ? 'rotate-180' : ''}`} />
                                        </button>
                                    </div>

                                    {/* Unified Map View Controls Toolbar */}
                                    <div className="hidden lg:flex items-center rounded-xl bg-surface/60 border border-border p-0.5 gap-0.5 backdrop-blur-md">
                                        {/* Grid Toggle */}
                                        <button
                                            onClick={() => setShowDebugGrid(!showDebugGrid)}
                                            className={cn(
                                                "px-2.5 py-1.5 rounded-lg text-caption font-bold uppercase transition-all flex items-center gap-1.5",
                                                showDebugGrid 
                                                    ? "bg-success/20 text-success border border-success/30" 
                                                    : "text-muted-foreground hover:text-foreground hover:bg-elevated border border-transparent"
                                            )}
                                            title={showDebugGrid ? "Masquer la grille" : "Afficher la grille"}
                                        >
                                            {showDebugGrid ? <Eye size={12} className="text-success" /> : <EyeOff size={12} />}
                                            <span className="hidden xl:inline">Grille</span>
                                        </button>

                                        {/* Zone Highlight Toggle */}
                                        <button
                                            onClick={() => setZoneHighlight(!zoneHighlight)}
                                            className={cn(
                                                "px-2.5 py-1.5 rounded-lg text-caption font-bold uppercase transition-all flex items-center gap-1.5",
                                                zoneHighlight 
                                                    ? "bg-info/20 text-info border border-info/30" 
                                                    : "text-muted-foreground hover:text-foreground hover:bg-elevated border border-transparent"
                                            )}
                                            title={zoneHighlight ? "Masquer le surlignage de zone" : "Afficher le surlignage de zone"}
                                        >
                                            <MapPin size={12} className={zoneHighlight ? "text-info" : ""} />
                                            <span className="hidden xl:inline">Zones</span>
                                        </button>

                                        {/* Zaaps Toggle */}
                                        <button
                                            onClick={() => setShowZaaps(!showZaaps)}
                                            className={cn(
                                                "px-2.5 py-1.5 rounded-lg text-caption font-bold uppercase transition-all flex items-center gap-1.5",
                                                showZaaps
                                                    ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                                                    : "text-muted-foreground hover:text-foreground hover:bg-elevated border border-transparent"
                                            )}
                                            title={showZaaps ? "Masquer les zaaps" : "Afficher les zaaps"}
                                        >
                                            <img src="/assets/dofus/zaap.png" alt="" className="w-3 h-3 object-contain" />
                                            <span className="hidden xl:inline">Zaaps</span>
                                        </button>

                                        {/* Help Toggle */}
                                        <button
                                            onClick={() => setShowMapHelp(true)}
                                            className={cn(
                                                "p-1.5 rounded-lg transition-all",
                                                showMapHelp 
                                                    ? "bg-warning/20 text-warning border border-warning/30" 
                                                    : "text-muted-foreground hover:text-foreground hover:bg-elevated border border-transparent"
                                            )}
                                            title="Aide & Raccourcis"
                                        >
                                            <HelpCircle size={13} />
                                        </button>
                                    </div>
                                </div>


                                {/* Selection Quick Action */}
                                <AnimatePresence mode="wait">
                                    {selectedPosition && (
                                        <motion.button
                                            key={`copy-${selectedPosition.x}-${selectedPosition.y}`}
                                            initial={{ opacity: 0, x: 20, scale: 0.95 }}
                                            animate={{ opacity: 1, x: 0, scale: 1 }}
                                            exit={{ opacity: 0, x: -10, scale: 0.95 }}
                                            whileHover={{ scale: 1.05 }}
                                            whileTap={{ scale: 0.95 }}
                                            onClick={() => {
                                                const cmd = `/travel ${selectedPosition.x} ${selectedPosition.y}`;
                                                navigator.clipboard.writeText(cmd);
                                                toast.success("Position copiée !", {
                                                    description: cmd,
                                                    icon: <Rocket className="w-4 h-4 text-success" />
                                                });
                                            }}
                                            className="px-3 sm:px-4 py-1.5 rounded-xl bg-success text-success-foreground font-black text-caption uppercase italic flex items-center gap-1.5 shadow-[0_10px_20px_rgba(16,185,129,0.25)] border-b-2 border-success transition-all origin-right"
                                        >
                                            <Rocket size={12} className="fill-success-foreground" />
                                            <span className="hidden sm:inline">Copier [ {selectedPosition.x}, {selectedPosition.y} ]</span>
                                            <span className="sm:hidden">[ {selectedPosition.x}, {selectedPosition.y} ]</span>
                                        </motion.button>
                                    )}
                                </AnimatePresence>

                                {/* Zone Search + Filter */}
                                <div className="relative hidden md:block">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" size={13} />
                                    {isSearchingArchi && (
                                        <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 text-warning/60 animate-spin" size={10} />
                                    )}
                                    <input
                                        type="text"
                                        value={search}
                                        onChange={e => { setSearch(e.target.value); setSearchFilter('all'); setPendingFilter(null); setPreloadedFilterResults([]); }}
                                        placeholder="Zone, monstre, boss, archimonstre..."
                                        className="w-48 lg:w-64 xl:w-72 rounded-xl bg-surface/90 hover:bg-elevated py-1.5 pl-8 pr-3 text-foreground text-caption font-medium border border-border focus:border-success/50 outline-none transition-all focus:bg-elevated placeholder:text-muted-foreground backdrop-blur-md"
                                    />

                                    {/* Dropdown with filter chips + results (TOUJOURS visible, pré-chargement possible) */}
                                    {(searchResults.length > 0 || archiResults.length > 0 || preloadedFilterResults.length > 0 || isSearchingArchi || isLoadingFilter) && (
                                        <div className="absolute top-full right-0 mt-2 w-80 bg-elevated border border-border rounded-2xl shadow-2xl overflow-hidden z-[700]">

                                            {/* Filter chips (permanents) */}
                                            <div className="flex items-center flex-wrap gap-1.5 px-3 py-2 border-b border-border bg-elevated/50">
                                                {(['all', 'zones', 'archis', 'boss', 'mobs', 'ocre'] as MapSearchFilter[]).map(f => (
                                                    <button
                                                        key={f}
                                                        onClick={() => {
                                                            setSearchFilter(f);
                                                            setPendingFilter(f);
                                                            if (!search || search.trim().length < 2) loadFilterResults(f);
                                                        }}
                                                        className={cn(
                                                            "px-2.5 py-1 rounded-lg text-caption font-black uppercase tracking-widest transition-all inline-flex items-center gap-1",
                                                            searchFilter === f
                                                                ? f === 'ocre'
                                                                    ? 'bg-warning/20 text-warning border border-warning/30'
                                                                    : f === 'archis'
                                                                        ? 'bg-warning/20 text-warning border border-warning/30'
                                                                        : 'bg-surface text-foreground border border-border-strong'
                                                                : 'text-muted-foreground hover:text-foreground border border-transparent'
                                                        )}
                                                    >
                                                        {f === 'all' ? 'Tout' :
                                                         f === 'zones' ? (<><img src="/assets/dofus/game-icons/pin.png" alt="" className="w-3 h-3 object-contain" /> Zones</>) :
                                                         f === 'archis' ? (<><img src="/assets/nav/archimonster.png" alt="" className="w-3 h-3 object-contain" /> Archis</>) :
                                                         f === 'boss' ? (<><img src="/assets/dofus/game-icons/crown.png" alt="" className="w-3 h-3 object-contain" /> Boss</>) :
                                                         f === 'mobs' ? (<><img src="/assets/dofus/game-icons/crossed-swords.png" alt="" className="w-3 h-3 object-contain" /> Mobs</>) : (<><img src="/assets/icons/ocre.png" alt="" className="w-3 h-3 object-contain" /> Ocre</>)}
                                                    </button>
                                                ))}
                                            </div>

                                            {/* Subarea / Zone results */}
                                            {(searchFilter === 'all' || searchFilter === 'zones') && searchResults.length > 0 && (
                                                <>
                                                    {searchFilter === 'all' && archiResults.length > 0 && (
                                                            <div className="px-3 py-1.5 bg-elevated/50 border-b border-border">
                                                                <span className="text-muted-foreground text-caption font-black uppercase tracking-widest inline-flex items-center gap-1.5"><img src="/assets/dofus/game-icons/pin.png" alt="" className="w-3 h-3 object-contain" /> Zones</span>
                                                            </div>
                                                    )}
                                                    {searchResults.slice(0, searchFilter === 'zones' ? 10 : 4).map((s: any) => (
                                                        <button key={s.id === -999 ? `coord-${s.x}-${s.y}` : s.id} onClick={() => handleSearchResultClick(s)} className="w-full text-left px-4 py-2.5 hover:bg-surface border-b border-border last:border-0 transition-colors">
                                                            <div className="flex justify-between items-center">
                                                                <span className="text-foreground text-caption font-black uppercase italic">{typeof s.name === 'string' ? s.name : s.name?.fr || 'Inconnu'}</span>
                                                                {!s.isCoord && (
                                                                    <span className="text-success/50 text-caption uppercase font-black px-1.5 py-0.5 rounded-md bg-success/5">Lvl {s.level || '?'}</span>
                                                                )}
                                                            </div>
                                                        </button>
                                                    ))}
                                                </>
                                            )}

                                            {/* Pré-chargement du filtre (clic sans texte, ex: 🟡 Ocre) */}
                                            {pendingFilter && pendingFilter !== 'all' && pendingFilter !== 'zones' && preloadedFilterResults.length > 0 && (
                                                <>
                                                    <div className="px-3 py-1.5 bg-warning/5 border-b border-warning/10">
                                                            <span className="text-warning/70 text-caption font-black uppercase tracking-widest">
                                                                {pendingFilter === 'ocre' ? 'Quête Ocre' : pendingFilter === 'archis' ? 'Archimonstres' : pendingFilter === 'boss' ? 'Boss' : 'Monstres'}
                                                            </span>
                                                    </div>
                                                    {preloadedFilterResults.map((a: any) => (
                                                        <button
                                                            key={a.id}
                                                            onClick={() => handleSearchResultClick({ ...a, isArchi: true })}
                                                            className={cn(
                                                                "w-full text-left px-4 py-2.5 border-b border-border last:border-0 transition-colors group",
                                                                a.subAreaIds?.length > 0 ? "hover:bg-warning/5" : "hover:bg-elevated opacity-70"
                                                            )}
                                                        >
                                                            <div className="flex items-center justify-between gap-2">
                                                                <div className="flex items-center gap-2 min-w-0">
                                                                    {a.imageUrl ? (
                                                                        <img src={a.imageUrl} alt={a.name} className="w-7 h-7 rounded object-contain flex-shrink-0 opacity-80 group-hover:opacity-100" />
                                                                    ) : (
                                                                        <div className="w-7 h-7 rounded bg-warning/10 flex items-center justify-center flex-shrink-0">
                                                                            <img src={a.type === 'monstre' ? "/assets/dofus/game-icons/crossed-swords.png" : a.type === 'boss' ? "/assets/dofus/game-icons/crown.png" : "/assets/nav/archimonster.png"} alt="" className="w-4 h-4 object-contain" />
                                                                        </div>
                                                                    )}
                                                                    <div className="min-w-0">
                                                                        <div className="text-warning text-caption font-black uppercase italic truncate">{a.name}</div>
                                                                        <div className="text-muted-foreground text-caption uppercase truncate">{a.zoneName || 'Zone inconnue'}</div>
                                                                    </div>
                                                                </div>
                                                                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                                                                    {a.level > 0 && (
                                                                        <span className="text-warning/60 text-caption uppercase font-black px-1.5 py-0.5 rounded-md bg-warning/5">Lvl {a.level}</span>
                                                                    )}
                                                                    {a.worldMapId > 1 && (
                                                                        <span className="text-info/70 text-caption font-black px-1.5 py-0.5 rounded-md bg-info/10">Monde {a.worldMapId}</span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </button>
                                                    ))}
                                                </>
                                            )}

                                            {/* Bounty / Archimonstre / Monstre results */}
                                            {searchFilter !== 'zones' && archiResults.length > 0 && (
                                                <>
                                                    {searchFilter === 'all' && searchResults.length > 0 && (
                                                            <div className="px-3 py-1.5 bg-warning/5 border-b border-warning/10">
                                                                <span className="text-warning/70 text-caption font-black uppercase tracking-widest inline-flex items-center gap-1.5"><img src="/assets/nav/archimonster.png" alt="" className="w-3 h-3 object-contain" /> Avis & Archimonstres</span>
                                                            </div>
                                                    )}
                                                    {archiResults.slice(0, searchFilter !== 'all' ? 10 : 5).map((a: any) => (
                                                        <button
                                                            key={a.id}
                                                            onClick={() => handleSearchResultClick({ ...a, isArchi: true })}
                                                            className={cn(
                                                                "w-full text-left px-4 py-2.5 border-b border-border last:border-0 transition-colors group",
                                                                a.subAreaIds?.length > 0 ? "hover:bg-warning/5" : "hover:bg-elevated opacity-70"
                                                            )}
                                                        >
                                                            <div className="flex items-center justify-between gap-2">
                                                                <div className="flex items-center gap-2 min-w-0">
                                                                    {a.imageUrl ? (
                                                                        <img src={a.imageUrl} alt={a.name} className="w-7 h-7 rounded object-contain flex-shrink-0 opacity-80 group-hover:opacity-100" />
                                                                    ) : (
                                                                        <div className="w-7 h-7 rounded bg-warning/10 flex items-center justify-center flex-shrink-0">
                                                                            <img src={a.type === 'monstre' ? "/assets/dofus/game-icons/crossed-swords.png" : a.type === 'boss' ? "/assets/dofus/game-icons/crown.png" : "/assets/nav/archimonster.png"} alt="" className="w-4 h-4 object-contain" />
                                                                        </div>
                                                                    )}
                                                                    <div className="min-w-0">
                                                                        <div className="flex items-center gap-1.5">
                                                                            <span className={cn(
                                                                                "text-caption font-black uppercase italic truncate",
                                                                                a.isOcre ? "text-warning" : a.type === 'monstre' ? "text-foreground/70" : "text-warning"
                                                                            )}>{a.name}</span>
                                                                            {a.isOcre && (
                                                                                <img src="/module-dofus/Dofus_Ocre.png" alt="Ocre" className="w-3.5 h-3.5 shrink-0" title="Quête Ocre" />
                                                                            )}
                                                                            {a.type === 'boss' && <span className="text-caption text-warning/70 font-black uppercase px-1 py-0.5 rounded bg-warning/10 border border-warning/10">Boss</span>}
                                                                        </div>
                                                                        <div className="text-muted-foreground text-caption uppercase truncate">
                                                                            {a.zoneName
                                                                                ? a.subAreaIds?.length > 0
                                                                                    ? a.zoneName
                                                                                    : `⚠ ${a.zoneName} (zone introuvable)`
                                                                                : '⚠ Zone inconnue'
                                                                            }
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                                                                    {a.level > 0 && (
                                                                        <span className="text-warning/70 text-caption uppercase font-black px-1.5 py-0.5 rounded-md bg-warning/10">Lvl {a.level}</span>
                                                                    )}
                                                                    {a.worldMapId > 1 && (
                                                                        <span className="text-info/70 text-caption font-black px-1.5 py-0.5 rounded-md bg-info/10">Monde {a.worldMapId}</span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </button>
                                                    ))}
                                                </>
                                            )}

                                            {isSearchingArchi && archiResults.length === 0 && searchResults.length === 0 && (
                                                <div className="px-4 py-3 text-muted-foreground text-caption italic text-center flex items-center justify-center gap-2">
                                                    <Loader2 size={10} className="animate-spin" />
                                                    Recherche...
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>


                                {/* Mobile Tools Overflow */}
                                <div className="lg:hidden relative group">
                                    <button className="p-2 rounded-xl bg-surface border border-border text-muted-foreground hover:text-foreground">
                                        <Plus size={16} />
                                    </button>
                                    <div className="absolute top-full right-0 pt-2 w-48 opacity-0 scale-95 pointer-events-none group-hover:opacity-100 group-hover:scale-100 group-hover:pointer-events-auto transition-all z-[700]">
                                        <div className="bg-surface border border-border rounded-xl shadow-2xl p-2 space-y-1">
                                            <button onClick={() => setShowDebugGrid(!showDebugGrid)} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-caption font-bold uppercase text-muted-foreground hover:bg-elevated">
                                                {showDebugGrid ? <Eye size={14} className="text-success" /> : <EyeOff size={14} />}
                                                Grille
                                            </button>
                                            <button onClick={() => setAutoCopyTravel(!autoCopyTravel)} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-caption font-bold uppercase text-muted-foreground hover:bg-elevated">
                                                <Zap size={14} className={autoCopyTravel ? "text-warning fill-warning" : ""} />
                                                Copie Auto
                                            </button>
                                            <button onClick={() => setShowMapHelp(true)} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-caption font-bold uppercase text-muted-foreground hover:bg-elevated">
                                                <HelpCircle size={14} />
                                                Aide
                                            </button>
                                            <div className="md:hidden pt-2 border-t border-border">
                                                <div className="relative">
                                                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" size={10} />
                                                    <input
                                                        type="text"
                                                        value={search}
                                                        onChange={e => setSearch(e.target.value)}
                                                        placeholder="Zone..."
                                                        className="w-full rounded-lg bg-black/40 py-1.5 pl-7 pr-3 text-foreground text-caption uppercase font-bold border border-border outline-none"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* 🪓 Bouton GPS Opti-Farm & Récolte */}
                                <button
                                    onClick={() => setShowHarvestPanel(!showHarvestPanel)}
                                    className={cn(
                                        "hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-caption font-bold uppercase tracking-wider transition-all border shadow-sm backdrop-blur-md",
                                        showHarvestPanel || selectedHarvestResourceIds.size > 0
                                            ? "bg-success/25 text-success border-success/50 shadow-success/20"
                                            : "bg-surface/90 hover:bg-elevated border-border text-muted-foreground hover:text-foreground"
                                    )}
                                    title="GPS Opti-Farm, Récolte & Zaaps"
                                >
                                    <Compass size={13} className={cn("text-success", showHarvestPanel && "animate-spin-slow")} />
                                    <span>Opti-Farm</span>
                                    {selectedHarvestResourceIds.size > 0 && (
                                        <span className="w-4 h-4 rounded-full bg-success text-success-foreground text-[10px] font-black flex items-center justify-center">
                                            {selectedHarvestResourceIds.size}
                                        </span>
                                    )}
                                </button>

                                {/* 🏷️ DofusDB Attribution — tout à droite */}
                                {!hideUI && (
                                    <div className="hidden 2xl:flex items-center gap-1.5 ml-1 pl-3 border-l border-border text-caption text-muted-foreground">
                                        <img src="/assets/icons/dofusdb.png" alt="DofusDB" className="w-3.5 h-3.5 rounded-sm object-contain opacity-80" />
                                        <span>DofusDB <span className="opacity-60">(LPNC-IA 1.0)</span></span>
                                    </div>
                                )}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            )}

            {/* Main Content Area (Map or Game) */}
            <div className="flex-1 relative flex overflow-hidden">
                {activeTab === 'games' && gamePhase !== 'idle' && <ForceFullscreen />}

                {/* HUD + Quitter + Croix en plein écran pendant une partie */}
                {activeTab === 'games' && gamePhase !== 'idle' && isFullscreen && activeSession && (
                    <>
                        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[10001] pointer-events-auto">
                            <GeoguesserHUD
                                round={activeSession.currentRound || 1}
                                maxRounds={activeSession.maxRounds || 5}
                                timeLeft={timeLeft}
                                score={score}
                                gamePhase={gamePhase as any}
                                participants={activeSession.participants}
                                spectators={activeSession.participants?.filter((p: any) => p.isSpectator)}
                                currentUserId={currentUserId}
                                hasGuessed={activeSession.participants?.find((p: any) => p.userId === currentUserId)?.hasGuessed}
                                onReportMap={handleReportMap}
                            />
                        </div>
                        <button
                            onClick={handleLeaveSession}
                            className="fixed top-4 right-4 z-[10001] px-4 py-2.5 rounded-full bg-danger/90 border border-danger text-danger-foreground font-black uppercase text-xs italic flex items-center gap-2 shadow-2xl hover:bg-danger transition-colors cursor-pointer"
                            title="Quitter la partie"
                        >
                            <LogOut size={16} />
                            Quitter
                        </button>
                    </>
                )}


                {/* 🎯 MODE SIGIL GUESSER - ACTIVE GAMEPLAY */}
                {activeTab === 'games' && gamePhase === 'playing' && (
                    <div className="flex flex-col lg:flex-row w-full h-full relative overflow-hidden bg-background">
                        {/* 🖼️ ZONE CIBLE À GAUCHE (CARTE HD NON-ROGNÉE ET MAXIMISÉE) */}
                        <div className="h-[45vh] lg:h-full lg:w-3/5 lg:flex-none relative bg-black/90 overflow-hidden flex items-center justify-center border-b lg:border-b-0 lg:border-r border-border shrink-0 min-h-0 p-1 sm:p-2">
                            {targetMapId ? (
                                showHDMap ? (
                                    <motion.div
                                        className="w-full h-full relative geoguesser-image-container group/hdmap flex items-center justify-center overflow-hidden rounded-2xl"
                                        initial={{ scale: 1.02, opacity: 0 }}
                                        animate={{ scale: 1, opacity: 1 }}
                                    >
                                        <img
                                            src={`/game-data/hd_maps/${targetMapId}.webp`}
                                            className="w-full h-full object-contain rounded-xl shadow-2xl transition-all duration-300 ease-out"
                                            alt="Target Map HD"
                                        />

                                        {/* Discreet vignette to cover the bottom-right "dofusdb" watermark */}
                                        <div className="absolute bottom-0 right-0 w-28 h-10 bg-gradient-to-tl from-black/95 via-black/60 to-transparent rounded-br-xl pointer-events-none z-10" />

                                        {/* Close button for HD Map */}
                                        <button 
                                            onClick={() => setShowHDMap(false)}
                                            className="absolute top-3 right-3 z-50 w-8 h-8 rounded-full bg-black/70 backdrop-blur-md border border-border text-muted-foreground flex items-center justify-center opacity-0 group-hover/hdmap:opacity-100 transition-all hover:bg-danger hover:text-danger-foreground"
                                            title="Masquer l'aperçu"
                                        >
                                            <X size={16} />
                                        </button>

                                        {/* Hint Overlay (Sobre & Lisible) */}
                                        <div className="absolute bottom-3 left-3 flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-black/80 backdrop-blur-md border border-border shadow-lg z-20">
                                            <div className="w-7 h-7 rounded-lg bg-success/20 border border-success/30 flex items-center justify-center">
                                                <Target className="w-4 h-4 text-success" />
                                            </div>
                                            <div>
                                                <h4 className="text-foreground font-bold text-xs">Où est-ce ?</h4>
                                                <p className="text-success/80 text-caption font-medium">Analyse le décor et sélectionne ta position</p>
                                            </div>
                                        </div>
                                    </motion.div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center gap-4 text-center p-6 bg-background/40 w-full h-full">
                                        <div className="w-16 h-16 rounded-2xl bg-surface border border-border flex items-center justify-center text-muted-foreground shadow-xl">
                                            <EyeOff size={28} />
                                        </div>
                                        <div>
                                            <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">Image HD masquée</h3>
                                            <p className="text-xs text-muted-foreground mt-1 max-w-xs leading-relaxed">
                                                Vous avez masqué l'aperçu HD pour libérer de l'espace.
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => setShowHDMap(true)}
                                            className="px-4 py-2 rounded-xl bg-info/10 border border-info/20 text-info font-bold uppercase tracking-wider text-caption hover:bg-info/20 hover:border-info/30 active:scale-95 transition-all"
                                        >
                                            Revoir l'image HD
                                        </button>
                                    </div>
                                )
                            ) : (
                                <div className="flex flex-col items-center gap-4 text-foreground/10 uppercase font-black italic">
                                    <Loader2 className="animate-spin" size={32} />
                                    <p className="tracking-widest text-caption">Initialisation...</p>
                                </div>
                            )}

                        </div>

                        {/* 🗺️ PANEL INTERACTIF À DROITE (CARTE COMPLÈTE) */}
                        <div className="flex-1 lg:flex-none lg:w-1/2 border-l border-border bg-[#080b0e] flex flex-col relative z-20 shadow-[-20px_0_50px_rgba(0,0,0,0.5)] min-h-0">

                            {/* Integrated Multi-Leaderboard */}
                            {!isSoloMode && (
                                <div className={cn(
                                    "flex flex-col shrink-0 bg-black/40 border-b border-border transition-all duration-300",
                                    "lg:h-[280px] lg:flex", // Desktop fixed height
                                    activePanelTab === 'scores' ? "flex-1 h-full" : "hidden lg:flex" // Mobile toggle
                                )}>
                                    <div className="flex items-center justify-between p-4 md:p-6 pb-2 md:pb-4">
                                        <h4 className="text-muted-foreground text-caption font-black uppercase tracking-widest flex items-center gap-2 italic">
                                            <Users size={14} /> Joueurs du Salon
                                        </h4>
                                        <span className="text-success/40 text-caption font-black uppercase tracking-widest italic">{activeSession?.participants?.length || 1} Connectés</span>
                                    </div>
                                    <div className="flex-1 overflow-y-auto px-4 md:px-6 pb-4 md:pb-6 space-y-2 custom-scrollbar list-none">
                                        {[...(activeSession?.participants || [])].sort((a: any, b: any) => (b.score || 0) - (a.score || 0)).map((p: any, i: number) => {
                                            const isMe = p.userId === currentUserId;
                                            return (
                                                <div key={p.userId} className={`flex items-center justify-between p-3 rounded-2xl transition-all ${isMe ? 'bg-success/10 border border-success/20' : 'bg-surface'}`}>
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-lg bg-surface border border-border flex items-center justify-center overflow-hidden">
                                                            {p.userAvatar ? (
                                                                <img src={p.userAvatar} alt="" className="w-full h-full object-cover" />
                                                            ) : (
                                                                <div className={`w-full h-full flex items-center justify-center text-caption font-black italic ${i === 0 && p.score > 0 ? 'bg-warning text-warning-foreground' : 'bg-surface text-warning-foreground/40'}`}>
                                                                    {i === 0 && p.score > 0 ? (
                                                                        <img src="/assets/dofus/game-icons/crown.png" alt="1er" className="w-4 h-4 object-contain" />
                                                                    ) : i + 1}
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div className="flex flex-col">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-foreground text-caption font-black uppercase italic tracking-wider">{p.userName}</span>
                                                                {isMe && <span className="px-1 py-0.5 rounded bg-success text-caption text-success-foreground font-black uppercase italic">Toi</span>}
                                                            </div>
                                                            {!p.hasGuessed ? (
                                                                <span className="text-caption text-muted-foreground font-bold uppercase italic flex items-center gap-1">
                                                                    <Clock size={8} className="animate-spin-slow" /> Réfléchit...
                                                                </span>
                                                            ) : (
                                                                <span className="text-caption text-success font-bold uppercase italic flex items-center gap-1">
                                                                    <CheckCircle2 size={8} /> Prêt !
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        <span className="text-lg font-black text-success italic leading-none">{p.score}</span>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Panel Header */}
                            <div className="h-14 shrink-0 px-4 md:px-6 flex items-center justify-between border-b border-border bg-black/20">
                                <div className="flex items-center gap-2 md:gap-3">
                                    <div className="lg:hidden flex bg-surface p-1 rounded-xl border border-border">
                                        <button 
                                            onClick={() => setActivePanelTab('map')}
                                            className={cn(
                                                "p-1.5 rounded-lg transition-all",
                                                activePanelTab === 'map' ? "bg-success text-success-foreground shadow-lg" : "text-muted-foreground hover:text-foreground"
                                            )}
                                        >
                                            <MapIcon size={12} />
                                        </button>
                                        <button 
                                            onClick={() => setActivePanelTab('scores')}
                                            className={cn(
                                                "p-1.5 rounded-lg transition-all",
                                                activePanelTab === 'scores' ? "bg-success text-success-foreground shadow-lg" : "text-muted-foreground hover:text-foreground"
                                            )}
                                        >
                                            <Trophy size={12} />
                                        </button>
                                    </div>
                                    <div className="hidden md:block w-2 h-2 rounded-full bg-success " />
                                    <h3 className="hidden sm:block text-foreground font-black text-caption uppercase tracking-widest italic">Carte Tactique</h3>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="flex items-center gap-1 mr-2 border-r border-border pr-3">
                                        <button
                                            onClick={() => setMinimapRecenterTrigger(t => t + 999)} // Use specific pattern for zoom in
                                            className="w-8 h-8 flex items-center justify-center rounded-lg bg-surface hover:bg-elevated text-muted-foreground hover:text-foreground border border-border transition-all active:scale-95"
                                            title="Zoomer"
                                        >
                                            <Plus size={14} />
                                        </button>
                                        <button
                                            onClick={() => setMinimapRecenterTrigger(t => t - 999)} // Use specific pattern for zoom out
                                            className="w-8 h-8 flex items-center justify-center rounded-lg bg-surface hover:bg-elevated text-muted-foreground hover:text-foreground border border-border transition-all active:scale-95"
                                            title="Dézoomer"
                                        >
                                            <Minus size={14} />
                                        </button>
                                    </div>
                                    <button
                                        onClick={() => setMinimapRecenterTrigger(t => t > 0 && t < 900 ? t + 1 : 1)}
                                        className="px-3 md:px-4 py-1.5 rounded-lg bg-surface hover:bg-elevated text-muted-foreground hover:text-foreground border border-border transition-all flex items-center gap-2 active:scale-95"
                                    >
                                        <Compass size={12} />
                                        <span className="hidden sm:inline text-caption font-black uppercase italic">Recentrer</span>
                                    </button>

                                    {/* Minimize / Toggle UI button - user request */}
                                    <button
                                        onClick={() => setIsMinimapHidden(!isMinimapHidden)}
                                        className="p-1.5 rounded-lg bg-surface hover:bg-danger/20 text-muted-foreground hover:text-danger border border-border transition-all active:scale-95 ml-auto"
                                        title={isMinimapHidden ? "Afficher l'interface" : "Masquer l'interface"}
                                    >
                                        <X size={14} />
                                    </button>
                                </div>
                            </div>

                            {/* Integrated Map - Fixed flexible container */}
                            <div className={cn(
                                "flex-1 relative bg-background overflow-hidden min-h-[300px] lg:min-h-[400px]",
                                activePanelTab === 'scores' && "hidden lg:block"
                            )}>
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
                                    initialZoom={initialZoom}
                                    minimapRecenterTrigger={minimapRecenterTrigger}
                                    minimapZoomLevel={initialZoom}
                                    participants={activeSession?.participants}
                                    currentUserId={currentUserId}
                                    isSpectator={isCurrentUserSpectator}
                                    hideUI={hideUI}
                                    minZoom={Math.max(selectedWorldId !== 1 ? -3 : -4, -(activeWorld.zoom?.length || 1) - 1)}
                                    autoCopyTravel={autoCopyTravel}
                                    interactive={interactive}
                                />

                                {/* Floating Validation Overlay inside panel */}
                                {selectedPosition && gamePhase === 'playing' && !isCurrentUserSpectator && !activeSession?.participants?.find((p: any) => p.userId === currentUserId)?.hasGuessed && (
                                    <div className="absolute bottom-6 inset-x-6 z-[1000] animate-in slide-in-from-bottom-6 duration-300">
                                        <button
                                            onClick={handleSubmitGuess}
                                            className="w-full py-5 rounded-2xl bg-success hover:bg-success text-success-foreground font-black uppercase text-xs italic tracking-widest shadow-[0_20px_40px_rgba(16,185,129,0.3)] border border-success/50 transition-all active:scale-95 flex items-center justify-center gap-4 cursor-pointer"
                                        >
                                            Confirmer ma position <Target size={20} />
                                        </button>
                                    </div>
                                )}

                                {/* Floating "Waiting for other players" overlay inside tactical map */}
                                {gamePhase === 'playing' && !isCurrentUserSpectator && activeSession?.participants?.find((p: any) => p.userId === currentUserId)?.hasGuessed && (
                                    <div className="absolute bottom-6 inset-x-6 z-[1000] animate-in slide-in-from-bottom-6 duration-300">
                                        <div className="w-full py-4 px-6 rounded-2xl bg-success/15 backdrop-blur-xl border border-success/40 text-success shadow-[0_20px_40px_rgba(16,185,129,0.25)] flex items-center justify-center gap-3">
                                            <CheckCircle2 className="text-success w-5 h-5 shrink-0" />
                                            <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2 text-center sm:text-left">
                                                <span className="font-black uppercase text-xs tracking-wider">Position validée !</span>
                                                <span className="text-success/80 text-caption font-medium">
                                                    {(activeSession?.participants?.filter((p: any) => !p.isSpectator).length || 1) > 1
                                                        ? "En attente des autres joueurs..."
                                                        : "Calcul des résultats..."}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {isCurrentUserSpectator && gamePhase === 'playing' && (
                                    <div className="absolute top-6 inset-x-6 z-[1000] animate-in slide-in-from-top-6 duration-300">
                                        <div className="w-full py-4 rounded-2xl bg-[#a78bfa]/10 backdrop-blur-xl border border-[#a78bfa]/20 flex items-center justify-center gap-3 shadow-[0_10px_30px_rgba(167,139,250,0.1)]">
                                            <div className="w-2 h-2 rounded-full bg-[#a78bfa] animate-pulse" />
                                            <span className="text-[#a78bfa] font-black uppercase text-caption tracking-[0.2em] italic drop-shadow-sm">Mode Spectateur — Observation seule</span>
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
                        {/* Croix propre : quitter le plein écran et revenir à l'accueil de la carte */}
                        {!hideUI && guildId && (
                            <button
                                onClick={() => {
                                    applyFullscreen(false);
                                    router.push(`/dashboard/${guildId}/worldmap`);
                                }}
                                className="absolute top-3 right-3 z-[1200] w-9 h-9 rounded-full bg-surface/90 border border-border hover:bg-danger/20 hover:text-danger hover:border-danger/50 text-foreground backdrop-blur-md shadow-lg flex items-center justify-center transition-all active:scale-90 cursor-pointer"
                                title="Quitter le plein écran et revenir à l'accueil de la carte"
                                aria-label="Quitter le plein écran et revenir à l'accueil de la carte"
                            >
                                <X size={16} />
                            </button>
                        )}
                        <AnimatePresence>
                            {(showMapHelp && !hideUI) && (
                                <div className="absolute top-6 left-1/2 -translate-x-1/2 z-[1000] w-full max-w-4xl px-4 pointer-events-none">
                                    <div className="pointer-events-auto">
                                        <MapHelpCard onClose={() => setShowMapHelp(false)} />
                                    </div>
                                </div>
                            )}
                        </AnimatePresence>
                        <LeafletMapCore
                            activeWorld={activeWorld}
                            selectedWorldId={selectedWorldId}
                            activeMaps={activeMaps}
                            mapsByCoords={allWorldMapsByCoords}
                            subAreasById={subAreasById}
                            dungeonsByMapId={dungeonsByMapId}
                            groupedDungeons={groupedDungeons}
                            showDebugGrid={showDebugGrid}
                            zoneHighlight={zoneHighlight}
                            selectedPosition={selectedPosition}
                            setSelectedPosition={handleMapClick}
                            setSelectedDungeon={setSelectedDungeon}
                            triggerCenterPosition={triggerCenterPosition}
                            triggerWorldId={initialWorldId}
                            mapsBySubAreaId={mapsBySubAreaId}
                            guessResult={guessResult}
                            isMiniMap={false}
                            initialZoom={initialZoom}
                            minimapRecenterTrigger={minimapRecenterTrigger}
                            participants={activeSession?.participants}
                            currentUserId={currentUserId}
                            isSpectator={isCurrentUserSpectator}
                            hideUI={hideUI}
                            minZoom={Math.max(selectedWorldId !== 1 ? -3 : -4, -(activeWorld.zoom?.length || 1) - 1)}
                            highlightSubareaIds={highlightSubareaIds}
                            interactive={interactive}
                            zaaps={zaaps}
                            showZaaps={showZaaps}
                            selectedHarvestResources={selectedHarvestResources}
                            activeCircuit={activeCircuit}
                            completedHarvestSteps={completedHarvestSteps}
                            onToggleHarvestStep={handleToggleHarvestStep}
                        />

                        {/* 🪓 Panneau Latéral Récolte, Métiers & GPS Opti-Farm */}
                        <AnimatePresence>
                            {showHarvestPanel && (
                                <HarvestOptiFarmPanel
                                    jobsData={harvestJobs}
                                    selectedJobId={selectedHarvestJobId}
                                    onSelectJobId={setSelectedHarvestJobId}
                                    selectedResourceIds={selectedHarvestResourceIds}
                                    onToggleResource={handleToggleHarvestResource}
                                    onSelectAllUpToLevel={handleSelectAllHarvestUpToLevel}
                                    onClearResources={handleClearHarvestResources}
                                    activeCircuit={activeCircuit}
                                    onSelectCircuit={handleSelectCircuit}
                                    showZaaps={showZaaps}
                                    onToggleShowZaaps={() => setShowZaaps(prev => !prev)}
                                    isOpen={showHarvestPanel}
                                    onClose={() => setShowHarvestPanel(false)}
                                    activeWorldId={selectedWorldId}
                                    onSelectWorld={setSelectedWorldId}
                                    worlds={visibleWorlds}
                                />
                            )}
                        </AnimatePresence>

                        {/* 🧭 Télécommande Flottante Guidage GPS Opti-Farm */}
                        <HarvestGpsController
                            circuit={activeCircuit}
                            onClose={() => setActiveCircuit(null)}
                            onGoToCoord={(x: number, y: number) => {
                                setTriggerCenterPosition({ x, y });
                                setMinimapRecenterTrigger(prev => prev + 1);
                            }}
                            completedStepIndices={completedHarvestSteps}
                            onToggleStepCompleted={handleToggleHarvestStep}
                        />

                        {/* 🏷️ DofusDB Attribution Badge — déplacé dans le bandeau du haut */}

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
                                    onReportMap={handleReportMap}
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
                                    onReportMap={handleReportMap}
                                />
                            </div>
                        )}

                        {/* QUITTER LA PARTIE BUTTON - Portaled to Header */}
                        {typeof document !== 'undefined' && document.getElementById('sigil-geoguesser-header-actions') ? (
                            createPortal(
                                <button
                                    onClick={handleLeaveSession}
                                    className="px-4 py-2 sm:px-6 sm:py-3 rounded-lg sm:rounded-xl bg-danger hover:bg-danger/90 text-danger-foreground font-black uppercase text-caption sm:text-xs italic border-b-[4px] border-black/20 transition-all flex items-center gap-2 shadow-[0_10px_20px_rgba(255,71,87,0.2)] active:translate-y-1 active:border-b-0 "
                                >
                                    <LogOut size={16} />
                                    <span>Quitter la partie</span>
                                </button>,
                                document.getElementById('sigil-geoguesser-header-actions')!
                            )
                        ) : (
                            <div className="absolute top-4 left-4 sm:top-6 sm:left-8 pointer-events-auto z-[800] flex flex-col gap-2">
                                <button
                                    onClick={handleLeaveSession}
                                    className="px-5 py-3 sm:px-8 sm:py-4 rounded-xl sm:rounded-2xl bg-danger hover:bg-danger/90 text-danger-foreground font-black uppercase text-caption sm:text-xs italic border-b-[4px] sm:border-b-[8px] border-black/20 transition-all flex items-center gap-3 shadow-[0_20px_40px_rgba(255,71,87,0.3)] active:translate-y-1 active:border-b-0 "
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
                            className="w-full h-full max-h-full max-w-[1600px] bg-elevated/95 backdrop-blur-[40px] border border-border rounded-[2rem] md:rounded-[3rem] shadow-[0_50px_100px_rgba(0,0,0,0.9)] p-4 sm:p-6 md:p-10 pointer-events-auto relative overflow-y-auto overflow-x-hidden flex flex-col custom-scrollbar"
                        >
                                <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-success/[0.03] rounded-full blur-[120px] -translate-y-1/2 translate-x-1/4 pointer-events-none" />

                                {/* Header: More compact for horizontal layout */}
                                <div className="flex items-center justify-between mb-8 gap-6 border-b border-border pb-8 relative z-10">
                                    <div className="flex items-center gap-5">
                                        <div className="w-14 h-14 rounded-2xl bg-success/10 flex items-center justify-center text-success border border-success/20 ">
                                            <Trophy size={28} />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-3 mb-1">
                                                <h3 className="text-foreground font-black text-3xl uppercase italic leading-none tracking-tighter">Round {activeSession.currentRound}</h3>
                                                <span className={`px-3 py-1 rounded-full text-caption font-black uppercase tracking-wider ${activeSession.state === 'IN_PROGRESS' ? 'bg-warning/20 text-warning' : 'bg-success/20 text-success'}`}>
                                                    {activeSession.state === 'IN_PROGRESS' ? 'En attente des joueurs' : 'Terminé'}
                                                </span>
                                            </div>
                                            <p className="text-muted-foreground text-caption font-black uppercase tracking-widest italic">Analyse des Précisions Géographiques</p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-6 flex-wrap">
                                        <div className={cn(
                                            "px-5 py-3 rounded-2xl border flex flex-col items-center min-w-[110px] transition-colors",
                                            timeLeft <= 3 ? "bg-warning/15 border-warning/30" : "bg-surface border-border"
                                        )}>
                                            <span className="text-muted-foreground text-caption font-bold uppercase tracking-widest mb-1">Prochaine map dans</span>
                                            <span className={cn(
                                                "font-black text-3xl leading-none tabular-nums",
                                                timeLeft <= 3 ? "text-warning animate-pulse" : "text-foreground"
                                            )}>
                                                {timeLeft}s
                                            </span>
                                        </div>
                                        {(activeSession.hostId === currentUserId || isSoloMode) ? (
                                            <motion.button
                                                whileHover={{ scale: 1.02, y: -2 }}
                                                whileTap={{ scale: 0.98 }}
                                                onClick={handleNextRound}
                                                className="px-8 py-4 rounded-2xl bg-success text-success-foreground font-black uppercase text-xs italic transition-all flex items-center gap-3 border-b-4 border-success shadow-[0_20px_40px_rgba(16,185,129,0.2)] hover:shadow-[0_25px_50px_rgba(16,185,129,0.3)]"
                                            >
                                                <span>Suivant</span>
                                                <ChevronRight size={18} />
                                            </motion.button>
                                        ) : (
                                            <div className="px-5 py-4 rounded-2xl bg-surface border border-border flex items-center gap-2 text-muted-foreground text-caption font-bold uppercase tracking-wider">
                                                <Loader2 size={14} className="animate-spin text-success" />
                                                <span>En attente de l'hôte...</span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="flex flex-col xl:flex-row gap-6 md:gap-10 min-h-min relative z-10">
                                    {/* Left Side: Result Analysis & Comparison */}
                                    <div className="flex-1 flex flex-col gap-6">
                                        {guessResult && (
                                            <>
                                                <div className="p-4 sm:p-6 rounded-[2rem] sm:rounded-[2.5rem] bg-surface border border-border flex flex-col sm:flex-row sm:items-center gap-4 sm:justify-between overflow-hidden relative group shrink-0">
                                                    <div className="flex items-center gap-4 sm:gap-6 relative z-10">
                                                        <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl bg-success/10 flex items-center justify-center border border-success/20 shrink-0">
                                                            <Target className="text-success w-6 h-6 sm:w-8 sm:h-8" />
                                                        </div>
                                                        <div>
                                                            <div className="text-success/80 text-caption sm:text-caption font-black uppercase tracking-[0.2em] mb-1 italic">Score Précision</div>
                                                            <div className="text-foreground font-black text-3xl sm:text-4xl italic flex items-baseline gap-2 sm:gap-3">
                                                                {Math.round(guessResult.distance)} Maps
                                                                <span className="text-success/40 text-caption sm:text-body font-bold uppercase tracking-widest break-words leading-tight">de distance</span>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Points gagnés au round */}
                                                    <div className="flex flex-col sm:items-end justify-center shrink-0 border-t sm:border-t-0 sm:border-l border-border pt-3 sm:pt-0 sm:pl-6">
                                                        <div className="text-muted-foreground text-caption font-black uppercase tracking-widest italic">Gain du Round</div>
                                                        <div className="text-success font-black text-2xl sm:text-3xl italic flex items-baseline gap-1.5">
                                                            +{(guessResult.guess?.score || 0).toLocaleString()}
                                                            <span className="text-caption text-success/60 font-bold uppercase">pts</span>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 shrink-0">
                                                    {/* Your Choice */}
                                                    <div className="flex flex-col gap-2 sm:gap-3 h-full">
                                                        <div className="flex items-center justify-between px-2">
                                                            <div className="text-caption font-black text-muted-foreground uppercase tracking-[0.2em] italic flex items-center gap-2">
                                                                <div className="w-1.5 h-1.5 rounded-full bg-success" />
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
                                                                    const mObj = allMapsById.get(Number(mId));
                                                                    const sa = subAreasById.get(mObj?.subAreaId);
                                                                    const saName = sa ? (typeof sa.name === 'string' ? sa.name : sa.name?.fr || sa.name?.en || "") : "";
                                                                    return (
                                                                        <span className="text-caption font-black text-success/70 uppercase tracking-widest italic truncate max-w-[150px]">
                                                                            {saName ? `${saName} · ` : ""} [{mObj?.x || 0}, {mObj?.y || 0}]
                                                                        </span>
                                                                    );
                                                                }
                                                                return null;
                                                            })()}
                                                        </div>
                                                        <div className="flex-1 min-h-[120px] sm:min-h-[200px] bg-surface rounded-[1.5rem] sm:rounded-[2rem] border border-border overflow-hidden shadow-2xl relative group">
                                                            {(() => {
                                                                const me = activeSession.participants?.find((p: any) =>
                                                                    String(p.userId) === String(currentUserId) ||
                                                                    (currentUserIdRef.current && String(p.userId) === String(currentUserIdRef.current))
                                                                );
                                                                const bestGuess = guessResult?.guess || me?.lastGuess;
                                                                const mId = bestGuess?.mapId;

                                                                if (mId) {
                                                                    // #182 fix: si la map cliquée est souterraine (outdoor=false),
                                                                    // on cherche une map outdoor aux mêmes coordonnées pour l'image HD
                                                                    const mObj = allMapsById.get(Number(mId));
                                                                    let displayMapId = Number(mId);
                                                                    if (mObj && !mObj.outdoor) {
                                                                        // Cherche une map outdoor à la même position (x, y, worldMap)
                                                                        for (const [id, m] of allMapsById) {
                                                                            if (m.outdoor && m.x === mObj.x && m.y === mObj.y && m.worldMap === mObj.worldMap) {
                                                                                displayMapId = id;
                                                                                break;
                                                                            }
                                                                        }
                                                                    }
                                                                    return <img
                                                                        src={`/game-data/hd_maps/${displayMapId}.webp`}
                                                                        className="w-full h-full object-cover transition-transform group- duration-300"
                                                                        alt="Ton choix"
                                                                        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                                                                    />;
                                                                } else if (bestGuess) {
                                                                    return (
                                                                        <div className="w-full h-full flex items-center justify-center flex-col gap-4 bg-background/50">
                                                                            <div className="w-12 h-12 rounded-full border-2 border-success/20 flex items-center justify-center">
                                                                                <MapIcon className="text-success/50" size={24} />
                                                                            </div>
                                                                            <div className="text-center">
                                                                                <span className="text-caption uppercase font-black italic tracking-widest text-success/50">Position Validée</span>
                                                                                <p className="text-caption font-mono text-muted-foreground mt-1">[{bestGuess.x}, {bestGuess.y}]</p>
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                } else {
                                                                    return (
                                                                        <div className="w-full h-full flex items-center justify-center flex-col gap-4 text-foreground/10">
                                                                            <div className="w-12 h-12 rounded-full border-2 border-dashed border-border flex items-center justify-center">
                                                                                <div className="w-2 h-2 rounded-full bg-surface" />
                                                                            </div>
                                                                            <span className="text-caption uppercase font-black italic tracking-widest">Aucune décision prise</span>
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
                                                            <div className="text-caption font-black text-danger/60 uppercase tracking-[0.2em] italic flex items-center gap-2">
                                                                <div className="w-1.5 h-1.5 rounded-full bg-danger " />
                                                                La Solution
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                {(() => {
                                                                    const cRound = activeSession.currentRound || 1;
                                                                    const tId = activeSession.currentMapId || (activeSession.targetMapIds && activeSession.targetMapIds[cRound - 1]);
                                                                    const targetMapObj = allMapsById.get(Number(tId));
                                                                    const subArea = targetMapObj ? subAreasById.get(targetMapObj.subAreaId) : null;
                                                                    const subAreaName = subArea ? (typeof subArea.name === 'string' ? subArea.name : subArea.name?.fr || subArea.name?.en || "") : "Zone Inconnue";
                                                                    
                                                                    return (
                                                                        <>
                                                                            <span className="text-caption font-black text-danger uppercase tracking-widest italic bg-danger/10 px-2 py-0.5 rounded-md border border-danger/20">
                                                                                [{targetMapObj?.x || 0}, {targetMapObj?.y || 0}]
                                                                            </span>
                                                                            <span className="text-caption font-black text-danger/60 uppercase tracking-widest italic">
                                                                                {subAreaName}
                                                                            </span>
                                                                        </>
                                                                    );
                                                                })()}
                                                            </div>
                                                        </div>
                                                        <div className="flex-1 min-h-[120px] sm:min-h-[200px] bg-surface rounded-[1.5rem] sm:rounded-[2rem] border border-danger/20 overflow-hidden shadow-2xl relative group ring-1 ring-danger/10">
                                                            {activeSession.state !== 'IN_PROGRESS' ? (
                                                                <>
                                                                    <button
                                                                        onClick={() => {
                                                                            const cRound = activeSession.currentRound || 1;
                                                                            const mId = activeSession.currentMapId || (activeSession.targetMapIds && activeSession.targetMapIds[cRound - 1]);
                                                                            if (socket && mId) {
                                                                                const numId = Number(mId);
                                                                                if (reportedMapsRef.current.has(numId)) {
                                                                                    toast.error("Cette carte a déjà été signalée.");
                                                                                    return;
                                                                                }
                                                                                reportedMapsRef.current.add(numId);
                                                                                socket.emit('geoguesser:map:report', { mapId: numId });
                                                                                toast.success("Carte signalée !");
                                                                            }
                                                                        }}
                                                                        className="absolute top-4 right-4 z-[500] flex items-center gap-2 px-4 py-2 rounded-xl bg-danger hover:bg-danger text-danger-foreground font-black uppercase tracking-widest italic text-caption border border-danger/50 shadow-[0_10px_30px_rgba(244,63,94,0.3)] transition-all active:scale-95 group"
                                                                    >
                                                                        <Flag size={12} className="group-hover:rotate-12 transition-transform" />
                                                                        Signaler cette Map
                                                                    </button>
                                                                    <img
                                                                        src={`/game-data/hd_maps/${targetMapId}.webp`}
                                                                        className="w-full h-full object-cover transition-transform group- duration-300"
                                                                        alt="Solution"
                                                                    />
                                                                    <div className="absolute inset-0 bg-danger/5 pointer-events-none" />
                                                                    <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-danger/40 to-transparent pointer-events-none" />
                                                                    {/* Watermark mask for solution preview */}
                                                                    <div className="absolute bottom-0 right-0 w-28 h-10 bg-gradient-to-tl from-black/95 via-black/60 to-transparent rounded-br-2xl pointer-events-none z-10" />
                                                                </>
                                                            ) : (
                                                                <div className="w-full h-full flex flex-col items-center justify-center gap-4 bg-background/50 backdrop-blur-sm px-6">
                                                                    <div className="w-12 h-12 border-4 border-danger/20 border-t-danger rounded-full animate-spin" />
                                                                    <p className="text-danger/50 text-caption font-black uppercase italic tracking-widest text-center">
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

                                    {/* Right Side: Leaderboard & Geographic Analysis */}
                                    <div className="w-full lg:w-[450px] xl:w-[550px] flex flex-col pt-2 lg:pt-0 gap-6">
                                        {(() => {
                                            const currentRound = activeSession.currentRound || 1;
                                            const targetId = activeSession.currentMapId || (activeSession.targetMapIds && activeSession.targetMapIds[currentRound - 1]);
                                            const targetMap = allMapsById.get(Number(targetId));
                                            const targetWorldId = targetMap?.worldMap || 1;
                                            const targetWorld = worldMap.worlds?.find(w => w.id === targetWorldId);
                                            const worldMaps = worldMap.maps?.filter(m => m.worldMap === targetWorldId) || [];
                                            
                                            // Get me for the personal line drawing
                                            const me = activeSession.participants?.find((p: any) => String(p.userId) === String(currentUserId));
                                            const myGuess = guessResult?.guess || me?.lastGuess;

                                            return (
                                                <div className="h-[350px] xl:h-[450px] shrink-0 bg-surface rounded-[2.5rem] border border-border overflow-hidden relative group shadow-2xl">
                                                    {targetWorld && (
                                                        <LeafletMapCore
                                                            activeWorld={targetWorld}
                                                            selectedWorldId={targetWorldId}
                                                            activeMaps={worldMaps}
                                                            mapsByCoords={new Map()} 
                                                            subAreasById={subAreasById}
                                                            dungeonsByMapId={dungeonsByMapId}
                                                            groupedDungeons={[]}
                                                            showDebugGrid={false}
                                                            selectedPosition={null}
                                                            setSelectedPosition={() => {}}
                                                            setSelectedDungeon={() => {}}
                                                            isMiniMap={true}
                                                            guessResult={{ 
                                                                target: targetMap,
                                                                guess: myGuess
                                                            }}
                                                            participants={activeSession.participants}
                                                            currentUserId={currentUserId}
                                                            isSpectator={true}
                                                            hideUI={true}
                                                            interactive={false}
                                                        />
                                                    )}
                                                    
                                                    {/* Legend Overlay for the map */}
                                                    <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />
                                                    <div className="absolute top-4 left-4 z-[1000] flex items-center gap-2 px-3 py-1.5 bg-black/60 backdrop-blur-md rounded-xl border border-border">
                                                        <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                                                        <span className="text-caption font-black text-muted-foreground uppercase italic tracking-widest">Analyse Géographique</span>
                                                    </div>
                                                    
                                                    <div className="absolute bottom-4 left-4 z-[1000] flex items-center gap-3">
                                                        <div className="flex items-center gap-1.5">
                                                            <div className="w-2 h-2 rounded-full bg-danger" />
                                                            <span className="text-caption font-black text-muted-foreground uppercase italic">Solution</span>
                                                        </div>
                                                        <div className="flex items-center gap-1.5">
                                                            <div className="w-2 h-2 rounded-full bg-success" />
                                                            <span className="text-caption font-black text-muted-foreground uppercase italic">Ton Choix</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })()}

                                        <div className="flex flex-col flex-1 min-h-0 bg-surface border border-border rounded-3xl p-4">
                                            <div className="flex items-center justify-between mb-5 px-4 shrink-0">
                                                <div className="text-muted-foreground text-caption font-black uppercase tracking-widest italic">Classement Round</div>
                                                <div className="px-3 py-1 bg-elevated rounded-lg text-muted-foreground text-caption font-black italic tracking-widest">
                                                    {activeSession.participants?.filter((p: any) => !p.isSpectator).length} / 8 JOUEURS
                                                </div>
                                            </div>

                                            <div className="flex-1 space-y-3 overflow-y-auto pr-2 custom-scrollbar">
                                            {activeSession.participants?.filter((p: any) => !p.isSpectator).sort((a: any, b: any) => (b.lastGuess?.score || 0) - (a.lastGuess?.score || 0)).map((p: any, i: number) => {
                                                const dist = p.lastGuess?.distance ? Math.round(p.lastGuess.distance) : null;
                                                const isMe = p.userId === currentUserId;
                                                return (
                                                    <motion.div
                                                        initial={{ opacity: 0, x: 20 }}
                                                        animate={{ opacity: 1, x: 0 }}
                                                        transition={{ delay: i * 0.05 }}
                                                        key={p.userId}
                                                        className={`flex items-center justify-between p-4 rounded-3xl border transition-all ${isMe ? 'bg-success/10 border-success/30 shadow-[0_10px_30px_rgba(16,185,129,0.05)]' : 'bg-surface border-border hover:bg-surface'}`}
                                                    >
                                                        <div className="flex items-center gap-4">
                                                            <div className="relative shrink-0">
                                                                <div className="w-12 h-12 rounded-2xl bg-surface border border-border flex items-center justify-center overflow-hidden">
                                                                    {p.userAvatar ? (
                                                                        <img src={p.userAvatar} alt="" className="w-full h-full object-cover" />
                                                                    ) : (
                                                                        <div className="w-full h-full bg-elevated flex items-center justify-center text-foreground/10 font-black text-caption uppercase">
                                                                            {p.userName?.charAt(0)}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                                <div className={`absolute -top-1.5 -left-1.5 w-6 h-6 rounded-lg flex items-center justify-center text-caption font-black italic shadow-2xl z-10 ${i === 0 ? 'bg-warning text-warning-foreground shadow-warning/30' : i === 1 ? 'bg-surface text-warning-foreground' : i === 2 ? 'bg-warning text-warning-foreground' : 'bg-surface text-warning-foreground/40'}`}>
                                                                    {i + 1}
                                                                </div>
                                                            </div>

                                                            <div className="flex flex-col min-w-0">
                                                                <span className={`text-xs font-black uppercase tracking-tight italic truncate max-w-[120px] ${isMe ? 'text-success' : 'text-foreground/80'}`}>
                                                                    {p.userName}
                                                                </span>
                                                                <div className="flex items-center gap-2">
                                                                    {dist !== null ? (
                                                                        <span className="text-caption font-black text-warning italic leading-none">{dist} <span className="text-caption opacity-40 uppercase">Maps</span></span>
                                                                    ) : (
                                                                        <span className="text-caption font-black text-foreground/10 uppercase tracking-widest italic">Absent</span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <div className="flex flex-col items-end gap-0.5">
                                                            <div className="flex items-center gap-2">
                                                                <span className={`font-black text-2xl italic leading-none ${isMe ? 'text-success' : 'text-foreground'} ${(p.lastGuess?.score || 0) > 4000 ? 'text-warning drop-shadow-[0_0_10px_rgba(251,191,36,0.2)]' : ''}`}>
                                                                    +{p.lastGuess?.score || 0}
                                                                </span>
                                                                {i === 0 && <img src="/assets/dofus/game-icons/crown.png" alt="1er" className="w-3.5 h-3.5 object-contain" />}
                                                            </div>
                                                            {p.lastGuess?.mapId && (
                                                                <span className="text-caption font-black text-muted-foreground uppercase tracking-[0.1em] italic truncate max-w-[90px]">
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
                            className="absolute inset-0 z-[2000] bg-background/90 backdrop-blur-xl flex items-center justify-center p-4 md:p-8 overflow-y-auto"
                        >
                            <motion.div
                                initial={{ scale: 0.9, y: 20 }}
                                animate={{ scale: 1, y: 0 }}
                                className="max-w-2xl w-full bg-elevated border border-border rounded-3xl md:rounded-[3rem] p-6 md:p-12 shadow-[0_50px_100px_rgba(0,0,0,0.8)] flex flex-col items-center my-auto"
                            >
                                <div className="w-16 h-16 md:w-24 md:h-24 rounded-[1.5rem] md:rounded-[2rem] bg-info/5 flex items-center justify-center mb-4 md:mb-8 shrink-0">
                                    <img src="/assets/dofus/game-icons/trophy-1.png" alt="Partie terminée" className="w-10 h-10 md:w-14 md:h-14 object-contain" />
                                </div>

                                <h2 className="text-foreground font-black text-2xl md:text-5xl uppercase italic tracking-tighter mb-2 text-center">Partie Terminée</h2>
                                <p className="text-muted-foreground font-black uppercase tracking-widest text-caption md:text-caption mb-6 md:mb-12 italic">Stats Globales SigilGuesser</p>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8 w-full mb-6 md:mb-12">
                                    <div className="p-4 md:p-8 rounded-[1.5rem] md:rounded-[2rem] bg-info/5 border border-info/10 flex flex-col items-center">
                                        <span className="text-info text-caption md:text-caption font-black uppercase tracking-widest mb-1 md:mb-2">Score Total</span>
                                        <span className="text-foreground font-black text-2xl md:text-4xl italic tracking-tight">{score}</span>
                                    </div>
                                    <div className="p-4 md:p-8 rounded-[1.5rem] md:rounded-[2rem] bg-success/5 border border-success/10 flex flex-col items-center">
                                        <span className="text-success text-caption md:text-caption font-black uppercase tracking-widest mb-1 md:mb-2">Résultat</span>
                                        <span className="text-foreground font-black text-2xl md:text-4xl italic tracking-tight">Fin</span>
                                    </div>
                                </div>

                                <div className="w-full space-y-3 mb-12 max-h-60 overflow-y-auto pr-2 scrollbar-hide">
                                    {activeSession.participants?.filter((p: any) => !p.isSpectator).sort((a: any, b: any) => b.score - a.score).map((p: any, i: number) => (
                                        <div key={p.userId} className={`flex items-center gap-4 p-4 rounded-2xl border ${p.userId === currentUserId ? 'bg-info/10 border-info/30' : 'bg-surface border-border'}`}>
                                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black italic ${i === 0 ? 'bg-warning text-warning-foreground' : i === 1 ? 'bg-surface text-warning-foreground' : i === 2 ? 'bg-warning text-warning-foreground' : 'bg-surface text-warning-foreground/40'}`}>
                                                {i + 1}
                                            </div>
                                            <div className="w-10 h-10 rounded-xl bg-surface border border-border flex items-center justify-center overflow-hidden">
                                                {p.userAvatar ? (
                                                    <img src={p.userAvatar} alt="" className="w-full h-full object-cover" />
                                                ) : (
                                                    <span className="text-muted-foreground font-bold text-xs">?</span>
                                                )}
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-foreground font-black text-xs uppercase italic">{p.userName}</span>
                                            </div>
                                            <div className="ml-auto text-foreground font-black italic">{p.score} <span className="text-caption text-muted-foreground font-normal">pts</span> </div>
                                        </div>
                                    ))}
                                </div>

                                <div className="flex gap-4">
                                    <button
                                        onClick={handleReplay}
                                        className="px-10 py-5 rounded-2xl bg-success text-success-foreground font-black uppercase text-sm italic shadow-2xl shadow-success/20 hover:scale-[1.05] transition-all active:scale-[0.98] flex items-center gap-2"
                                    >
                                        <RotateCcw size={18} />
                                        Rejouer
                                    </button>
                                    <button
                                        onClick={handleLeaveSession}
                                        className="px-10 py-5 rounded-2xl bg-info text-info-foreground font-black uppercase text-sm italic shadow-2xl shadow-info/20 hover:scale-[1.05] transition-all active:scale-[0.98]"
                                    >
                                        Retour au Menu
                                    </button>
                                </div>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Global Modals */}
                <AnimatePresence>
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
                            worldId={selectedWorldId}
                        />
                    )}

                    {selectedDungeon && (
                        <DungeonDetailModal
                            isOpen={!!selectedDungeon}
                            onClose={() => setSelectedDungeon(null)}
                            dungeons={selectedDungeon}
                            guildId={guildId}
                        />
                    )}
                </AnimatePresence>

                {/* --- GAMES TAB --- */}
                {activeTab === 'games' && !activeSession && gamePhase === 'idle' && (
                    <div className="absolute inset-0 bg-background/95 backdrop-blur-xl z-[500] overflow-y-auto pt-8 md:pt-12 pb-20 scrollbar-hide">
                        {/* Background Decorative Elements */}
                        <div className="absolute top-0 left-0 w-full h-64 bg-gradient-to-b from-success/5 to-transparent pointer-events-none" />
                        <div className="absolute top-1/4 -left-20 w-80 h-80 bg-success/10 rounded-full blur-[120px] pointer-events-none" />
                        <div className="absolute top-1/2 -right-20 w-80 h-80 bg-info/10 rounded-full blur-[120px] pointer-events-none" />

                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="p-4 md:p-6 lg:p-8 max-w-[1600px] mx-auto space-y-6 lg:space-y-10 relative"
                        >
                            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 md:ml-10">
                                <div className="flex flex-col gap-1.5">
                                    <h2 className="text-foreground font-black text-2xl md:text-3xl lg:text-4xl uppercase italic tracking-tighter flex items-center gap-3 lg:gap-4 leading-tight">
                                        <div className="w-6 lg:w-8 h-1 bg-gradient-to-r from-info to-transparent rounded-full shrink-0" />
                                        L'Arène des Sigils
                                    </h2>
                                    <p className="text-muted-foreground text-caption md:text-xs font-medium uppercase tracking-widest leading-relaxed max-w-2xl">
                                        Défiez vos alliés dans des épreuves légendaires.
                                    </p>
                                </div>

                                {/* Games Sub-Tabs Selector */}
                                <div className="flex p-1.5 bg-surface border border-border rounded-2xl md:min-w-[340px] shadow-xl backdrop-blur-xl">
                                    <button
                                        onClick={() => setGamesSubTab('arena')}
                                        className={cn(
                                            "flex-1 px-6 py-3 rounded-xl text-caption font-black uppercase italic tracking-widest transition-all gap-2 flex items-center justify-center",
                                            gamesSubTab === 'arena' 
                                                ? "bg-success text-success-foreground shadow-lg shadow-success/20" 
                                                : "text-foreground/70 hover:text-foreground hover:bg-elevated"
                                        )}
                                    >
                                        <Rocket size={14} className={cn("transition-transform", gamesSubTab === 'arena' && "animate-bounce-subtle")} />
                                        Jeux & Salons
                                    </button>
                                    <button
                                        onClick={() => setGamesSubTab('ladder')}
                                        className={cn(
                                            "flex-1 px-6 py-3 rounded-xl text-caption font-black uppercase italic tracking-widest transition-all gap-2 flex items-center justify-center",
                                            gamesSubTab === 'ladder' 
                                                ? "bg-warning text-warning-foreground shadow-lg shadow-warning/20" 
                                                : "text-foreground/70 hover:text-foreground hover:bg-elevated"
                                        )}
                                    >
                                        <Trophy size={14} className={cn("transition-transform", gamesSubTab === 'ladder' && "animate-bounce-subtle")} />
                                        Panthéon
                                    </button>
                                </div>
                            </div>

                            {gamesSubTab === 'arena' ? (
                                <>
                                    {/* --- LOBBIES SECTION (MOVED TO TOP FOR UI/UX) --- */}
                                    <div className="md:ml-10">
                                <div className="flex items-center gap-4 mb-4 lg:mb-6">
                                    <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
                                    <h4 className="text-muted-foreground font-black uppercase text-xs tracking-[0.2em]">Salons en attente de joueurs</h4>
                                    <div className="flex-1 h-px bg-border" />
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 lg:gap-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                                    {(availableSessions.length === 0 && bombRooms.length === 0) ? (
                                        <div className="col-span-full h-16 lg:h-20 flex items-center justify-center border border-dashed border-border rounded-2xl bg-surface/60 text-muted-foreground italic font-black uppercase text-caption tracking-[0.2em] text-center px-4">
                                            Aucun salon actif • Créez le vôtre pour commencer
                                        </div>
                                    ) : (
                                        <>
                                            {availableSessions.map(room => (
                                                <div key={room.id} className="p-4 bg-surface border border-success/10 rounded-xl flex items-center justify-between group/lobby hover:bg-success/5 transition-all">
                                                    <div className="flex flex-col min-w-0 pr-2">
                                                        <span className="text-foreground font-bold text-xs uppercase italic truncate">{room.hostName}</span>
                                                        <span className="text-success/40 text-caption font-black uppercase mt-0.5 whitespace-nowrap">Guesser • {room.playerCount}/8</span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        {room.state === 'IN_PROGRESS' || room.state === 'COUNTDOWN' ? (
                                                             <div className="px-3 lg:px-4 py-1.5 lg:py-2 rounded-lg bg-success/10 border border-success/20 text-success/50 font-black uppercase text-caption cursor-not-allowed italic">
                                                                 En cours
                                                             </div>
                                                         ) : room.state === 'RESULT' || room.state === 'FINISHED' ? (
                                                             <div className="px-3 lg:px-4 py-1.5 lg:py-2 rounded-lg bg-warning/10 border border-warning/20 text-warning/50 font-black uppercase text-caption cursor-not-allowed italic">
                                                                 Fini
                                                             </div>
                                                         ) : (
                                                            <button 
                                                                onClick={() => handleJoinRoom(room)} 
                                                                disabled={joiningId === room.id}
                                                                className="px-3 lg:px-4 py-1.5 lg:py-2 rounded-lg bg-success text-success-foreground font-black uppercase text-caption shadow-md shadow-success/20 opacity-90 hover:opacity-100 transition-all disabled:opacity-50"
                                                            >
                                                                {joiningId === room.id ? <Loader2 className="w-3 h-3 animate-spin" /> : "Rejoindre"}
                                                            </button>
                                                        )}
                                                        <button 
                                                            onClick={() => handleJoinRoom(room, true)} 
                                                            disabled={joiningId === room.id}
                                                            className="px-2 lg:px-3 py-1.5 lg:py-2 rounded-lg bg-surface text-foreground/80 hover:bg-elevated hover:text-foreground font-black uppercase text-caption transition-all"
                                                        >
                                                            Regarder
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                            {bombRooms.map(room => (
                                                <div key={room.roomId} className="p-4 bg-surface border border-danger/10 rounded-xl flex items-center justify-between group/lobby hover:bg-danger/5 transition-all">
                                                    <div className="flex flex-col min-w-0 pr-2">
                                                        <span className="text-foreground font-bold text-xs uppercase italic truncate">{room.roomId}</span>
                                                        <span className="text-danger/40 text-caption font-black uppercase mt-0.5 whitespace-nowrap">Bomb • {room.playerCount}/8</span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        {room.state !== 'LOBBY' ? (
                                                            <div className="px-3 lg:px-4 py-1.5 lg:py-2 rounded-lg bg-danger/10 border border-danger/20 text-danger/50 font-black uppercase text-caption cursor-not-allowed italic">
                                                                Lancé
                                                            </div>
                                                        ) : (
                                                            <a href={`/dashboard/${guildId}/mini-jeux/sigil-bomb?room=${room.roomId}`} className="px-3 lg:px-4 py-1.5 lg:py-2 rounded-lg bg-danger text-danger-foreground font-black uppercase text-caption shadow-md shadow-red-600/20 opacity-90 hover:opacity-100 transition-all text-center">Rejoindre</a>
                                                        )}
                                                        <a href={`/dashboard/${guildId}/mini-jeux/sigil-bomb?room=${room.roomId}&spectate=true`} className="px-2 lg:px-3 py-1.5 lg:py-2 rounded-lg bg-surface text-foreground/80 hover:bg-elevated hover:text-foreground font-black uppercase text-caption transition-all text-center">Regarder</a>
                                                    </div>
                                                </div>
                                            ))}
                                        </>
                                    )}
                                </div>
                            </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto w-full items-stretch mt-4">

                                    {/* Geoguesser Card */}
                                    <motion.div
                                        whileHover={getGameStatus('guesser').isEnabled ? { y: -3 } : {}}
                                        className={cn(
                                            "group relative bg-surface/90 backdrop-blur-2xl border rounded-2xl p-6 md:p-8 flex flex-col transition-all shadow-xl overflow-hidden h-full",
                                            getGameStatus('guesser').isEnabled 
                                                ? "hover:border-success/50 hover:bg-surface border-border" 
                                                : "border-danger/20 grayscale opacity-70"
                                        )}
                                    >
                                        <div className="absolute top-0 right-0 w-36 h-36 bg-success/5 rounded-full blur-[60px] group-hover:bg-success/10 transition-all duration-300" />

                                        <div className="relative z-10 flex flex-col h-full justify-between">
                                            <div>
                                                <div className="flex items-start justify-between mb-6">
                                                    <div className="w-14 h-14 md:w-16 md:h-16 rounded-xl bg-success/10 flex items-center justify-center border border-success/20 group- transition-all duration-300">
                                                        <Target className="text-success w-7 h-7 md:w-8 md:h-8" strokeWidth={2.2} />
                                                    </div>
                                                    <div className="px-3 py-1 rounded-lg bg-success/10 border border-success/20 text-success text-caption font-extrabold uppercase tracking-wider">
                                                        {getGameStatus('guesser').isEnabled ? 'EXPLORATION' : 'MAINTENANCE'}
                                                    </div>
                                                </div>

                                                <h3 className="text-foreground font-black text-2xl md:text-3xl uppercase tracking-tight mb-1 group-hover:text-success transition-colors">Sigil-Guesser</h3>
                                                <div className="mb-4">
                                                    <span className="text-success/70 text-xs font-bold uppercase tracking-wider">"Où suis-je ? Le Zaap est cassé !"</span>
                                                </div>
                                                <p className="text-muted-foreground text-xs md:text-sm font-medium leading-relaxed mb-6">
                                                    {getGameStatus('guesser').isEnabled 
                                                        ? "Un mystérieux incident de Zaap vous a projeté dans l'inconnu. Saurez-vous identifier ce fragment du Monde des Douze pour retrouver votre chemin ?"
                                                        : getGameStatus('guesser').message}
                                                </p>
                                            </div>

                                            <div className="space-y-3 mt-auto">
                                                {getGameStatus('guesser').isEnabled ? (
                                                    <>
                                                        <button
                                                            onClick={handleCreateRoom}
                                                            disabled={isCreating || joiningId !== null}
                                                            className="w-full py-3.5 rounded-xl bg-success hover:bg-success text-success-foreground font-bold uppercase text-xs tracking-wider shadow-lg shadow-success/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50 active:scale-95"
                                                        >
                                                            {isCreating ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Plus size={16} /> Créer un Salon</>}
                                                        </button>
                                                        <button
                                                            onClick={handleSoloMode}
                                                            className="w-full py-3.5 rounded-xl bg-elevated text-foreground font-bold uppercase text-xs tracking-wider border border-border hover:bg-elevated hover:text-foreground transition-all flex items-center justify-center gap-2 active:scale-95"
                                                        >
                                                            <Compass size={16} /> Jouer Solo
                                                        </button>
                                                    </>
                                                ) : (
                                                    <div className="w-full py-3.5 rounded-xl bg-danger/10 border border-danger/30 text-danger text-center text-xs font-bold uppercase tracking-wider">
                                                        Indisponible
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </motion.div>

                                    {/* Sigil-Bomb Card */}
                                    <motion.div
                                        whileHover={getGameStatus('bomb').isEnabled ? { y: -3 } : {}}
                                        className={cn(
                                            "group relative bg-surface/90 backdrop-blur-2xl border rounded-2xl p-6 md:p-8 flex flex-col transition-all shadow-xl overflow-hidden h-full",
                                            getGameStatus('bomb').isEnabled 
                                                ? "hover:border-danger/50 hover:bg-surface border-border" 
                                                : "border-danger/20 grayscale opacity-70"
                                        )}
                                    >
                                        <div className="absolute top-0 right-0 w-36 h-36 bg-danger/5 rounded-full blur-[60px] group-hover:bg-danger/10 transition-all duration-300" />
                                        
                                        <div className="relative z-10 flex flex-col h-full justify-between">
                                            <div>
                                                <div className="flex items-start justify-between mb-6">
                                                    <div className="w-14 h-14 md:w-16 md:h-16 rounded-xl bg-danger/10 flex items-center justify-center border border-danger/20 group- transition-all duration-300">
                                                        <Bomb className="text-danger w-7 h-7 md:w-8 md:h-8" />
                                                    </div>
                                                    <div className="px-3 py-1 rounded-lg bg-danger/10 border border-danger/20 text-danger text-caption font-extrabold uppercase tracking-wider">
                                                        {getGameStatus('bomb').isEnabled ? 'ACTION' : 'MAINTENANCE'}
                                                    </div>
                                                </div>

                                                <h3 className="text-foreground font-black text-2xl md:text-3xl uppercase tracking-tight mb-1 group-hover:text-danger transition-colors">Sigil-Bomb</h3>
                                                <div className="mb-4">
                                                    <span className="text-danger/70 text-xs font-bold uppercase tracking-wider">"L'art explosif des Roublards"</span>
                                                </div>
                                                <p className="text-muted-foreground text-xs md:text-sm font-medium leading-relaxed mb-6">
                                                    {getGameStatus('bomb').isEnabled 
                                                        ? "Trouvez les mots imposés par la Reine avant que sa bombe n'explose. Un duel de vocabulaire explosif dans la Dimension Sram !"
                                                        : getGameStatus('bomb').message}
                                                </p>
                                            </div>

                                            <div className="space-y-3 mt-auto">
                                                {getGameStatus('bomb').isEnabled ? (
                                                    <a 
                                                        href={`/dashboard/${guildId}/mini-jeux/sigil-bomb`}
                                                        className="w-full py-3.5 rounded-xl bg-danger hover:bg-danger text-danger-foreground font-bold uppercase text-xs tracking-wider shadow-lg shadow-red-600/20 transition-all flex items-center justify-center gap-2 text-center active:scale-95"
                                                    >
                                                        <Plus size={16} /> Créer un Salon
                                                    </a>
                                                ) : (
                                                    <div className="w-full py-3.5 rounded-xl bg-danger/10 border border-danger/30 text-danger text-center text-xs font-bold uppercase tracking-wider">
                                                        Indisponible
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </motion.div>

                                    </div>
                                </>
                            ) : (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.98 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    className="md:ml-10 bg-[#0a0f18]/80 backdrop-blur-3xl border border-border rounded-[2.5rem] p-8 flex flex-col shadow-2xl relative overflow-hidden min-h-[600px]"
                                >
                                    <div className="absolute top-0 right-0 w-64 h-64 bg-warning/5 rounded-full blur-[150px] pointer-events-none" />

                                    <div className="flex flex-col md:flex-row items-center justify-between gap-6 mb-10 pb-10 border-b border-border">
                                        <div className="flex flex-col">
                                            <h3 className="text-foreground font-black text-3xl md:text-4xl uppercase italic tracking-tighter mb-2">L'Élite des Sigils</h3>
                                            <div className="px-4 py-1.5 rounded-full bg-warning/10 border border-warning/20 flex items-center justify-center gap-2 self-start">
                                                <Trophy size={14} className="text-warning" />
                                                <span className="text-warning text-caption font-black uppercase tracking-widest">Hall of Fame</span>
                                            </div>
                                        </div>

                                        <div className="flex gap-2 p-1.5 bg-black/40 rounded-2xl border border-border">
                                            <button
                                                onClick={() => setLadderGame('guesser')}
                                                className={cn(
                                                    "px-6 py-2.5 rounded-xl text-xs font-black uppercase italic transition-all flex items-center gap-2",
                                                    ladderGame === 'guesser' 
                                                        ? "bg-success text-success-foreground shadow-lg shadow-success/20" 
                                                        : "text-muted-foreground hover:text-foreground"
                                                )}
                                            >
                                                <Target size={14} />
                                                Guesser
                                            </button>
                                            <button
                                                onClick={() => setLadderGame('bomb')}
                                                className={cn(
                                                    "px-6 py-2.5 rounded-xl text-xs font-black uppercase italic transition-all flex items-center gap-2",
                                                    ladderGame === 'bomb' 
                                                        ? "bg-danger text-danger-foreground shadow-lg shadow-danger/20" 
                                                        : "text-muted-foreground hover:text-foreground"
                                                )}
                                            >
                                                <Bomb size={14} />
                                                Bomb
                                            </button>
                                        </div>

                                        <div className="flex gap-2 p-1.5 bg-black/40 rounded-2xl border border-border">
                                            <button
                                                onClick={() => setLadderType('all_time')}
                                                className={cn(
                                                    "px-6 py-2.5 rounded-xl text-caption font-black uppercase transition-all",
                                                    ladderType === 'all_time' ? 'bg-elevated text-foreground' : 'text-muted-foreground hover:text-foreground'
                                                )}
                                            >
                                                Général
                                            </button>
                                            <button
                                                onClick={() => setLadderType('month')}
                                                className={cn(
                                                    "px-6 py-2.5 rounded-xl text-caption font-black uppercase transition-all",
                                                    ladderType === 'month' ? 'bg-elevated text-foreground' : 'text-muted-foreground hover:text-foreground'
                                                )}
                                            >
                                                Mensuel
                                            </button>
                                        </div>
                                    </div>

                                     <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6 overflow-y-auto pr-2 custom-scrollbar flex-1 pb-10">
                                         {isLoadingLadder ? (
                                            <div className="col-span-full h-64 flex flex-col items-center justify-center text-muted-foreground font-black uppercase text-sm animate-pulse gap-4">
                                                <div className="w-12 h-12 border-4 border-warning/20 border-t-warning rounded-full animate-spin" />
                                                Chargement du Panthéon...
                                            </div>
                                        ) : ladder.length > 0 ? (
                                            ladder.map((entry, index) => (
                                                <motion.div 
                                                    initial={{ opacity: 0, y: 10 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    transition={{ delay: index * 0.05 }}
                                                    key={entry.userId || entry.id} 
                                                    className={cn(
                                                        "p-6 rounded-[2rem] flex items-center justify-between group transition-all relative overflow-hidden",
                                                        index === 0 
                                                            ? "bg-gradient-to-br from-warning/20 to-transparent border border-warning/30 shadow-[0_20px_40px_-10px_rgba(245,158,11,0.1)]" 
                                                            : "bg-surface border border-border hover:bg-surface hover:border-border"
                                                    )}
                                                >
                                                    <div className="flex items-center gap-5 min-w-0 pr-2">
                                                        <div className={cn(
                                                            "w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg italic shrink-0",
                                                            index === 0 ? "bg-warning text-warning-foreground shadow-xl shadow-warning/40" :
                                                            index === 1 ? "bg-surface text-foreground shadow-xl shadow-muted/20" :
                                                            index === 2 ? "bg-warning text-warning-foreground shadow-xl shadow-warning/20" :
                                                            "text-muted-foreground bg-surface border border-border"
                                                        )}>
                                                            {index === 0 ? <img src="/assets/dofus/game-icons/crown.png" alt="1er" className="w-5 h-5 object-contain" /> : index + 1}
                                                        </div>
                                                        <div className="flex flex-col min-w-0">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-foreground font-black text-sm uppercase italic truncate">{entry.userName}</span>
                                                                {index < 3 && <div className="w-1.5 h-1.5 rounded-full bg-warning animate-pulse shrink-0" />}
                                                            </div>
                                                            <span className="text-muted-foreground text-caption font-black uppercase tracking-[0.2em]">{ladderGame === 'guesser' ? 'Explorateur' : 'Artificier'}</span>
                                                        </div>
                                                    </div>
                                                    <div className="text-right shrink-0">
                                                        <div className={cn(
                                                            "font-black text-lg italic whitespace-nowrap",
                                                            index === 0 ? "text-warning" : "text-muted-foreground"
                                                        )}>
                                                            {entry.bestScore || 0} 
                                                            <span className="text-caption ml-1.5 opacity-40 not-italic">pts</span>
                                                        </div>
                                                    </div>
                                                </motion.div>
                                            ))
                                        ) : (
                                            <div className="col-span-full h-64 flex flex-col items-center justify-center text-foreground/5 font-black uppercase text-sm italic text-center p-10 gap-4">
                                                <Trophy size={48} className="opacity-10" />
                                                Le Panthéon est encore vide...
                                            </div>
                                        )}
                                    </div>
                                </motion.div>
                            )}
                        </motion.div>
                    </div>
                )}


                {/* --- ACTIVE SESSION LOBBY --- */}
                {activeSession && activeTab === 'games' && gamePhase === 'idle' && (
                    <div className="absolute inset-0 z-[950] bg-black/80 backdrop-blur-xl flex items-center justify-center p-4 md:p-6 overflow-hidden">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="max-w-6xl w-full h-full md:max-h-full md:aspect-video bg-elevated border border-border rounded-[2rem] md:rounded-[3rem] flex flex-col md:flex-row shadow-[0_50px_100px_rgba(0,0,0,0.8)] overflow-hidden relative"
                        >
                            {/* Lobby Sidebar */}
                            <div className="w-full md:w-80 h-1/2 md:h-full border-b md:border-b-0 md:border-r border-border p-6 md:p-10 bg-black/40 flex flex-col justify-between relative shrink-0">
                                <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-success/5 to-transparent pointer-events-none" />
                                <div className="relative z-10">
                                    <div className="flex items-center gap-3 mb-8">
                                        <div className="w-3 h-3 rounded-full bg-success " />
                                        <h2 className="text-foreground font-black text-3xl uppercase italic leading-none tracking-tight">Salon</h2>
                                    </div>

                                    {!isSoloMode && (
                                        <div className="mb-8">
                                            <span className="text-muted-foreground text-caption font-black uppercase tracking-[0.2em] block mb-3 pl-1">Invitation</span>
                                            <button
                                                onClick={() => {
                                                    const url = `${window.location.origin}${window.location.pathname}#mini-jeux`;
                                                    navigator.clipboard.writeText(url);
                                                    toast.success("Lien copié !");
                                                }}
                                                className="group flex items-center gap-3 px-5 py-4 rounded-2xl bg-surface border border-border hover:bg-elevated hover:border-success/30 transition-all w-full"
                                            >
                                                <Copy size={14} className="text-success" />
                                                <span className="text-muted-foreground font-bold text-caption uppercase truncate">Copié le lien</span>
                                            </button>
                                        </div>
                                    )}

                                    <div className="space-y-6 flex-1 overflow-y-auto pr-2 custom-scrollbar">
                                        <div className="flex flex-wrap gap-2">
                                            <div className="px-4 py-2 bg-success/10 border border-success/20 rounded-xl text-success text-caption font-black uppercase italic">
                                                {isSoloMode ? "Mode Solo" : `${activeSession.participants?.filter((p: any) => !p.isSpectator).length || 0} / 8 Joueurs`}
                                            </div>
                                            <div className="px-4 py-2 bg-info/10 border border-info/20 rounded-xl text-info text-caption font-black uppercase italic flex items-center gap-2">
                                                {(activeSession.gameMode === 'SPECIAL') ? 'Mode Spécial' : 'Mode Normal'}
                                                {(activeSession.gameMode === 'SPECIAL') && <Clock size={10} className="text-info" />}
                                            </div>
                                        </div>
                                        {activeSession.hostId === currentUserId && (
                                            <div className="space-y-6">
                                                <div className="pt-6 border-t border-border">
                                                    <span className="text-muted-foreground text-caption font-black uppercase tracking-[0.2em] block mb-4 pl-1">Rounds</span>
                                                    <div className="grid grid-cols-4 gap-2">
                                                        {[3, 5, 10, 20].map(r => (
                                                            <button
                                                                key={r}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    socket?.emit("geoguesser:room:settings", { maxRounds: r });
                                                                    setActiveSession({ ...activeSession, maxRounds: r });
                                                                }}
                                                                className={`py-2 rounded-xl text-caption font-black transition-colors ${activeSession.maxRounds === r ? 'bg-success text-success-foreground' : 'bg-surface text-foreground/70 hover:bg-elevated'}`}
                                                            >
                                                                {r}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                                <div className="pt-6 border-t border-border">
                                                    <span className="text-muted-foreground text-caption font-black uppercase tracking-[0.2em] block mb-4 pl-1">Mode de Jeu</span>
                                                    <div className="grid grid-cols-2 gap-2">
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                const m = 'NORMAL';
                                                                socket?.emit("geoguesser:room:settings", { gameMode: m });
                                                                setActiveSession({ ...activeSession, gameMode: m });
                                                            }}
                                                            className={`py-3 rounded-xl text-caption font-black uppercase transition-colors ${(!activeSession.gameMode || activeSession.gameMode === 'NORMAL') ? 'bg-info text-info-foreground' : 'bg-surface text-foreground/70 hover:bg-elevated'}`}
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
                                                            className={`py-3 rounded-xl text-caption font-black uppercase transition-colors ${activeSession.gameMode === 'SPECIAL' ? 'bg-info text-info-foreground' : 'bg-surface text-foreground/70 hover:bg-elevated'}`}
                                                        >
                                                            Spécial
                                                        </button>
                                                    </div>
                                                    {activeSession.gameMode === 'SPECIAL' && (
                                                        <motion.p
                                                            initial={{ opacity: 0, x: -10 }}
                                                            animate={{ opacity: 1, x: 0 }}
                                                            className="mt-4 text-caption text-warning font-black uppercase italic tracking-[0.2em] pl-1 flex items-center gap-2"
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

                                <div className="flex items-center gap-2 mt-6">
                                    <button
                                        onClick={handleLeaveSession}
                                        className="flex-1 py-5 rounded-2xl bg-danger/10 text-danger font-black uppercase text-caption italic hover:bg-danger hover:text-danger-foreground transition-all border border-danger/10 shadow-lg active:scale-95 flex items-center justify-center gap-2"
                                    >
                                        <LogOut size={14} />
                                        <span>{activeSession.hostId === currentUserId ? 'Dissoudre' : 'Quitter'}</span>
                                    </button>
                                </div>
                            </div>
 
                             {/* Player List */}
                            <div className="flex-1 p-6 lg:p-10 flex flex-col relative bg-background h-full overflow-hidden">
                                <div className="flex flex-col sm:flex-row items-center justify-between mb-6 gap-4 border-b border-border pb-6 shrink-0">
                                    <div className="flex flex-col w-full sm:w-auto">
                                        <h3 className="text-muted-foreground font-black uppercase text-caption tracking-widest">Participants connectés</h3>
                                        <div className="flex items-center gap-2 mt-1">
                                            <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                                            <span className="text-success/60 text-caption font-black uppercase tracking-widest italic">
                                                {activeSession.participants?.filter((p: any) => !p.isSpectator).length || 0} / 8 Places occupées
                                            </span>
                                        </div>
                                    </div>
                                    {((activeSession.hostId === currentUserId) || isSoloMode) && (
                                        <button
                                            onClick={handleStartRoomGame}
                                            disabled={!isSoloMode && (activeSession.participants?.filter((p: any) => !p.isSpectator).length || 0) < 2}
                                            className={cn(
                                                "w-full sm:w-auto px-10 py-4 rounded-2xl text-foreground font-black uppercase text-xs sm:text-sm italic shadow-[0_15px_30px_-5px_rgba(16,185,129,0.5)] transition-all active:scale-95 flex items-center justify-center gap-3 border shrink-0",
                                                (!isSoloMode && (activeSession.participants?.filter((p: any) => !p.isSpectator).length || 0) < 2)
                                                    ? "bg-elevated border-border opacity-50 cursor-not-allowed grayscale"
                                                    : "bg-success border-success hover:-translate-y-1 hover:shadow-[0_25px_45px_-5px_rgba(16,185,129,0.6)]"
                                            )}
                                        >
                                            <Play size={16} fill="currentColor" className="shrink-0" />
                                            <span className="truncate">{(!isSoloMode && (activeSession.participants?.filter((p: any) => !p.isSpectator).length || 0) < 2) ? "Attente de joueurs" : "Lancer l'Épreuve"}</span>
                                        </button>
                                    )}
                                </div>

                                {/* Spectators Section */}
                                {activeSession.participants?.filter((p: any) => p.isSpectator && p.isConnected).length > 0 && (
                                    <div className="mb-8 flex items-center gap-4 bg-success/5 border border-success/20 p-4 rounded-3xl animate-in fade-in slide-in-from-top-2 duration-300">
                                        <div className="flex flex-col shrink-0 pr-4 border-r border-success/10">
                                            <span className="text-success font-black uppercase text-caption tracking-widest mb-0.5 mt-0.5">
                                                En observation
                                            </span>
                                            <span className="text-success/40 text-caption font-bold uppercase italic whitespace-nowrap">
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
                                                    <div className="w-10 h-10 rounded-2xl border-2 border-background bg-surface flex items-center justify-center overflow-hidden  hover:-translate-y-1 transition-all z-10 hover:z-20 relative shadow-xl">
                                                        {s.userAvatar ? (
                                                            <img src={s.userAvatar} alt="" className="w-full h-full object-cover" />
                                                        ) : (
                                                            <span className="text-muted-foreground font-black text-caption uppercase italic">{s.userName?.[0] || 'S'}</span>
                                                        )}
                                                        <div className="absolute inset-0 bg-success/10" />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="flex-1 text-right">
                                            <span className="text-success/30 text-caption font-black uppercase italic tracking-tighter">Ils guettent vos faits et gestes...</span>
                                        </div>
                                    </div>
                                )}

                                <div className="flex-1 overflow-y-auto grid grid-cols-2 gap-4 auto-rows-max pr-4 custom-scrollbar">
                                    {activeSession.participants?.filter((p: any) => !p.isSpectator).map((p: any) => (
                                        <motion.div
                                            initial={{ opacity: 0, x: -10 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            key={p.id}
                                            className="p-6 rounded-[2.5rem] bg-surface border border-border flex items-center gap-5 hover:bg-surface hover:border-success/30 transition-all group"
                                        >
                                            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-success/20 to-success/5 flex items-center justify-center border border-success/20 group- transition-transform overflow-hidden">
                                                {p.userAvatar ? (
                                                    <img src={p.userAvatar} alt="" className="w-full h-full object-cover" />
                                                ) : (
                                                    <span className="text-success font-black text-lg italic">{p.userName?.[0]?.toUpperCase() || 'J'}</span>
                                                )}
                                            </div>
                                            <div className="flex flex-col">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-foreground font-black text-sm uppercase italic tracking-tight">{p.userName}</span>
                                                </div>
                                                {p.userId === activeSession.hostId && (
                                                    <span className="text-success text-caption font-black uppercase tracking-widest mt-1 flex items-center gap-2">
                                                        <Crown size={10} /> Maitre du Salon
                                                    </span>
                                                )}
                                            </div>
                                        </motion.div>
                                    ))}

                                    {(!isSoloMode && Array.from({ length: Math.max(0, 8 - (activeSession.participants?.filter((p: any) => !p.isSpectator).length || 0)) }).map((_, i) => (
                                        <div key={`empty-${i}`} className="p-6 rounded-[2.5rem] bg-surface border border-dashed border-border flex items-center gap-5 opacity-40">
                                            <div className="w-14 h-14 rounded-2xl border border-dashed border-border flex items-center justify-center">
                                                <div className="w-2 h-2 rounded-full bg-surface" />
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-muted-foreground font-black uppercase text-caption tracking-widest italic">Libre</span>
                                            </div>
                                        </div>
                                    )))}
                                </div>
 
                                 {/* Mobile Start Button (Sticky at the bottom for accessibility) */}
                                {((activeSession.hostId === currentUserId) || isSoloMode) && (
                                    <div className="md:hidden pt-6 shrink-0 mt-auto border-t border-border">
                                        <button
                                            onClick={handleStartRoomGame}
                                            disabled={!isSoloMode && (activeSession.participants?.filter((p: any) => !p.isSpectator).length || 0) < 2}
                                            className={cn(
                                                "w-full py-5 rounded-[2rem] text-foreground font-black uppercase text-sm italic shadow-2xl transition-all active:scale-95 flex items-center justify-center gap-4 border",
                                                (!isSoloMode && (activeSession.participants?.filter((p: any) => !p.isSpectator).length || 0) < 2)
                                                    ? "bg-elevated border-border opacity-50 grayscale cursor-not-allowed"
                                                    : "bg-success border-success"
                                            )}
                                        >
                                            <Play size={20} fill="currentColor" />
                                            <span>Lancer l'Épreuve</span>
                                        </button>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    </div>
                )}

                {/* #126 : popup « un joueur a quitté » en partie à 2 joueurs (le tour continue) */}
                <AnimatePresence>
                    {playerLeftNotice && (
                        <motion.div
                            initial={{ opacity: 0, y: -16 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -16 }}
                            transition={{ duration: 0.25 }}
                            className="fixed inset-x-0 top-6 z-[2600] flex justify-center px-4 pointer-events-none"
                        >
                            <div className="pointer-events-auto bg-elevated border border-warning/30 rounded-2xl px-5 py-4 shadow-2xl flex items-center gap-4 max-w-lg w-full">
                                <div className="w-10 h-10 rounded-full bg-warning/15 border border-warning/30 flex items-center justify-center shrink-0">
                                    <Users size={18} className="text-warning" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm font-bold text-foreground">
                                        {playerLeftNotice} a quitté la partie
                                    </p>
                                    <p className="text-caption text-muted-foreground mt-0.5">
                                        Le tour en cours continue — les prochaines maps partent quand même.
                                    </p>
                                </div>
                                <button
                                    onClick={() => setPlayerLeftNotice(null)}
                                    className="shrink-0 w-8 h-8 rounded-lg bg-surface text-muted-foreground hover:bg-elevated hover:text-foreground flex items-center justify-center"
                                    aria-label="Fermer"
                                >
                                    <X size={14} />
                                </button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

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
                                <span className="text-[180px] font-black italic text-success drop-shadow-[0_0_50px_rgba(16,185,129,0.5)] leading-none">
                                    {timeLeft}
                                </span>
                                <span className="text-muted-foreground font-black uppercase tracking-widest text-xl mt-4 italic">
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
                                className="max-w-xl w-full bg-elevated border border-border rounded-[3rem] p-12 relative overflow-hidden"
                            >
                                <div className="absolute top-0 right-0 w-32 h-32 bg-info/10 rounded-full blur-[100px] pointer-events-none" />
                                <h2 className="text-foreground font-black text-4xl uppercase italic mb-8 tracking-tighter">Règles du SigilGuesser</h2>
                                <div className="space-y-6">
                                    {[
                                        { t: "Objectif", d: "Trouvez l'emplacement exact de l'image affichée sur la carte." },
                                        { t: "Précision", d: "Plus vous êtes proche du point d'origine, plus vous gagnez de points (max 1000)." },
                                        { t: "Temps", d: "Vous avez un temps limité par round pour valider votre position." },
                                        { t: "Multi-Mondes", d: "Attention ! La cible peut être sur Incarnam, Pandala ou d'autres mondes." }
                                    ].map((rule, i) => (
                                        <div key={i} className="flex gap-5">
                                            <div className="w-8 h-8 rounded-lg bg-info/10 flex items-center justify-center text-info font-black italic shrink-0">
                                                {i + 1}
                                            </div>
                                            <div>
                                                <h4 className="text-foreground font-black text-xs uppercase italic mb-1">{rule.t}</h4>
                                                <p className="text-muted-foreground text-caption font-medium leading-relaxed">{rule.d}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <button
                                    onClick={() => setShowRules(false)}
                                    className="mt-12 w-full py-5 rounded-2xl bg-surface text-muted-foreground font-black uppercase text-xs italic hover:bg-elevated hover:text-foreground transition-all border border-border"
                                >
                                    J'ai compris
                                </button>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Map Detail Panel - Classic Exploration */}
                {selectedPosition && activeTab === 'map' && (
                    <MapDetailsPanel
                        position={(() => {
                            // If we already have a specialized mapId (e.g. from layer switcher), use it
                            if (selectedPosition.mapId) return selectedPosition;
                            // Otherwise find the best map for these coords
                            const bestMap = allWorldMapsByCoords.get(`${selectedPosition.x},${selectedPosition.y}`);
                            return {
                                ...selectedPosition,
                                mapId: bestMap?.id,
                                subAreaId: bestMap?.subAreaId
                            };
                        })()}
                        allLayers={allLayersByCoords.get(`${selectedPosition.x},${selectedPosition.y}`) || []}
                        subAreaName={(() => {
                            // Determine which subAreaId to use
                            const currentMap = selectedPosition.mapId 
                                ? allMapsById.get(selectedPosition.mapId) 
                                : allWorldMapsByCoords.get(`${selectedPosition.x},${selectedPosition.y}`);
                            
                            const saId = currentMap?.subAreaId || selectedPosition.subAreaId || 0;
                            const sa = subAreasById.get(saId);
                            if (!sa) return undefined;
                            return typeof sa.name === 'string' ? sa.name : sa.name?.fr;
                        })()}
                        guildId={guildId}
                        onClose={() => setSelectedPosition(null)}
                        onOpenZoneDetails={() => setShowZoneDetail(true)}
                        onSelectMap={(map: MapNode) => {
                            setSelectedPosition({
                                ...selectedPosition,
                                mapId: map.id,
                                subAreaId: map.subAreaId
                            });
                        }}
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
                            {Array.from({ length: 20 }).map((_, i) => (
                                <motion.div
                                    key={i}
                                    initial={{ 
                                        x: 0, 
                                        y: 0, 
                                        opacity: 1, 
                                        scale: 0 
                                    }}
                                    animate={{ 
                                        x: ((i % 5) - 2) * 240, 
                                        y: ((i % 4) - 2) * 300, 
                                        opacity: 0, 
                                        scale: (i % 3) + 1,
                                        rotate: i * 18
                                    }}
                                    transition={{ duration: 3, ease: "easeOut" }}
                                    className="absolute w-4 h-4 rounded-sm bg-success "
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
                                className="bg-elevated/95 backdrop-blur-3xl border-4 border-success/50 rounded-[4rem] px-24 py-20 flex flex-col items-center gap-10 shadow-[0_60px_120px_rgba(16,185,129,0.4)] relative"
                            >
                                {/* Bouton fermer — ferme la célébration immédiatement */}
                                <button
                                    onClick={() => setShowPerfectCelebration(false)}
                                    className="absolute top-5 right-5 z-10 w-12 h-12 rounded-full bg-surface border border-border-strong text-success-foreground flex items-center justify-center hover:bg-success hover:text-success-foreground hover:border-success shadow-lg active:scale-90 pointer-events-auto transition-all"
                                    title="Fermer"
                                    aria-label="Fermer la célébration"
                                >
                                    <X size={24} />
                                </button>
                                <motion.div
                                    animate={{ 
                                        scale: [1, 1.15, 1],
                                        rotate: [0, 8, -8, 0]
                                    }}
                                    transition={{ repeat: Infinity, duration: 1.8, ease: "easeInOut" }}
                                    className="w-40 h-40 rounded-full bg-success flex items-center justify-center text-success-foreground "
                                >
                                    <Sparkles size={80} />
                                </motion.div>
                                
                                <div className="text-center">
                                    <h1 className="text-7xl font-black text-foreground uppercase italic tracking-tighter mb-3 drop-shadow-[0_10px_10px_rgba(0,0,0,1)]">
                                        MAP EXACTE !
                                    </h1>
                                    <p className="text-success font-black text-2xl uppercase tracking-widest animate-pulse">
                                        +250 PTS BONUS
                                    </p>
                                </div>

                                <motion.div
                                    animate={{ y: [0, -12, 0] }}
                                    transition={{ repeat: Infinity, duration: 1.5 }}
                                    className="flex items-center gap-4 bg-surface border border-border px-8 py-4 rounded-full shadow-2xl"
                                >
                                    <Trophy className="text-warning" size={32} />
                                    <span className="text-foreground font-black text-2xl italic tracking-tight">LE GÉNIE D'AMAKNA</span>
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

