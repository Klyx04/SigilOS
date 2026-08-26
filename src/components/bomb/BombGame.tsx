"use client";

import React, { useEffect, useState, useRef, useMemo, useLayoutEffect } from "react";
import { io, Socket } from "socket.io-client";
import { buildWsUrl } from "@/lib/socket-utils";
import { useSession } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import { 
    Loader2, 
    Heart, 
    Zap, 
    Bomb, 
    Timer, 
    Users, 
    LayoutGrid, 
    Send,
    AlertCircle,
    Info,
    Trophy,
    Settings,
    Maximize2,
    Minimize2,
    Sparkles,
    CheckCircle2,
    XCircle,
    HelpCircle,
    Orbit,
    ArrowLeft,
    Mic,
    LogOut,
    Volume2,
    VolumeX
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { AtmosphericParticles } from "../ui/AtmosphericParticles";
import { ShareRoomButton } from "../shared/ShareRoomButton";
import { useBombSounds } from "./useBombSounds";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

class BombErrorBoundary extends React.Component<{children: React.ReactNode}, {hasError: boolean, error: Error | null}> {
    constructor(props: {children: React.ReactNode}) {
        super(props);
        this.state = { hasError: false, error: null };
    }
    static getDerivedStateFromError(error: Error) {
        return { hasError: true, error };
    }
    render() {
        if (this.state.hasError) {
            return (
                <div className="fixed inset-0 z-[1000] bg-danger/90 text-danger-foreground flex flex-col items-center justify-center p-8">
                    <h2 className="text-3xl font-black mb-4">Erreur Fatale (Frontend)</h2>
                    <pre className="text-xs bg-black/50 p-4 rounded-xl whitespace-pre-wrap max-w-2xl overflow-auto border border-border-strong shadow-2xl">
                        {this.state.error?.message}
                        {"\n\n"}
                        {this.state.error?.stack}
                    </pre>
                    <button onClick={() => window.location.reload()} className="mt-8 px-8 py-4 bg-elevated hover:bg-elevated rounded-xl font-black transition-all">Rafraîchir la page</button>
                </div>
            );
        }
        return this.props.children;
    }
}

export default function BombGame({ 
    roomId: initialRoomId, 
    guildId, 
    userName: propUserName, 
    userAvatar: propUserAvatar 
}: { 
    roomId?: string, 
    guildId: string,
    userName?: string,
    userAvatar?: string
}) {
    const { data: session, status: sessionStatus } = useSession();
    const [socket, setSocket] = useState<Socket | null>(null);
    const [gameState, setGameState] = useState<any>(null);
    const [wordInput, setWordInput] = useState("");
    const [isJoining, setIsJoining] = useState(false);
    const [lobbyRooms, setLobbyRooms] = useState<any[]>([]);
    const [explosionFlash, setExplosionFlash] = useState(false);
    const [shakeCount, setShakeCount] = useState(0);
    const [winnerData, setWinnerData] = useState<any>(null);
    const [leaderboard, setLeaderboard] = useState<any[]>([]);
    const [showGameEnd, setShowGameEnd] = useState(false);
    const triggerShake = () => setShakeCount(prev => prev + 1);
    const [isImmersive, setIsImmersive] = useState(false);
    const [showOptions, setShowOptions] = useState(false);
    const [showTutorial, setShowTutorial] = useState(false);
    const [showQuitConfirm, setShowQuitConfirm] = useState(false);
    const [bloodSplats, setBloodSplats] = useState<any[]>([]);
    const [winnerName, setWinnerName] = useState<string | null>(null);
    const [localTimeLeft, setLocalTimeLeft] = useState<number>(0);
    const [explosionPlayerId, setExplosionPlayerId] = useState<string | null>(null);
    const [typingMap, setTypingMap] = useState<Record<string, string>>({});
    const inputRef = useRef<HTMLInputElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const sessionRef = useRef(session);
    useEffect(() => { sessionRef.current = session; }, [session]);
    const [showSettingsPrompt, setShowSettingsPrompt] = useState(false);
    const [isSuddenDeath, setIsSuddenDeath] = useState(false);
    const [showSuddenDeathFlash, setShowSuddenDeathFlash] = useState(false);
    const [myStreak, setMyStreak] = useState(0);

    const [masterVolume, setMasterVolume] = useState(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('bomb_master_volume');
            return saved ? parseFloat(saved) : 0.5;
        }
        return 0.5;
    });
    const [tickVolume, setTickVolume] = useState(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('bomb_tick_volume');
            return saved ? parseFloat(saved) : 0.8;
        }
        return 0.8;
    });
    const [showAudioSettings, setShowAudioSettings] = useState(false);

    useEffect(() => {
        localStorage.setItem('bomb_master_volume', masterVolume.toString());
    }, [masterVolume]);

    useEffect(() => {
        localStorage.setItem('bomb_tick_volume', tickVolume.toString());
    }, [tickVolume]);

    // Plein écran automatique pendant les parties (Sigil Bomb)
    const [isFullscreen, setIsFullscreen] = useState(false);
    const applyFullscreen = (fs: boolean) => {
        setIsFullscreen(fs);
        const el = document.getElementById('sigil-bomb-page');
        if (el) el.classList.toggle('worldmap-fullscreen', fs);
        document.body.classList.toggle('map-fullscreen', fs);
    };
    useEffect(() => {
        const inGame = gameState?.state === 'PLAYING' || gameState?.state === 'COUNTDOWN' || gameState?.state === 'STARTING';
        applyFullscreen(inGame);
    }, [gameState?.state]);
    // Nettoyage du plein écran à la sortie (retour dashboard = normal)
    useEffect(() => {
        return () => {
            setIsFullscreen(false);
            const el = document.getElementById('sigil-bomb-page');
            if (el) el.classList.remove('worldmap-fullscreen');
            document.body.classList.remove('map-fullscreen');
        };
    }, []);

    const { playTick, playUrgentTick, playExplosion, playSuccess, playDoubleKill, playTripleKill, playRampage, playGodlike, playSuddenDeath } = useBombSounds(masterVolume, tickVolume);
    // Les fonctions son sont recréées quand le volume change, mais les handlers socket sont
    // enregistrés une seule fois → on passe par une ref pour TOUJOURS utiliser le volume courant
    // (sinon l'ajustement du volume ne fait rien : le handler garde l'ancien volume).
    const soundRef = useRef({ playTick, playUrgentTick, playExplosion, playSuccess, playDoubleKill, playTripleKill, playRampage, playGodlike, playSuddenDeath });
    useEffect(() => {
        soundRef.current = { playTick, playUrgentTick, playExplosion, playSuccess, playDoubleKill, playTripleKill, playRampage, playGodlike, playSuddenDeath };
    });


    // WebSocket Connection — wait for session to fully load before connecting
    useEffect(() => {
        if (sessionStatus === 'loading') return; // Wait — don't connect until session is known
        if (!session?.user?.id) return;          // Not authenticated

        const s = io(buildWsUrl(), {
            path: "/socket.io/",
            transports: ["websocket", "polling"],
            withCredentials: true,
            query: { guildId }
        });
        setSocket(s);

        s.on("connect", () => {
            const user = sessionRef.current?.user;
            if (!user) return;
            if (initialRoomId) {
                s.emit("bomb:room:join", {
                    roomId: initialRoomId,
                    playerObj: { 
                        userId: user.id, 
                        discordId: (user as any).discordId,
                        userName: propUserName || user.name, 
                        userAvatar: propUserAvatar || user.image, 
                        guildId 
                    }
                });
            } else {
                s.emit("bomb:room:list");
            }
        });

        s.on("bomb:sync", (state) => { 
            setIsJoining(false); 
            setGameState((prev: any) => {
                // Keep existing transition logic for toasts...
                return state;
            }); 
            setIsSuddenDeath(state.isSuddenDeath || false);
            // Timer logic: prioritize timeLeft from server, fallback to config if playing
            let newTime = state.timeLeft;
            if ((newTime === undefined || newTime === null || newTime === 0) && state.state === 'PLAYING') {
                newTime = state.config?.turnTime ?? 12;
            }
            setLocalTimeLeft(newTime ?? 0);
            
            // CLEANUP: If server says we are in LOBBY, ensure game end overlay is closed
            if (state.state === 'LOBBY') {
                setShowGameEnd(false);
            }
        });
        s.on("bomb:game-end", (data) => {
            console.info("🎮 Game Ended event received:", data);
            setWinnerData(data);
            setWinnerName(data.winnerName || null);
            setLeaderboard(data.leaderboard || []);
            setShowGameEnd(true);
        });
        s.on("bomb:tick", (data) => {
            setLocalTimeLeft(data.timeLeft);
            if (data.timeLeft <= 3) soundRef.current.playUrgentTick();
            else soundRef.current.playTick();
        });
        s.on("bomb:room:list", (list) => setLobbyRooms(list));
        s.on("bomb:explosion", (data) => {
            setExplosionFlash(true);
            triggerShake();
            setExplosionPlayerId(data.playerId);
            soundRef.current.playExplosion();
            const newSplats = Array.from({ length: 5 }).map(() => ({
                id: Math.random(),
                x: Math.random() * 100,
                y: Math.random() * 100,
                scale: 0.5 + Math.random() * 1.5,
                rotate: Math.random() * 360
            }));
            setBloodSplats(prev => [...prev.slice(-10), ...newSplats]);
            if (data.playerId === s.id) setMyStreak(0);
            setTimeout(() => { setExplosionFlash(false); }, 800);
            setTimeout(() => { setBloodSplats([]); setExplosionPlayerId(null); }, 2500);
        });
        s.on("bomb:word-success", (data) => { 
            setWordInput(""); 
            setTypingMap({});
            triggerShake();
            // Only increment streak + play sounds for our own words
            const isMe = data?.playerId === s.id;
            if (isMe) {
                setMyStreak(prev => {
                    const next = prev + 1;
                    if (next >= 10) { soundRef.current.playGodlike(); toast("🌟 GODLIKE ! Tu es inarrêtable !", { duration: 3000 }); }
                    else if (next >= 5) { soundRef.current.playRampage(); toast("🔥 RAMPAGE ! " + next + " mots d'affilée !", { duration: 2500 }); }
                    else if (next === 3) { soundRef.current.playTripleKill(); toast("⚡ TRIPLE ! En feu !", { duration: 2000 }); }
                    else if (next === 2) { soundRef.current.playDoubleKill(); }
                    else { soundRef.current.playSuccess(); }
                    return next;
                });
            } else {
                soundRef.current.playSuccess();
            }
        });
        s.on("bomb:typing-update", (data: { playerId: string; text: string }) => {
            setTypingMap(prev => ({ ...prev, [data.playerId]: data.text }));
        });
        s.on("bomb:typing-reset", () => {
            setTypingMap({});
        });
        s.on("bomb:word-error", (data) => toast.error(data.message));
        s.on("bomb:bonus-life", (data) => {
            if (data.playerId === s.id) {
                toast("🔥 ALPHABET COMPLÉTÉ ! +1 VIE", { icon: <Sparkles className="text-warning" /> });
            }
        });

        s.on("bomb:sudden-death", (data) => {
            setIsSuddenDeath(true);
            setShowSuddenDeathFlash(true);
            soundRef.current.playSuddenDeath();
            toast.error("⚠️ MORT SUBITE : TEMPS RÉDUIT !", {
                description: `Le temps de réflexion est réduit de ${data.reductionPercent}%. Bonne chance.`,
                duration: 5000,
            });
            setTimeout(() => setShowSuddenDeathFlash(false), 3000);
        });
        s.on("bomb:sudden-death-soon", (data) => {
            toast.warning(`⚠️ Mort subite dans ~${data.exchangesLeft} échange(s)...`, {
                description: `Le temps de réflexion sera réduit de ${data.reductionPercent}%. Préparez-vous !`,
                duration: 6000,
            });
        });

        return () => { s.disconnect(); };
    }, [sessionStatus, session?.user?.id, initialRoomId, guildId]);

    const prevState = useRef<string | null>(null);
    useLayoutEffect(() => {
        if (gameState?.state === 'PLAYING') {
            const currentP = gameState?.players?.[gameState.currentTurnIndex];
            
            // Trigger turn-change shake for feedback — but NOT on the very first turn of the game
            if (prevState.current === 'PLAYING') {
                triggerShake();
            }

            if (currentP?.id === socket?.id && inputRef.current) {
                inputRef.current.focus();
            }
        }
        prevState.current = gameState?.state || null;
    }, [gameState?.currentTurnIndex, gameState?.state, socket?.id]);
    
    // Safety: Monitor gameState state to clean up UI blockers
    useEffect(() => {
        if (gameState?.state === 'LOBBY') {
            setShowGameEnd(false);
        } else if (gameState?.state === 'STARTING') {
            setShowGameEnd(false);
            setShowOptions(false);
            setShowTutorial(false);
        }
    }, [gameState?.state]);

    const handleCreateRoom = (isSolo = false) => {
        const id = Math.random().toString(36).substring(2, 9).toUpperCase();
        const user = sessionRef.current?.user;
        if (!user) return;
        socket?.emit("bomb:room:join", {
            roomId: id,
            playerObj: { 
                userId: user.id, 
                discordId: (user as any).discordId,
                userName: propUserName || user.name, 
                userAvatar: propUserAvatar || user.image, 
                guildId,
                isSoloMode: isSolo  // Passed directly so server applies it synchronously on room creation
            }
        });
        window.history.replaceState(null, "", `?room=${id}`);
    };



    const handleJoinRoom = (id: string) => {
        const user = sessionRef.current?.user;
        if (!user) return;
        socket?.emit("bomb:room:join", {
            roomId: id,
            playerObj: { 
                userId: user.id, 
                discordId: (user as any).discordId,
                userName: propUserName || user.name, 
                userAvatar: propUserAvatar || user.image, 
                guildId 
            }
        });
        window.history.replaceState(null, "", `?room=${id}`);
    };

    const handleStartGame = () => socket?.emit("bomb:start-game");
    const handleToggleReady = () => socket?.emit("bomb:toggle-ready");
    const handleUpdateConfig = (cfg: any) => socket?.emit("bomb:update-config", cfg);
    const handleRestart = (e?: React.MouseEvent) => {
        if (e) e.preventDefault();
        setShowGameEnd(false);
        setWinnerName(null); 
        setLeaderboard([]); 
        setIsSuddenDeath(false);
        setShowSuddenDeathFlash(false);
        setGameState((prev: any) => prev ? { ...prev, currentSyllable: "" } : null);
        socket?.emit("bomb:restart"); 
    };
    const handleLeave = (e?: React.MouseEvent) => { 
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        
        // Force cleanup of all UI blockers
        setShowGameEnd(false);
        setShowOptions(false);
        setIsJoining(false);
        
        // Emit leave and disconnect socket to be sure
        socket?.emit("bomb:leave");
        socket?.disconnect();
        
        // Clear state
        setGameState(null);
        
        // Clean URL properly to prevent auto-rejoin logic from firing
        const url = new URL(window.location.href);
        url.searchParams.delete('room'); // legacy
        url.searchParams.delete('roomId');
        window.history.replaceState(null, "", url.pathname);
        
        // Hard redirect after short delay to ensure clean state if still stuck
        const doRedirect = () => { window.location.href = `/dashboard/${guildId}/mini-jeux#mini-jeux`; }; // nosemgrep
        setTimeout(doRedirect, 100);
    };
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setWordInput(val);
        socket?.emit("bomb:typing", val);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const cleaned = wordInput.trim().replace(/\s\s+/g, ' ');
        if (!cleaned) return;
        socket?.emit("bomb:submit-word", cleaned);
        setWordInput("");
        setTypingMap({});
    };

    // Helper to highlight matching syllable in a word
    // Helper to highlight matching syllable in a word (now recursively handles multi-part words)
    const highlightCompoundWord = (word: string, syllable: string) => {
        if (!syllable || !word) return <span className="opacity-40 italic">...</span>;
        
        const stopWords = ['de', 'du', "d'", 'la', 'le', "l'", 'les', 'des', 'au', 'aux', 'en', 'sur', 'sous', 'vers', 'par', 'pour'];
        const parts = word.split(' ');
        
        return (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                {parts.map((part, idx) => {
                    const normalizedPart = part.toUpperCase();
                    const normalizedSyllable = syllable.toUpperCase();
                    const index = normalizedPart.indexOf(normalizedSyllable);
                    const isStopWord = stopWords.includes(part.toLowerCase());

                    return (
                        <div 
                            key={`${part}-${idx}`}
                            className={cn(
                                "flex items-center gap-1 px-3 py-1.5 rounded-2xl border transition-all duration-300",
                                isStopWord 
                                    ? "bg-surface border-dashed border-border-strong opacity-60 scale-90" 
                                    : "bg-info/10 border-info/20 "
                            )}
                        >
                            {index === -1 ? (
                                <span className={cn(isStopWord ? "text-caption lowercase font-medium opacity-60" : "text-lg font-black italic uppercase text-foreground/90")}>
                                    {part}
                                </span>
                            ) : (
                                <span className="text-lg font-black italic uppercase text-foreground">
                                    {part.substring(0, index)}
                                    <motion.span 
                                        initial={{ textShadow: "0 0 0px rgba(129,140,248,0)" }}
                                        animate={{ 
                                            textShadow: ["0 0 5px rgba(129,140,248,0.5)", "0 0 15px rgba(129,140,248,0.8)", "0 0 5px rgba(129,140,248,0.5)"],
                                            color: ["#818cf8", "#c7d2fe", "#818cf8"]
                                        }}
                                        transition={{ repeat: Infinity, duration: 2 }}
                                        className="font-[1000] underline decoration-indigo-500/50 underline-offset-4"
                                    >
                                        {part.substring(index, index + syllable.length)}
                                    </motion.span>
                                    {part.substring(index + syllable.length)}
                                </span>
                            )}
                        </div>
                    );
                })}
            </div>
        );
    };

    // Calculate player positions in circle (Responsive & Unified)
    const playerPositions = useMemo(() => {
        if (!gameState?.players) return [];
        const allPlayers = gameState.players;
        const activePlayers = allPlayers.filter((p: any) => !p.isSpectator);
        const spectators = allPlayers.filter((p: any) => p.isSpectator);
        
        const activeCount = activePlayers.length || 1;
        const specCount = spectators.length;

        return allPlayers.map((p: any, i: number) => {
            if (!p.isSpectator) {
                const activeIndex = activePlayers.findIndex((ap: any) => ap.id === p.id);
                const angle = (activeIndex / activeCount) * 2 * Math.PI - Math.PI / 2;
                const baseRadius = activeCount <= 4 ? 38 : 40; 
                return {
                    x: Math.cos(angle) * baseRadius,
                    y: Math.sin(angle) * baseRadius,
                    scale: activeCount > 6 ? 0.85 : 1.0,
                    opacity: 1,
                    isSpec: false
                };
            } else {
                // Spectators in an outer, wider circle, smaller
                const specIndex = spectators.findIndex((sp: any) => sp.id === p.id);
                const angle = (specIndex / (specCount || 1)) * 2 * Math.PI + Math.PI / 4;
                const specRadius = 46;
                return {
                    x: Math.cos(angle) * specRadius,
                    y: Math.sin(angle) * specRadius,
                    scale: 0.4,
                    opacity: 0.5,
                    isSpec: true
                };
            }
        });
    }, [gameState?.players?.length, gameState?.state]);

    // --- Session still loading ---
    if (sessionStatus === 'loading') {
        return (
            <div className="h-full w-full bg-background flex flex-col items-center justify-center relative overflow-hidden">
                <AtmosphericParticles />
                <div className="z-10 flex flex-col items-center gap-6">
                    <Loader2 className="w-12 h-12 animate-spin text-info" />
                    <p className="text-muted-foreground font-bold uppercase tracking-widest text-caption italic">Authentification...</p>
                </div>
            </div>
        );
    }

    // Initial Loading / Joining
    if (!gameState) {
        if (initialRoomId) {
            return (
                <div className="h-full w-full bg-background flex flex-col items-center justify-center relative overflow-hidden">
                    <AtmosphericParticles />
                    <div className="z-10 flex flex-col items-center gap-6">
                        <Loader2 className="w-12 h-12 animate-spin text-info" />
                        <div className="text-center">
                            <h2 className="text-2xl font-black text-foreground uppercase italic tracking-tighter">Connexion au salon...</h2>
                            <p className="text-muted-foreground font-bold uppercase tracking-widest text-caption italic mb-6">Syllaburation en cours</p>
                            <button 
                                onClick={(e) => handleLeave(e)}
                                className="px-4 py-2 rounded-xl bg-surface hover:bg-danger/20 border border-border text-foreground/40 hover:text-danger text-caption font-black uppercase italic tracking-widest transition-all"
                            >
                                Quitter (Annuler)
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        // ── ROOM LIST / CREATE SCREEN ────────────────────────────────
        return (
            <div className="h-full w-full bg-background flex flex-col items-center justify-center relative overflow-hidden">
                <AtmosphericParticles />
                <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute top-1/3 left-1/3 w-96 h-96 bg-info/10 rounded-full blur-[120px]" />
                </div>
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="z-10 text-center space-y-8 p-12 bg-surface backdrop-blur-3xl border border-border rounded-[3rem] shadow-2xl max-w-2xl w-full mx-4 relative">
                    {/* Back to mini-games */}
                    <button
                        onClick={() => window.location.href = `/dashboard/${guildId}/mini-jeux#mini-jeux`}
                        className="absolute top-8 left-8 flex items-center gap-2 text-foreground/30 hover:text-foreground/70 transition-colors group"
                    >
                        <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
                        <span className="text-caption font-black uppercase italic tracking-widest hidden md:inline">Retour aux jeux</span>
                    </button>
                    <div className="space-y-2">
                        <div className="flex items-center justify-center gap-3 mb-3">
                            <div className="px-3 py-1 rounded-full bg-info/20 border border-info/30">
                                <span className="text-info text-caption font-black uppercase tracking-widest">Multijoueur</span>
                            </div>
                        </div>
                        <h1 className="text-5xl font-black text-foreground uppercase italic tracking-tighter">Sigil-Bomb</h1>
                        <p className="text-foreground/30 font-bold uppercase tracking-widest text-caption italic">Le défi de la Reine des Voleurs</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <button onClick={() => handleCreateRoom(false)} className="p-8 rounded-[2rem] bg-info hover:bg-info text-info-foreground transition-all border-b-[8px] border-black/20 flex flex-col items-center gap-4 group shadow-xl shadow-indigo-500/20">
                             <Zap className="w-10 h-10 group- transition-transform" />
                             <span className="font-black uppercase italic tracking-widest">Créer une salle</span>
                        </button>
                        <button onClick={() => socket?.emit("bomb:room:list")} className="p-8 rounded-[2rem] bg-surface hover:bg-surface text-foreground transition-all border border-border hover:border-border-strong flex flex-col items-center gap-4 group">
                             <Users className="w-10 h-10 group- transition-transform" />
                             <span className="font-black uppercase italic tracking-widest">Voir les salons</span>
                        </button>
                    </div>
                    {lobbyRooms.length > 0 && (
                        <div className="space-y-4 pt-8 border-t border-border">
                            <h3 className="text-caption font-black text-foreground/20 uppercase tracking-widest italic">Salons disponibles</h3>
                            <div className="grid grid-cols-1 gap-3 max-h-[250px] overflow-y-auto pr-2 custom-scrollbar">
                                {lobbyRooms.map(room => (
                                    <button key={room.roomId} onClick={() => handleJoinRoom(room.roomId)} className="flex items-center justify-between p-4 bg-surface rounded-2xl border border-border hover:border-info/50 hover:bg-surface transition-all group">
                                        <div className="flex flex-col items-start leading-none">
                                            <span className="font-black text-foreground italic">{room.hostName || room.roomId}</span>
                                            <span className="text-caption text-foreground/20 uppercase font-black tracking-widest mt-1">{room.playerCount} JOUEURS • {room.state}</span>
                                        </div>
                                        <LayoutGrid className="w-5 h-5 text-foreground/20 group-hover:text-info transition-colors" />
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </motion.div>
            </div>
        );
    }


    // Use session ID as primary, fallback to socket ID
    const myPlayer = gameState.players?.find((p: any) => (p.userId && p.userId === session?.user?.id) || p.id === socket?.id);
    const currentPlayer = gameState?.players?.[gameState?.currentTurnIndex];
    
    // Resilient Host Check: check by userId first, then socketId, or if only one human is left
    const isHost = (myPlayer?.userId && myPlayer.userId === gameState.hostUserId) || 
                   (myPlayer?.id === gameState.hostId) || 
                   (socket?.id === gameState.hostId) || 
                   (gameState.players?.filter((p: any) => !p.isBot).length === 1 && !myPlayer?.isSpectator);
                   
    if (!gameState || !gameState.players || !gameState.config) return <div className="h-full w-full bg-background flex items-center justify-center"><Loader2 className="animate-spin text-info" /></div>;

    const isMyTurn = currentPlayer?.id === socket?.id;
    const bombTargetPos = playerPositions[gameState.currentTurnIndex] || { x: 0, y: 0 };
    const spectatorsCount = gameState.players?.filter((p: any) => p.isSpectator).length || 0;
    const activePlayers = gameState.players?.filter((p: any) => !p.isSpectator) || [];
    const activePlayersCount = activePlayers.length;
    const isSoloMode = gameState.config?.isSoloMode;
    const hasEnoughPlayers = activePlayersCount >= 2 || (activePlayersCount === 1 && isSoloMode);
    const allReady = hasEnoughPlayers && activePlayers.every((p: any) => p.isHost || p.isReady || p.isBot);

    const isLobby = gameState.state === 'LOBBY';
    const isPlaying = gameState.state === 'PLAYING';
    const isMatchActive = gameState.state === 'PLAYING' || gameState.state === 'STARTING';
    const isGameEnd = gameState.state === 'GAME_END';


    return (
        <BombErrorBoundary>
        <div ref={containerRef} className={cn(
            "bg-background flex flex-col relative overflow-hidden transition-all duration-300",
            isImmersive ? "fixed inset-0 z-[100]" : "h-full w-full",
            shakeCount > 0 && "animate-shake"
        )}>
            {/* Croix de sortie du plein écran (visible pendant la partie) */}
            {isFullscreen && (
                <button
                    onClick={() => applyFullscreen(false)}
                    className="fixed top-4 right-4 z-[10001] w-11 h-11 rounded-full bg-black/85 border border-border-strong text-danger-foreground flex items-center justify-center hover:bg-danger/90 hover:border-danger shadow-2xl transition-colors"
                    title="Quitter le plein écran"
                >
                    <XCircle size={22} />
                </button>
            )}
            {/* QUIT CONFIRMATION DIALOG */}
            <Dialog open={showQuitConfirm} onOpenChange={setShowQuitConfirm}>
                <DialogContent className="max-w-md bg-background/95 border border-border text-foreground rounded-[2rem] p-6 backdrop-blur-xl">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-black italic uppercase text-danger tracking-wider flex items-center gap-2">
                            <AlertCircle className="w-5 h-5 text-danger" />
                            Quitter la partie ?
                        </DialogTitle>
                        <DialogDescription className="text-foreground/60 text-xs mt-2 leading-relaxed">
                            {isHost && activePlayers.filter((p: any) => !p.isBot).length > 1
                                ? "Vous êtes l'hôte. Quitter la partie transférera automatiquement les droits d'hôte au joueur suivant sans arrêter la partie pour les autres joueurs."
                                : "Êtes-vous sûr de vouloir quitter la partie en cours ? Tout progrès sera perdu."}
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="mt-6 flex gap-3">
                        <button
                            onClick={() => setShowQuitConfirm(false)}
                            className="flex-1 py-3 px-4 rounded-xl bg-surface border border-border hover:bg-surface font-bold uppercase text-caption italic tracking-wider transition-all"
                        >
                            Annuler
                        </button>
                        <button
                            onClick={(e) => {
                                setShowQuitConfirm(false);
                                handleLeave(e);
                            }}
                            className="flex-1 py-3 px-4 rounded-xl bg-danger hover:bg-danger font-bold uppercase text-caption italic tracking-wider transition-all shadow-lg shadow-red-600/20"
                        >
                            Quitter
                        </button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <AtmosphericParticles />
            
            {/* QUEEN OF THIEVES BACKGROUND */}
            <div className="absolute inset-0 opacity-5 pointer-events-none">
                <img src="/images/sigil-king/incarnations/Roublard.png" className="absolute -right-20 -bottom-20 w-[800px] grayscale blur-sm" alt="" />
                <img src="/images/sigil-king/incarnations/Roublard.png" className="absolute -left-20 -top-20 w-[800px] grayscale blur-sm rotate-180" alt="" />
            </div>

            {/* CONTROLS */}
            <div className="absolute top-8 right-8 z-50 flex items-center gap-3">
                {gameState.state === 'LOBBY' && isHost && (
                    <button 
                        onClick={() => setShowOptions(!showOptions)}
                        className={cn(
                            "w-12 h-12 rounded-2xl flex items-center justify-center transition-all bg-surface border border-border hover:bg-surface text-foreground/40 hover:text-foreground",
                            showOptions && "bg-info/20 border-info text-info"
                        )}
                    >
                        <Settings size={20} />
                    </button>
                )}
                {/* Quit button — visible anytime for all players, now triggers confirmation dialog */}
                <button
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setShowQuitConfirm(true);
                    }}
                    className="w-12 h-12 rounded-2xl flex items-center justify-center bg-danger/10 border border-danger/20 hover:bg-danger/20 text-danger hover:text-danger transition-all shadow-lg"
                    title="Quitter la partie"
                >
                    <XCircle size={20} />
                </button>
                <button 
                    onClick={() => setShowAudioSettings(!showAudioSettings)}
                    className={cn(
                        "w-12 h-12 rounded-2xl flex items-center justify-center transition-all bg-surface border border-border hover:bg-surface text-foreground/40 hover:text-foreground",
                        showAudioSettings && "bg-info/20 border-info text-info"
                    )}
                    title="Paramètres audio"
                >
                    {masterVolume === 0 ? <VolumeX size={20} /> : <Volume2 size={20} />}
                </button>
                <button 
                    onClick={() => setShowTutorial(true)}
                    className="w-12 h-12 rounded-2xl flex items-center justify-center bg-muted border border-border hover:bg-muted/80 text-foreground/40 hover:text-foreground transition-all"
                    title="Aide et Tutoriel"
                >
                    <HelpCircle size={20} />
                </button>
            </div>

            {/* TOP STATS */}
            <div className="absolute top-8 left-8 z-50 flex flex-col gap-4">
                <ShareRoomButton roomId={gameState.id} />
                {spectatorsCount > 0 && (
                    <div className="flex items-center gap-2 text-caption font-black text-foreground/30 uppercase tracking-widest italic">
                        <Orbit size={12} className="text-info/50" />
                        {spectatorsCount} Spectateur{spectatorsCount > 1 ? 's' : ''}
                    </div>
                )}
            </div>

            <main className="flex-1 flex flex-col items-center pt-4 md:pt-[68px] pb-4 min-h-0 gap-2 overflow-hidden relative">
                {explosionFlash && <motion.div initial={{ opacity: 1, scale: 1.2 }} animate={{ opacity: 0, scale: 1 }} className="absolute inset-0 bg-danger/20 z-[100] blur-3xl pointer-events-none" />}
                
                {/* Sudden Death Flash Overlay */}
                <AnimatePresence>
                    {showSuddenDeathFlash && (
                        <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 z-[150] flex items-center justify-center pointer-events-none bg-danger/40 backdrop-blur-sm"
                        >
                            <motion.div 
                                initial={{ scale: 0.5, y: 20 }}
                                animate={{ scale: [1, 1.1, 1], y: 0 }}
                                transition={{ duration: 0.3, repeat: 3 }}
                                className="text-center"
                            >
                                <h2 className="text-6xl md:text-8xl font-[1000] text-danger uppercase italic tracking-[0.2em] drop-shadow-[0_0_30px_rgba(220,38,38,0.8)]">
                                    SUDDEN DEATH
                                </h2>
                                <p className="text-danger font-black uppercase tracking-widest mt-4 animate-pulse">
                                    -30% TURN TIME
                                </p>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* HUD TOP: SYLLABE - MOVED TO CENTER ARENA TO AVOID AVATAR OVERLAP */}
                <div className="flex-shrink-0 h-4 flex flex-col items-center justify-end pointer-events-none" />

                {/* ─── ARENA CONTAINER — flex-1 so it fills remaining space ─── */}
                <div className="flex-1 min-h-0 w-full flex items-center justify-center p-2 relative">
                <div 
                    key={shakeCount}
                    className={cn(
                        "relative w-full max-w-[min(85vw,45vh,500px)] aspect-square flex items-center justify-center transition-all duration-300",
                        shakeCount > 0 && "animate-shake"
                    )}
                >
                    
                    {/* CENTER HUD — Lobby: player list. STARTING: countdown. PLAYING: invisible. */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-40 flex flex-col items-center text-center w-full">
                        <AnimatePresence mode="wait">
                             {gameState.state === 'LOBBY' ? (
                                <motion.div key="lobby" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center gap-2 pointer-events-auto px-4 w-full max-w-xs">
                                    <p className="text-caption font-black uppercase tracking-widest text-foreground/30 italic mb-1">Joueurs dans le salon</p>
                                    {gameState.players?.filter((p: any) => !p.isSpectator).map((p: any) => (
                                        <div key={p.id} className="w-full flex items-center gap-3 px-3 py-2 rounded-2xl bg-surface border border-border">
                                            <img src={p.userAvatar || `https://ui-avatars.com/api/?name=${p.userName}`} className="w-8 h-8 rounded-xl object-cover border border-border shrink-0" alt="" />
                                            <span className="text-xs font-black uppercase italic text-foreground/80 flex-1 truncate">{p.userName}</span>
                                            {p.isReady
                                                ? <span className="text-caption font-black uppercase text-success bg-success/10 border border-success/20 px-2 py-0.5 rounded-full">Pret</span>
                                                : <span className="text-caption font-black uppercase text-foreground/20 bg-surface border border-border px-2 py-0.5 rounded-full">...</span>
                                            }
                                        </div>
                                    ))}
                                </motion.div>
                            ) : gameState.state === 'STARTING' ? (
                                <motion.div key="starting" initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex flex-col items-center gap-4">
                                    <div className="relative">
                                        <div className="absolute -inset-10 bg-info/20 blur-[60px] rounded-full animate-pulse" />
                                        <motion.span 
                                            key={localTimeLeft}
                                            initial={{ scale: 1.5, opacity: 0 }}
                                            animate={{ scale: 1, opacity: 1 }}
                                            className="text-8xl font-[1000] italic text-foreground drop-shadow-[0_0_30px_rgba(99,102,241,0.5)]"
                                        >
                                            {localTimeLeft}
                                        </motion.span>
                                    </div>
                                    <p className="text-info text-xs font-black uppercase tracking-widest italic animate-pulse">Préparez-vous...</p>
                                </motion.div>
                            ) : gameState.state === 'PLAYING' ? (
                                <motion.div key="playing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} />
                            ) : (
                                <motion.div key="end" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center gap-4 w-full px-4">
                                    {/* Trophy + Winner */}
                                    <motion.div className="flex flex-col items-center gap-1" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', bounce: 0.5 }}>
                                        <Trophy size={36} className="text-warning drop-shadow-[0_0_25px_rgba(250,204,21,0.5)]" />
                                        <p className="text-caption font-black text-foreground/30 uppercase tracking-widest italic">Gagnant</p>
                                        <h2 className="text-lg font-black text-foreground italic uppercase tracking-tighter">{winnerName || 'Personne'}</h2>
                                    </motion.div>

                                    {/* Leaderboard */}
                                    {leaderboard.length > 0 && (
                                        <div className="w-full max-w-xs space-y-1 scrollbar-hide">
                                            {leaderboard.map((entry: any, i: number) => (
                                                <motion.div
                                                    key={entry.id}
                                                    initial={{ opacity: 0, x: -10 }}
                                                    animate={{ opacity: 1, x: 0 }}
                                                    transition={{ delay: i * 0.08 }}
                                                    className={cn(
                                                        "flex items-center gap-2 px-2 py-1.5 rounded-xl border text-xs transition-colors",
                                                        i === 0 ? "bg-warning/10 border-warning/30 text-warning dark:text-warning" :
                                                        i === 1 ? "bg-muted/10 border-border/20 text-muted-foreground text-muted-foreground" :
                                                        i === 2 ? "bg-warning/10 border-warning/20 text-warning text-warning" :
                                                        "bg-muted border-border text-foreground/70"
                                                    )}
                                                >
                                                    <span className="text-sm w-5 text-center">
                                                        {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i+1}.`}
                                                    </span>
                                                    <img src={entry.avatar || `https://ui-avatars.com/api/?name=${entry.name}`} className="w-6 h-6 rounded-lg object-cover aspect-square shrink-0" alt="" />
                                                    <span className={cn("font-black italic uppercase flex-1 truncate text-caption")}>{entry.name}</span>
                                                    <span className="font-black text-foreground/40 tabular-nums text-caption">{entry.wordsFound} <span className="text-foreground/20 font-medium">mots</span></span>
                                                    <div className="flex gap-0.5">
                                                        {[...Array(Math.max(0, entry.lives))].map((_, li) => (
                                                            <Heart key={li} size={7} fill="#ef4444" className="text-danger" />
                                                        ))}
                                                    </div>
                                                </motion.div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Actions */}
                                    <div className="flex gap-2 pt-2">
                                        {isHost ? (
                                            <button onClick={handleRestart} className="px-4 py-2 rounded-xl bg-info hover:bg-info text-info-foreground font-black italic uppercase tracking-widest text-caption transition-all shadow-xl shadow-indigo-500/20">
                                                Rejouer
                                            </button>
                                        ) : (
                                            <div className="px-4 py-2 rounded-xl bg-info/20 text-info font-black italic uppercase tracking-widest text-caption flex items-center gap-2 border border-info/30">
                                                <Loader2 size={10} className="animate-spin" />
                                                Attente de l'hôte...
                                            </div>
                                        )}
                                        <button onClick={(e) => handleLeave(e)} className="px-5 py-2.5 rounded-xl bg-surface hover:bg-danger/20 border border-border hover:border-danger/40 text-foreground/60 hover:text-danger font-black italic uppercase tracking-widest text-caption transition-all">
                                            Quitter
                                        </button>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                {/* ─── MATCH INTERFACE (ARENA) ─── */}
                {isMatchActive && (
                    <>
                    <div className="absolute inset-0 flex items-center justify-center p-4">
                        <div className="relative w-full aspect-square max-w-[min(80vh,800px)] flex items-center justify-center">

                    {gameState.players.map((p: any, i: number) => {
                        const pos = playerPositions[i];
                        if (!pos) return null;

                        const isActive = p.id === currentPlayer?.id && gameState.state === 'PLAYING';
                        const isExploding = p.id === explosionPlayerId;
                        const count = gameState.players.filter((p: any) => !p.isSpectator).length;
                        const isBottom = pos.y > 0;

                        return (
                            <motion.div 
                                key={p.id}
                                initial={false}
                                animate={{ 
                                    left: `${50 + pos.x}%`, 
                                    top: `${50 + pos.y}%`,
                                    scale: isExploding ? [1, 1.3, 0.8, 1.1, 1] : (isActive ? pos.scale * 1.1 : pos.scale),
                                    opacity: p.isConnected || p.isBot ? 1 : 0.4,
                                    x: isExploding ? [0, -8, 8, -5, 5, 0] : 0,
                                }}
                                transition={{ duration: isExploding ? 0.4 : 0.3, type: 'spring', damping: 15 }}
                                className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center z-20"
                            >
                                <div className={cn(
                                    "w-14 h-14 md:w-18 md:h-18 aspect-square shrink-0 rounded-2xl border-2 p-0.5 transition-all duration-300 bg-background shadow-xl relative group/avatar",
                                    isExploding ? "border-danger ring-2 ring-danger/40 " :
                                    isActive ? "border-info ring-4 ring-ring/30" : 
                                    (p.isReady ? "border-success/50" : "border-border"),
                                    (p.lives === 0 || p.isSpectator) && "grayscale opacity-30 border-danger/50",
                                    p.isSpectator && "scale-50 opacity-40"
                                )}>
                                    <div className="absolute inset-0 bg-info/0 group-hover/avatar:bg-info/5 transition-colors rounded-xl" />
                                    <img src={p.userAvatar || `https://ui-avatars.com/api/?name=${p.userName}`} className="w-full h-full object-cover rounded-xl aspect-square shrink-0" alt="" />
                                    
                                    {/* STATUS INDICATORS */}
                                    {gameState.state === 'LOBBY' && !p.isSpectator && (
                                        <div className="absolute -right-2 -top-2 bg-background rounded-full p-0.5 z-30">
                                            {p.isReady ? <CheckCircle2 size={16} className="text-success" /> : <XCircle size={16} className="text-danger/50" />}
                                        </div>
                                    )}

                                    {/* LIVES */}
                                    <div className={cn(
                                        "absolute left-1/2 -translate-x-1/2 flex gap-0.5 z-30",
                                        isBottom ? "-bottom-6" : "-top-6"
                                    )}>
                                        {[...Array(gameState.config?.startingLives || 3)].map((_, li) => (li < p.lives ? <Heart key={li} size={10} fill="#ef4444" className="text-danger drop-shadow-[0_0_5px_rgba(239,68,68,0.5)]" /> : <Heart key={li} size={10} className="text-foreground/10" />))}
                                    </div>
                                    
                                    {/* PLAYER NAME */}
                                    <div className={cn(
                                        "absolute left-1/2 -translate-x-1/2 whitespace-nowrap z-30",
                                        isBottom ? "-bottom-12" : "-top-12"
                                    )}>
                                        <span className={cn(
                                            "text-caption font-black italic uppercase tracking-widest px-2 py-0.5 rounded-md",
                                            isActive ? "text-info bg-info/10" : "text-foreground/40"
                                        )}>
                                            {p.userName}
                                        </span>
                                    </div>

                                    {/* Ghost typing removed from here to be moved to central HUD */}
                                </div>
                            </motion.div>
                        );
                    })}

                    {/* ANIMATED BOMB & DIRECTION ARROW */}
                    {gameState.state === 'PLAYING' && (
                        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                            {/* TURN POINTER (Laser pointing from bomb to current player) */}
                            {(() => {
                                const activePlayers = gameState.players.filter((p: any) => !p.isSpectator);
                                const currentIdx = activePlayers.findIndex((ap: any) => ap.id === currentPlayer?.id);
                                if (currentIdx === -1 || activePlayers.length === 0) return null;
                                
                                // Player 0 at Top = 0 degrees CSS rotation if laser div points up
                                const targetAngleDeg = (currentIdx / activePlayers.length) * 360;
                                
                                return (
                                    <motion.div
                                        className="absolute inset-0 flex items-center justify-center pointer-events-none"
                                        initial={false}
                                        animate={{ rotate: targetAngleDeg }}
                                        transition={{ type: 'spring', damping: 25, stiffness: 80 }}
                                    >
                                        {/* The Laser Beam */}
                                        <div className="absolute" style={{ 
                                            left: '50%', 
                                            top: '50%', 
                                            width: '2px', 
                                            height: '35%', // Increased length to reach players better
                                            background: 'linear-gradient(to top, transparent, rgba(99,102,241,0.8), #fff)',
                                            transform: 'translateX(-50%) translateY(-100%)', // Beam points up from center
                                            boxShadow: '0 0 15px rgba(99,102,241,0.6)'
                                        }}>
                                            {/* Glowing Arrowhead */}
                                            <motion.div 
                                                animate={{ 
                                                    scale: [1, 1.4, 1],
                                                    opacity: [0.7, 1, 0.7]
                                                }}
                                                transition={{ repeat: Infinity, duration: 0.8 }}
                                                className="absolute -top-4 left-1/2 -translate-x-1/2"
                                            >
                                                <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                                                    <path d="M12 2L20 12H16V22H8V12H4L12 2Z" fill="white" className="drop-shadow-[0_0_15px_rgba(255,255,255,1)]" />
                                                </svg>
                                            </motion.div>
                                        </div>
                                    </motion.div>
                                );
                            })()}
                        </div>
                    )}

                             {/* Bombe et HUD (Arena center only has bomb now) */}
                            {isPlaying && (
                                <motion.div 
                                    initial={false}
                                    animate={{ 
                                        scale: localTimeLeft <= 3 ? [0.8, 1.1, 0.8] : 0.8,
                                        rotate: localTimeLeft <= 3 ? [0, 10, -10, 0] : [0, 2, -2, 0],
                                        opacity: 1
                                    }}
                                    transition={{ 
                                        scale: { repeat: Infinity, duration: localTimeLeft <= 3 ? 0.2 : 1 },
                                        rotate: { repeat: Infinity, duration: localTimeLeft <= 3 ? 0.1 : 2 }
                                    }}
                                    className="relative z-10 flex items-center justify-center"
                                >
                                    <div className="relative group flex items-center justify-center">
                                        <div className={cn(
                                            "absolute inset-0 blur-[60px] rounded-full transition-colors duration-300",
                                            localTimeLeft <= 3 ? "bg-danger/60" : "bg-info/30"
                                        )} />
                                        <div className={cn(
                                            "relative transition-all duration-300 flex items-center justify-center",
                                            gameState.players.filter((p: any) => !p.isSpectator).length > 6 ? "w-20 h-20 md:w-24 md:h-24" : "w-24 h-24 md:w-44 md:h-44"
                                        )}>
                                            <img src="/assets/dofus/classes/13.png" className={cn("w-full h-full object-contain drop-shadow-[0_0_30px_rgba(0,0,0,0.5)]", localTimeLeft <= 3 && "brightness-150")} alt="Bomb" />
                                            
                                            <div className="absolute top-1/4 right-[20%]">
                                                <motion.div 
                                                    animate={{ scale: [1, 2, 1], opacity: [0.5, 1, 0.5], x: [0, 2, -2, 0], y: [0, -2, 2, 0] }} 
                                                    transition={{ repeat: Infinity, duration: 0.1 }} 
                                                    className="w-3 h-3 bg-warning rounded-full blur-[2px] " 
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                        </div>
                    </div>
                    </>
                )}

                </div>
                </div>

                <div className="absolute inset-y-0 left-6 md:left-10 flex flex-col justify-center w-64 md:w-80 pointer-events-none z-[100]">
                    <AnimatePresence mode="wait">
                        {gameState.state === 'PLAYING' && (
                            <motion.div
                                initial={{ opacity: 0, x: -50 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -50 }}
                                className="space-y-6"
                            >
                                <div className="bg-black/60 backdrop-blur-3xl border-2 border-border rounded-[2rem] md:rounded-[3rem] p-6 md:p-8 flex flex-col items-center shadow-2xl relative overflow-hidden group">
                                    <div className="absolute inset-0 bg-gradient-to-br from-info/10 to-transparent" />
                                    <div className="relative z-10 flex flex-col items-center">
                                        <div className="flex flex-col items-center">
                                            <span className={cn(
                                                "text-5xl md:text-7xl font-black italic tracking-tighter uppercase transition-all duration-300",
                                                localTimeLeft <= 3 ? "text-danger drop-shadow-[0_0_20px_rgba(239,68,68,0.8)]" : "text-foreground"
                                            )}>
                                                {gameState.currentSyllable}
                                            </span>
                                            
                                            {/* COMPOUND WORD INDICATOR */}
                                            {gameState.currentSyllablePartCount > 1 && (
                                                <motion.div 
                                                    initial={{ opacity: 0, y: 10 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    className="mt-2 flex items-center gap-1.5 px-3 py-1 bg-info/20 rounded-full border border-info/30"
                                                >
                                                    <span className="text-caption font-black uppercase italic text-info tracking-wider">
                                                        {gameState.currentSyllablePartCount} Mots
                                                    </span>
                                                    <div className="w-1 h-1 bg-info rounded-full animate-pulse" />
                                                </motion.div>
                                            )}
                                        </div>

                                        {/* COMPOUND WORD PRE-COMPLETION HINTS */}
                                        {gameState.currentSyllablePartCount > 1 && gameState.currentSyllableHintParts && (
                                            <div className="mt-8 flex flex-wrap justify-center gap-2 w-full">
                                                {gameState.currentSyllableHintParts.map((hint: string | null, idx: number) => (
                                                    <div 
                                                        key={`hint-${idx}`}
                                                        className={cn(
                                                            "px-3 py-2 rounded-xl border transition-all duration-300",
                                                            hint 
                                                                ? "bg-info/20 border-info/40 " 
                                                                : "bg-surface border-border border-dashed opacity-40"
                                                        )}
                                                    >
                                                        {hint ? (
                                                            <span className="text-sm font-black italic uppercase text-info">
                                                                {hint}
                                                            </span>
                                                        ) : (
                                                            <div className="flex gap-1">
                                                                <div className="w-1 h-1 bg-elevated rounded-full" />
                                                                <div className="w-1 h-1 bg-elevated rounded-full" />
                                                                <div className="w-1 h-1 bg-elevated rounded-full" />
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>


                                    {/* TYPING FEED */}
                                    <AnimatePresence>
                                        {(() => {
                                            const typingPlayerId = Object.keys(typingMap).find(id => typingMap[id]?.length > 0) || (wordInput?.length > 0 ? socket?.id : null);
                                            const text = typingPlayerId === socket?.id ? wordInput : (typingMap[typingPlayerId || ""] || "");
                                            const p = gameState.players.find((pl: any) => pl.id === typingPlayerId);
                                            
                                            if (!typingPlayerId || !text || !p) return null;

                                            return (
                                                <motion.div
                                                    initial={{ opacity: 0, y: 20, scale: 0.95 }}
                                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                                    exit={{ opacity: 0, y: -10, scale: 0.95 }}
                                                    className="bg-info/20 backdrop-blur-3xl border-2 border-info/40 rounded-3xl p-6 shadow-2xl"
                                                >
                                                    <div className="flex items-center gap-3 mb-4">
                                                        <div className="w-8 h-8 rounded-xl overflow-hidden border-2 border-info">
                                                            <img src={p.userAvatar} className="w-full h-full object-cover" alt="" />
                                                        </div>
                                                        <div className="flex flex-col">
                                                            <span className="text-xs font-black uppercase italic text-foreground">{p.userName}</span>
                                                            <span className="text-caption font-bold uppercase text-info/80 tracking-widest">En train d'écrire...</span>
                                                        </div>
                                                    </div>
                                                    <div className="bg-black/40 p-4 rounded-2xl border border-border overflow-hidden">
                                                        {highlightCompoundWord(text, gameState.currentSyllable)}
                                                    </div>
                                                </motion.div>
                                            );
                                        })()}
                                    </AnimatePresence>
                                </motion.div>
                            )}
                    </AnimatePresence>
                </div>

                {/* ─── LOBBY ACTION BAR (Absolutely positioned at bottom of arena area) ─── */}
                <AnimatePresence>
                    {gameState.state === 'LOBBY' && (
                        <motion.div
                            key="lobby-action-bar"
                            initial={{ opacity: 0, scale: 0.95, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: -10 }}
                            className="absolute bottom-4 left-1/2 -translate-x-1/2 flex-shrink-0 flex items-center justify-center gap-3 z-[150] pointer-events-auto"
                        >
                            {isHost ? (
                                    <div className="flex items-center gap-2">
                                        <button 
                                            onClick={() => setShowOptions(true)}
                                            className="p-2.5 rounded-2xl bg-surface hover:bg-surface text-foreground/40 hover:text-foreground border border-border transition-all"
                                            title="Paramètres de la partie"
                                        >
                                            <Settings size={18} />
                                        </button>
                                        <button
                                            onClick={handleStartGame}
                                            disabled={!allReady}
                                            className={cn(
                                                "px-10 py-3 rounded-2xl font-black italic uppercase tracking-widest text-xs border-b-4 transition-all shadow-xl active:scale-95",
                                                allReady
                                                    ? "bg-info hover:bg-info text-info-foreground border-black/20 shadow-indigo-500/30"
                                                    : "bg-elevated/80 text-foreground/20 border-black/50 cursor-not-allowed opacity-50"
                                            )}
                                        >
                                            {allReady ? "⚡ Lancer l'Épreuve" : !hasEnoughPlayers ? "Attente de joueurs" : "En attente des joueurs"}
                                        </button>
                                    </div>
                            ) : (
                                !myPlayer?.isSpectator && (
                                    <button
                                        onClick={handleToggleReady}
                                        className={cn(
                                            "px-6 py-2.5 rounded-2xl font-black italic uppercase tracking-widest text-xs border-b-4 transition-all shadow-xl",
                                            myPlayer?.isReady
                                                ? "bg-success hover:bg-success text-success-foreground border-black/20"
                                                : "bg-surface hover:bg-elevated text-foreground border-border"
                                        )}
                                    >
                                        {myPlayer?.isReady ? "✓ Prêt !" : "Se mettre Prêt"}
                                    </button>
                                )
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* ─── GAME END OVERLAY (WINNER SCREEN) ─── */}
                <AnimatePresence>
                    {showGameEnd && gameState && (
                        <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 z-[300] bg-background/90 backdrop-blur-2xl flex flex-col items-center justify-center p-6 text-center"
                        >
                            <motion.div
                                initial={{ scale: 0.8, y: 20 }}
                                animate={{ scale: 1, y: 0 }}
                                className="max-w-md w-full"
                            >
                                <div className="mb-8 relative flex flex-col items-center">
                                    <div className="absolute -inset-4 bg-info/20 blur-3xl rounded-full animate-pulse" />
                                    <Trophy size={64} className="text-warning mb-4 drop-shadow-[0_0_20px_rgba(234,179,8,0.5)]" />
                                    <h2 className="text-3xl font-black italic uppercase tracking-tighter mb-2">Victoire !</h2>
                                    
                                    <div className="relative mt-4">
                                        <div className="w-24 h-24 rounded-[2rem] border-4 border-warning overflow-hidden ">
                                            <img src={winnerData?.winnerAvatar || `https://ui-avatars.com/api/?name=${winnerData?.winnerName}`} className="w-full h-full object-cover" alt="" />
                                        </div>
                                        <div className="absolute -bottom-2 -right-2 bg-warning text-warning-foreground p-1.5 rounded-xl shadow-lg">
                                            <Sparkles size={16} />
                                        </div>
                                    </div>
                                    <p className="mt-4 text-xl font-black uppercase italic tracking-widest text-info">{winnerData?.winnerName || winnerName || "Fin de partie"}</p>
                                    <p className="text-caption uppercase font-bold tracking-widest opacity-40 mt-1">Épreuve Terminée</p>
                                </div>

                                <div className="bg-surface border border-border rounded-2xl overflow-hidden mb-8">
                                    <div className="p-3 border-b border-border bg-surface">
                                        <h3 className="text-caption font-black uppercase tracking-[0.2em] opacity-50">Classement de la session</h3>
                                    </div>
                                    <div className="max-h-48 overflow-y-auto custom-scrollbar">
                                        {leaderboard.map((entry, i) => (
                                            <div key={entry?.id || `leaderboard-${i}`} className="flex items-center justify-between p-3 border-b border-border last:border-0 hover:bg-surface transition-colors">
                                                <div className="flex items-center gap-3">
                                                    <span className={cn("text-xs font-black italic", i === 0 ? "text-warning" : "text-foreground/20")}>#{i + 1}</span>
                                                    <div className="w-8 h-8 rounded-lg overflow-hidden border border-border bg-surface">
                                                        <img src={entry?.avatar || `https://ui-avatars.com/api/?name=${entry?.name || 'Player'}`} className="w-full h-full object-cover" alt="" />
                                                    </div>
                                                    <span className="text-sm font-bold uppercase tracking-tight truncate max-w-[120px]">{entry?.name || 'Anonyme'}</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs font-mono font-bold text-info">{entry?.wordsFound ?? 0}</span>
                                                    <span className="text-caption uppercase font-black opacity-30 mt-0.5">mots</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="flex flex-col gap-3">
                                    <button 
                                        onClick={handleRestart}
                                        className="w-full py-4 bg-info hover:bg-info text-info-foreground font-black italic uppercase tracking-widest rounded-2xl shadow-xl transition-all active:scale-95"
                                    >
                                        ⚡ Rejouer l'Épreuve
                                    </button>
                                    <button 
                                        onClick={() => setShowGameEnd(false)}
                                        className="w-full py-3 bg-surface hover:bg-surface text-foreground/60 font-black italic uppercase tracking-widest text-xs rounded-2xl transition-all"
                                    >
                                        Retour au Salon
                                    </button>
                                </div>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>

            {/* --- CONFIGURATION MODAL (Host Only) — FIXED TOP-LEVEL OVERLAY Z-[999] --- */}
            <AnimatePresence>
                {showOptions && isHost && (
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/80 backdrop-blur-2xl z-[999] flex items-center justify-center p-4 md:p-6"
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                        }}
                    >
                        <motion.div 
                            initial={{ scale: 0.9, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.9, y: 20 }}
                            className="max-w-sm md:max-w-md w-full max-h-[75vh] overflow-y-auto custom-scrollbar bg-background border border-border-strong rounded-[2.5rem] p-6 md:p-8  relative my-auto"
                            onClick={(e) => {
                                e.stopPropagation();
                            }}
                        >
                            {/* Decorative background elements */}
                            <div className="absolute top-0 right-0 -mr-20 -mt-20 w-48 h-48 bg-info/10 blur-[60px] rounded-full pointer-events-none" />
                            <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-48 h-48 bg-info/10 blur-[60px] rounded-full pointer-events-none" />

                            <div className="relative z-10 space-y-5">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2.5 bg-info/20 rounded-2xl text-info">
                                            <Settings size={20} />
                                        </div>
                                        <h3 className="text-xl font-black text-foreground italic uppercase tracking-tighter">Configuration</h3>
                                    </div>
                                    <button 
                                        type="button"
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            setShowOptions(false);
                                        }}
                                        className="p-2 hover:bg-surface rounded-xl transition-colors text-foreground/40 hover:text-foreground"
                                    >
                                        <XCircle size={20} />
                                    </button>
                                </div>

                                {/* Solo Mode Toggle */}
                                <div className="p-4 bg-surface rounded-2xl border border-border flex items-center justify-between">
                                    <div>
                                        <div className="text-xs font-black uppercase italic text-foreground flex items-center gap-2">
                                            🤖 Mode Solo (Robot Crâ-Mée)
                                        </div>
                                        <div className="text-caption text-foreground/40 font-bold uppercase tracking-wider mt-0.5">
                                            Permet de jouer seul contre un bot
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            handleUpdateConfig({ isSoloMode: !gameState.config?.isSoloMode });
                                        }}
                                        className={cn(
                                            "w-12 h-6 rounded-full transition-colors relative p-1 shrink-0 cursor-pointer",
                                            gameState.config?.isSoloMode ? "bg-info" : "bg-surface"
                                        )}
                                    >
                                        <div className={cn(
                                            "w-4 h-4 rounded-full bg-background transition-transform",
                                            gameState.config?.isSoloMode ? "translate-x-6" : "translate-x-0"
                                        )} />
                                    </button>
                                </div>

                                {/* Lives slider */}
                                <div className="space-y-2">
                                    <div className="flex justify-between items-end">
                                        <label className="text-caption font-black text-foreground/40 uppercase tracking-[0.2em]">Vies de départ</label>
                                        <span className="text-base font-black text-info italic">{gameState.config.startingLives} ❤</span>
                                    </div>
                                    <input 
                                        type="range" 
                                        min="1" max="5" 
                                        value={gameState.config.startingLives} 
                                        onChange={(e) => {
                                            e.stopPropagation();
                                            handleUpdateConfig({ startingLives: parseInt(e.target.value, 10) });
                                        }}
                                        className="w-full accent-info h-2 bg-surface rounded-full appearance-none cursor-pointer" 
                                    />
                                </div>

                                {/* Turn time slider */}
                                <div className="space-y-2">
                                    <div className="flex justify-between items-end">
                                        <label className="text-caption font-black text-foreground/40 uppercase tracking-[0.2em]">Temps par tour</label>
                                        <span className="text-base font-black text-info italic">{gameState.config.turnTime}s</span>
                                    </div>
                                    <input 
                                        type="range" 
                                        min="5" max="25" 
                                        value={gameState.config.turnTime} 
                                        onChange={(e) => {
                                            e.stopPropagation();
                                            handleUpdateConfig({ turnTime: parseInt(e.target.value, 10) });
                                        }}
                                        className="w-full accent-info h-2 bg-surface rounded-full appearance-none cursor-pointer" 
                                    />
                                </div>

                                {/* Mort subite (temps réduit) */}
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <label className="text-caption font-black text-foreground/40 uppercase tracking-[0.2em]">Mort subite (temps réduit)</label>
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                handleUpdateConfig({ suddenDeathEnabled: !gameState.config?.suddenDeathEnabled });
                                            }}
                                            className={cn(
                                                "w-12 h-6 rounded-full transition-colors relative p-1 shrink-0 cursor-pointer",
                                                gameState.config?.suddenDeathEnabled ? "bg-info" : "bg-surface"
                                            )}
                                        >
                                            <div className={cn(
                                                "w-4 h-4 rounded-full bg-background transition-transform",
                                                gameState.config?.suddenDeathEnabled ? "translate-x-6" : "translate-x-0"
                                            )} />
                                        </button>
                                    </div>
                                    {gameState.config?.suddenDeathEnabled && (
                                        <>
                                            <div className="flex justify-between items-end">
                                                <label className="text-caption font-black text-foreground/40 uppercase tracking-[0.2em]">Échanges avant réduction</label>
                                                <span className="text-base font-black text-info italic">{gameState.config.suddenDeathExchanges}</span>
                                            </div>
                                            <input
                                                type="range"
                                                min="5" max="40" step="1"
                                                value={gameState.config.suddenDeathExchanges}
                                                onChange={(e) => {
                                                    e.stopPropagation();
                                                    handleUpdateConfig({ suddenDeathExchanges: parseInt(e.target.value, 10) });
                                                }}
                                                className="w-full accent-info h-2 bg-surface rounded-full appearance-none cursor-pointer"
                                            />
                                        </>
                                    )}
                                </div>

                                {/* Dictionary Mode */}
                                <div className="space-y-2">
                                    <label className="text-caption font-black text-foreground/40 uppercase tracking-[0.2em]">Mode Dictionnaire</label>
                                    <div className="grid grid-cols-1 gap-2">
                                        {[
                                            { id: 'dofus', label: 'Strict (Dofus Items & Mobs)' },
                                            { id: 'mixed', label: 'Mixte (Dofus + Dictionnaire FR)' },
                                            { id: 'fr', label: 'Général (FR Uniquement)' }
                                        ].map(mode => (
                                            <button 
                                                key={mode.id}
                                                type="button"
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    handleUpdateConfig({ dictionaryMode: mode.id });
                                                }}
                                                className={cn(
                                                    "w-full py-3 rounded-xl text-xs font-black uppercase italic transition-all border cursor-pointer",
                                                    gameState.config?.dictionaryMode === mode.id 
                                                        ? "bg-info border-info text-info-foreground shadow-lg shadow-indigo-500/20" 
                                                        : "bg-surface border-border text-foreground/40 hover:bg-surface"
                                                )}
                                            >
                                                {mode.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="pt-2 flex flex-col gap-2">
                                    <button 
                                        type="button"
                                        onClick={(e) => { 
                                            e.preventDefault();
                                            e.stopPropagation();
                                            setShowOptions(false); 
                                            handleStartGame(); 
                                        }}
                                        disabled={!allReady}
                                        className={cn(
                                            "w-full py-4 rounded-2xl font-black italic uppercase tracking-widest text-xs transition-all shadow-xl",
                                            allReady
                                                ? "bg-info hover:bg-info text-info-foreground shadow-indigo-500/20 cursor-pointer"
                                                : "bg-elevated text-foreground/30 cursor-not-allowed border border-border"
                                        )}
                                    >
                                        {allReady ? "⚡ Lancer l'Épreuve" : !hasEnoughPlayers ? "Attente de joueurs (ou Mode Solo)" : "En attente des joueurs"}
                                    </button>
                                    <button 
                                        type="button"
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            setShowOptions(false);
                                        }}
                                        className="w-full py-2.5 bg-surface hover:bg-surface text-foreground/40 hover:text-foreground font-black italic uppercase tracking-widest text-caption rounded-xl transition-all"
                                    >
                                        Fermer
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

                {/* --- AUDIO SETTINGS MODAL --- */}
                <AnimatePresence>
                    {showAudioSettings && (
                        <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-background/80 backdrop-blur-xl z-[250] flex items-center justify-center p-6"
                        >
                            <motion.div 
                                initial={{ scale: 0.9, y: 20 }}
                                animate={{ scale: 1, y: 0 }}
                                exit={{ scale: 0.9, y: 20 }}
                                className="max-w-md w-full bg-card border border-border rounded-[3rem] p-10 shadow-2xl relative overflow-hidden"
                            >
                                <div className="absolute top-0 right-0 -mr-20 -mt-20 w-64 h-64 bg-info/10 blur-[80px] rounded-full" />
                                
                                <div className="relative z-10">
                                    <div className="flex items-center justify-between mb-8">
                                        <div className="flex items-center gap-3">
                                            <div className="p-3 bg-info/20 rounded-2xl text-info">
                                                <Volume2 size={24} />
                                            </div>
                                            <h3 className="text-2xl font-black text-foreground italic uppercase tracking-tighter">Audio</h3>
                                        </div>
                                        <button 
                                            onClick={() => setShowAudioSettings(false)}
                                            className="p-2 hover:bg-surface rounded-xl transition-colors text-foreground/20 hover:text-foreground"
                                        >
                                            <XCircle size={20} />
                                        </button>
                                    </div>

                                    <div className="space-y-8">
                                        {/* Master Volume */}
                                        <div className="space-y-4">
                                            <div className="flex justify-between items-end">
                                                <label className="text-caption font-black text-foreground/40 uppercase tracking-[0.2em]">Volume Général</label>
                                                <span className="text-xl font-black text-info italic">{Math.round(masterVolume * 100)}%</span>
                                            </div>
                                            <input 
                                                type="range" 
                                                min="0" max="1" step="0.05"
                                                value={masterVolume} 
                                                onChange={(e) => setMasterVolume(parseFloat(e.target.value))}
                                                className="w-full accent-info h-2 bg-surface rounded-full appearance-none cursor-pointer" 
                                            />
                                        </div>

                                        {/* Tick Volume specifically */}
                                        <div className="space-y-4">
                                            <div className="flex justify-between items-end">
                                                <label className="text-caption font-black text-foreground/40 uppercase tracking-[0.2em]">Volume du Tic-Tac</label>
                                                <span className="text-xl font-black text-info italic">{Math.round(tickVolume * 100)}%</span>
                                            </div>
                                            <input 
                                                type="range" 
                                                min="0" max="1" step="0.05"
                                                value={tickVolume} 
                                                onChange={(e) => setTickVolume(parseFloat(e.target.value))}
                                                className="w-full accent-info h-2 bg-surface rounded-full appearance-none cursor-pointer" 
                                            />
                                            <p className="text-caption text-foreground/20 italic uppercase font-bold tracking-widest">Ajuste spécifiquement le bruit du temps qui s&apos;écoule.</p>
                                        </div>

                                        <button 
                                            onClick={() => {
                                                setShowAudioSettings(false);
                                                playTick();
                                            }}
                                            className="w-full py-5 bg-info hover:bg-info text-info-foreground font-black italic uppercase tracking-widest rounded-[2rem] shadow-xl transition-all"
                                        >
                                            Enregistrer
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* TUTORIAL MODAL */}
                <AnimatePresence>
                    {showTutorial && (
                        <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-background/80 backdrop-blur-xl z-[100] flex items-center justify-center p-8"
                        >
                            <motion.div 
                                initial={{ scale: 0.9, y: 20 }}
                                animate={{ scale: 1, y: 0 }}
                                className="max-w-2xl w-full bg-card border border-border rounded-[3rem] p-12 relative shadow-2xl overflow-hidden"
                            >
                                <div className="absolute top-0 right-0 p-8">
                                    <button onClick={() => setShowTutorial(false)} className="text-foreground/20 hover:text-foreground transition-colors">Fermer</button>
                                </div>
                                <div className="space-y-8">
                                    <div className="flex items-center gap-4">
                                        <div className="p-4 bg-info/20 rounded-2xl text-info">
                                            <HelpCircle size={32} />
                                        </div>
                                        <h2 className="text-3xl font-black text-foreground italic uppercase tracking-tighter">Comment jouer ?</h2>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-muted-foreground font-medium">
                                        <div className="space-y-4">
                                            <div className="p-6 bg-surface rounded-3xl border border-border">
                                                <h4 className="text-foreground font-black italic uppercase text-xs mb-2">1. Le Principe</h4>
                                                <p className="text-sm">Une syllabe s'affiche au centre. Tu dois trouver un mot qui la contient avant que la bombe n'explose !</p>
                                            </div>
                                            <div className="p-6 bg-surface rounded-3xl border border-border">
                                                <h4 className="text-foreground font-black italic uppercase text-xs mb-2">2. Lore Dofus</h4>
                                                <p className="text-sm">Par défaut, seuls les mots issus du monde des Douze (mobs, items, maps) sont acceptés.</p>
                                            </div>
                                        </div>
                                        <div className="space-y-4">
                                            <div className="p-6 bg-surface rounded-3xl border border-border">
                                                <h4 className="text-foreground font-black italic uppercase text-xs mb-2">3. Alphabet Bonus</h4>
                                                <p className="text-sm">Utilise chaque lettre de l'alphabet à travers tes mots pour gagner une **Vie Bonus** !</p>
                                            </div>
                                            <div className="p-6 bg-surface rounded-3xl border border-border">
                                                <h4 className="text-foreground font-black italic uppercase text-xs mb-2">4. Mode Solo</h4>
                                                <p className="text-sm">Active le Robot pour t'entraîner. Il est intelligent mais peut être battu sur la durée.</p>
                                            </div>
                                        </div>
                                    </div>
                                    <button onClick={() => setShowTutorial(false)} className="w-full py-6 bg-info hover:bg-info text-info-foreground font-black italic uppercase tracking-widest rounded-3xl shadow-xl transition-all">J'ai compris !</button>
                                </div>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </main>

            {/* INPUT AREA (Fixed at bottom) */}
            <footer className="relative z-50 p-2 md:p-4 pt-1 pb-4 md:pb-6 bg-gradient-to-t from-background via-background/90 to-transparent flex flex-col items-center justify-center border-t border-border flex-shrink-0">
                <div className="w-full max-w-xl space-y-4">
                    


                    <form onSubmit={handleSubmit} className="relative">
                        <input 
                            ref={inputRef}
                            type="text"
                            value={wordInput}
                            onChange={handleInputChange}
                            disabled={!isMyTurn || gameState.state !== 'PLAYING'}
                            placeholder={
                                gameState.state !== 'PLAYING' 
                                    ? "En attente du lancement..." 
                                    : isMyTurn 
                                        ? "Tape ton mot ici..." 
                                        : `Tour de ${currentPlayer?.userName ?? ''}...`
                            }
                            className={cn(
                                // Base — text always white and readable, caret always visible
                                "w-full h-20 bg-muted/80 bg-surface/80 backdrop-blur-xl border-2 rounded-3xl px-10 text-3xl font-black italic uppercase transition-all outline-none text-center tracking-[0.2em]",
                                "text-foreground caret-indigo-600 dark:caret-indigo-400 placeholder:text-foreground/20",
                                // State-specific border & glow
                                isMyTurn && gameState.state === 'PLAYING'
                                    ? "border-info "
                                    : "border-border opacity-40 cursor-not-allowed"
                            )}
                        />
                        {isMyTurn && gameState.state === 'PLAYING' && (
                            <button type="submit" className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-info text-info-foreground rounded-2xl flex items-center justify-center hover:bg-info active:scale-90 transition-all shadow-xl">
                                <Send size={24} />
                            </button>
                        )}
                    </form>

                    {/* LAST WORDS HISTORY (Combat Log Style) */}
                    <div className="fixed right-6 bottom-32 hidden xl:flex flex-col gap-2.5 w-72 max-w-[290px] pointer-events-none z-[80] overflow-hidden">
                        <AnimatePresence>
                            {gameState.lastFoundWords?.map((found: any, i: number) => (
                                <motion.div
                                    key={`${found.word}-${i}`}
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    className="bg-card/95 backdrop-blur-md border border-border p-3 rounded-xl shadow-lg flex flex-col gap-1 overflow-hidden max-w-full"
                                >
                                    <div className="flex justify-between items-center gap-2">
                                        <span className="text-caption text-foreground/70 font-black truncate max-w-[150px] uppercase italic flex items-center gap-1.5">
                                            {found.isBot && <span className="text-[10px]">🤖</span>}
                                            {found.playerName}
                                        </span>
                                        <span className="text-[10px] bg-success/15 text-success px-1.5 py-0.5 rounded font-black tracking-wider uppercase shrink-0">Validé</span>
                                    </div>
                                    <div className="text-xs font-black tracking-normal text-foreground italic break-words whitespace-normal leading-snug">
                                        {highlightCompoundWord(found.word, gameState.currentSyllable)}
                                    </div>
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    </div>
                    <div className="flex items-center justify-center gap-6 text-caption font-black uppercase tracking-[0.2em] text-foreground/60 italic">
                        {gameState.state === 'PLAYING' ? (
                            <>
                                <span className={cn("flex items-center gap-2", isMyTurn && "text-info")}>
                                    <Info size={12} />
                                    Contient{' '}
                                    <span className={cn("font-black text-sm", isMyTurn ? "text-info" : "text-foreground/40")}>&ldquo;{gameState.currentSyllable}&rdquo;</span>
                                </span>
                                {gameState.currentSyllableCategory && gameState.config?.dictionaryMode !== 'dofus' && (
                                    <>
                                        <span className="w-px h-4 bg-surface" />
                                        <span className="flex items-center gap-2 px-3 py-1 rounded-full bg-info/10 border border-info/20 text-info  transition-all">
                                            <span className="text-caption font-black uppercase tracking-widest opacity-50">Indice :</span>
                                            <span className="text-caption font-black uppercase italic tracking-wider">{gameState.currentSyllableCategory}</span>
                                        </span>
                                    </>
                                )}
                                <span className="w-px h-4 bg-surface" />
                                <span className="flex items-center gap-2 text-foreground/40">
                                    <AlertCircle size={12} />
                                    Dict. {gameState.config?.dictionaryMode === 'dofus' ? 'Dofus' : gameState.config?.dictionaryMode === 'mixed' ? 'Mixte' : 'FR'}
                                </span>
                            </>
                        ) : (
                            <span className="text-foreground/20 italic">Lance la partie pour commencer</span>
                        )}
                    </div>

                    {/* ALPHABET PROGRESS — visible pendant PLAYING */}
                    {gameState.state === 'PLAYING' && myPlayer && (
                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between text-caption font-black uppercase tracking-widest text-foreground/30 italic px-1">
                                <span className="flex items-center gap-1.5">
                                    <Sparkles size={10} className="text-warning/60" />
                                    Bonus Vie
                                </span>
                                <span className="tabular-nums">
                                    {myPlayer.alphabet?.length ?? 0}/26 lettres
                                </span>
                            </div>
                            <div className="flex flex-wrap justify-center gap-[3px]">
                                {"ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map(char => (
                                    <span
                                        key={char}
                                        className={cn(
                                            "w-5 h-5 flex items-center justify-center rounded-[3px] text-caption font-black transition-all duration-200",
                                            myPlayer?.alphabet?.includes(char)
                                                ? "bg-info text-info-foreground "
                                                : "bg-surface text-foreground/15"
                                        )}
                                    >
                                        {char}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* NEW LARGE HUD TIMER (BOTTOM LEFT) */}
                    <AnimatePresence>
                        {(gameState.state === 'PLAYING' || gameState.state === 'STARTING') && localTimeLeft >= 0 && (
                            <motion.div
                                key="main-timer"
                                initial={{ opacity: 0, x: -50, scale: 0.8 }}
                                animate={{ 
                                    opacity: 1, 
                                    x: 0, 
                                    scale: 1,
                                    filter: localTimeLeft <= 3 ? ["blur(0px)", "blur(1px)", "blur(0px)"] : "blur(0px)" 
                                }}
                                exit={{ opacity: 0, transition: { duration: 0.2 } }}
                                className="absolute bottom-12 left-12 z-[200] pointer-events-none"
                            >
                                <div className="relative flex flex-col items-start select-none">
                                    <div className="flex items-center gap-3 mb-[-12px]">
                                        <Timer size={24} className={cn(localTimeLeft <= 3 ? "text-danger animate-pulse" : "text-info")} />
                                        <span className="text-caption font-black uppercase tracking-widest text-foreground/20 italic">Temps Restant</span>
                                    </div>
                                    <span className={cn(
                                        "text-[120px] font-[1000] italic tabular-nums tracking-[-0.1em] leading-none transition-all duration-300 drop-shadow-[0_10px_30px_rgba(0,0,0,0.5)]",
                                        localTimeLeft <= 3 
                                            ? "text-danger animate-bounce shadow-red-500/50" 
                                            : "text-foreground"
                                    )}>
                                        {localTimeLeft}
                                    </span>
                                    {localTimeLeft <= 3 && (
                                        <motion.div 
                                            animate={{ opacity: [0, 1, 0] }}
                                            transition={{ repeat: Infinity, duration: 0.4 }}
                                            className="absolute -inset-8 bg-danger/20 blur-[60px] rounded-full z-[-1]"
                                        />
                                    )}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </footer>

            <style>{`
                @keyframes shake {
                    0%, 100% { transform: translateX(0); }
                    10%, 30%, 50%, 70%, 90% { transform: translateX(-10px); }
                    20%, 40%, 60%, 80% { transform: translateX(10px); }
                }
                .animate-shake {
                    animation: shake 0.4s cubic-bezier(.36,.07,.19,.97) both;
                }
                .custom-scrollbar::-webkit-scrollbar { width: 4px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.05); border-radius: 10px; }
            `}</style>
        </div>
        </BombErrorBoundary>
    );
}
