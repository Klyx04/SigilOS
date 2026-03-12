"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import SkribblLobby from "./SkribblLobby";
import CanvasPanel from "./CanvasPanel";
import ChatPanel from "./ChatPanel";
import TopBarInfo from "./TopBarInfo";
import { SkribblStarDecorations } from "./SkribblDecorations";
import { toast } from "sonner";
import { 
    Loader2, 
    Plus, 
    Users, 
    ArrowRight, 
    RefreshCw, 
    Palette, 
    ChevronLeft,
    X,
    Trophy,
    LogOut,
    Crown,
    ChevronDown
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { playSoundEffect, unlockAudio } from "@/lib/sounds";
import { cn } from "@/lib/utils";

const SKRIBBL_CATEGORIES = [
    { id: "Classe", label: "Classes", icon: "👥" },
    { id: "Monstre", label: "Monstres", icon: "👹" },
    { id: "Objet / Équipement", label: "Équipements", icon: "⚔️" },
    { id: "Sort / Action", label: "Sorts", icon: "🪄" },
    { id: "Personnage", label: "PNJs", icon: "🧑" },
    { id: "Ressource", label: "Ressources", icon: "💎" },
    { id: "Dofus", label: "Dofus", icon: "🥚" },
    { id: "Monture", label: "Montures", icon: "🐎" },
    { id: "Consommable", label: "Consommables", icon: "🍞" },
    { id: "Monnaie", label: "Monnaie", icon: "💰" }
];

interface AvailableRoom {
    roomId: string;
    playerCount: number;
    maxPlayers: number;
    hostName: string;
    rounds: number;
    isSpectator?: boolean;
}

export default function SkribblGame({ roomId: initialRoomId, guildId }: { roomId?: string, guildId: string }) {
    const { data: session } = useSession();
    const router = useRouter();
    const searchParams = useSearchParams();
    const isSpectatorMode = searchParams.get('spectate') === 'true';

    const [phase, setPhase] = useState<"browse" | "game">(initialRoomId ? "game" : "browse");
    const [socket, setSocket] = useState<Socket | null>(null);
    const [gameState, setGameState] = useState<any>(null);
    const [messages, setMessages] = useState<any[]>([]);
    const [currentRoomId, setCurrentRoomId] = useState<string | undefined>(initialRoomId);
    const [availableRooms, setAvailableRooms] = useState<AvailableRoom[]>([]);
    const [isCreating, setIsCreating] = useState(false);
    const [joiningId, setJoiningId] = useState<string | null>(null);

    const sessionRef = useRef(session);
    useEffect(() => { sessionRef.current = session; }, [session]);

    const currentRoomIdRef = useRef(currentRoomId);
    useEffect(() => { currentRoomIdRef.current = currentRoomId; }, [currentRoomId]);

    const lastHostId = useRef<string | null>(null);

    const buildWsUrl = useCallback((): string => {
        const proto = window.location.protocol;
        const host = window.location.hostname;
        let env = process.env.NEXT_PUBLIC_WS_URL;
        if (!env || env === "undefined") env = "";
        const isLocal = host === "localhost" || host === "127.0.0.1" || host.startsWith("192.168.");
        return env || (isLocal ? `${proto}//127.0.0.1:3001` : `${proto}//${host}:3001`);
    }, []);

    useEffect(() => {
        if (!session?.user?.id) return;

        const s = io(buildWsUrl(), {
            path: "/api/socket/",
            transports: ["websocket", "polling"],
            reconnectionAttempts: 10,
            query: { guildId }
        });
        setSocket(s);

        s.on("connect", () => {
            const rId = currentRoomIdRef.current;
            const user = sessionRef.current?.user;
            if (!user) return;
            if (rId) {
                s.emit("skribbl:room:join", {
                    roomId: rId,
                    playerObj: { 
                        userName: user.name, 
                        userId: user.id, 
                        userAvatar: user.image,
                        isSpectator: isSpectatorMode
                    }
                });
            } else {
                s.emit("skribbl:room:list");
            }
        });

        s.on("skribbl:room:list", (rooms: AvailableRoom[]) => {
            setAvailableRooms(rooms || []);
            setIsCreating(false);
            setJoiningId(null);
        });

        s.on("skribbl:room:created", ({ roomId }: { roomId: string }) => {
            const user = sessionRef.current?.user;
            if (!user) return;
            setCurrentRoomId(roomId);
            const url = new URL(window.location.href);
            url.searchParams.set("skribbl", roomId);
            window.history.replaceState(null, "", url.toString());
            s.emit("skribbl:room:join", {
                roomId,
                playerObj: { userName: user.name, userId: user.id, userAvatar: user.image }
            });
        });

        s.on("skribbl:state:sync", (state: any) => {
            // Check for host change
            if (lastHostId.current && state.hostId !== lastHostId.current) {
                const currentUserId = sessionRef.current?.user?.id;
                if (state.hostId === currentUserId || state.hostId === s.id) {
                    toast.success("Vous êtes maintenant l'hôte du salon !", { 
                        icon: <Crown className="text-yellow-400" />,
                        description: "Vous pouvez maintenant configurer et lancer la partie."
                    });
                    playSoundEffect("success");
                } else {
                    const newHost = state.players?.find((p: any) => p.userId === state.hostId || p.id === state.hostId);
                    if (newHost) {
                        toast.info(`${newHost.userName} est le nouvel hôte.`, { icon: "👑" });
                    }
                }
            }
            lastHostId.current = state.hostId;
            setGameState(state);
            if (phase !== "game") setPhase("game");
        });

        s.on("skribbl:chat:message", (msg: any) => {
            setMessages(prev => [...prev, msg]);
            if (msg.type === "system") {
                if (msg.text.includes("rejoint")) {
                    toast.success(msg.text, { icon: "👋" });
                    playSoundEffect("ding");
                } else if (msg.text.includes("quitté") || msg.text.includes("fui")) {
                    toast.error(msg.text, { icon: "🚪" });
                }
            }
        });

        s.on("skribbl:error", (err: any) => {
            toast.error(err.message || "Une erreur est survenue");
            setIsCreating(false);
            setJoiningId(null);
        });

        s.on("skribbl:room:deleted", () => {
            toast.error("Le salon a été fermé par l'hôte.");
            setGameState(null);
            setCurrentRoomId(undefined);
            setPhase("browse");
            setTimeout(() => s.emit("skribbl:room:list"), 600);
        });

        s.on("skribbl:sound:play", (soundName: "tick" | "ding" | "fail" | "success") => {
            playSoundEffect(soundName);
        });

        return () => { s.disconnect(); };
    }, [session?.user?.id, buildWsUrl, guildId]);

    useEffect(() => {
        const handleInteraction = () => {
            import("@/lib/sounds").then(({ resumeAudioContext }) => {
                resumeAudioContext();
            });
            window.removeEventListener("mousedown", handleInteraction);
            window.removeEventListener("keydown", handleInteraction);
            window.removeEventListener("touchstart", handleInteraction);
        };
        window.addEventListener("mousedown", handleInteraction);
        window.addEventListener("keydown", handleInteraction);
        window.addEventListener("touchstart", handleInteraction);
        return () => {
            window.removeEventListener("mousedown", handleInteraction);
            window.removeEventListener("keydown", handleInteraction);
            window.removeEventListener("touchstart", handleInteraction);
        };
    }, []);

    useEffect(() => {
        if (gameState?.state === "GAME_END") {
            playSoundEffect("ranking");
        }
    }, [gameState?.state]);

    const handleCreate = useCallback(() => {
        if (!socket || isCreating) return;
        setIsCreating(true);
        socket.emit("skribbl:room:create", {
            rounds: 3,
            duration: 60,
            playerObj: { userId: sessionRef.current?.user?.id }
        });
    }, [socket, isCreating]);

    const handleJoin = useCallback((roomId: string, asSpectator: boolean = false) => {
        if (!socket || joiningId) return;
        const user = sessionRef.current?.user;
        if (!user) return;
        setJoiningId(roomId);
        setCurrentRoomId(roomId);
        socket.emit("skribbl:room:join", {
            roomId,
            playerObj: { 
                userName: user.name, 
                userId: user.id, 
                userAvatar: user.image,
                isSpectator: asSpectator 
            }
        });
    }, [socket, joiningId]);

    const handleRefreshList = useCallback(() => {
        socket?.emit("skribbl:room:list");
    }, [socket]);

    const handleExitToMenu = useCallback(() => {
        socket?.emit("skribbl:room:leave");
        router.push(`/dashboard/${guildId}/mini-jeux#mini-jeux`);
    }, [socket, router, guildId]);

    if (phase === "browse" || !gameState) {
        return (
            <div className="min-h-screen h-full w-full bg-[#1a4e9b] flex flex-col items-center justify-start sm:justify-center p-8 relative overflow-x-hidden"
                 style={{ 
                     backgroundImage: `url('https://skribbl.io/res/background.png')`,
                     backgroundRepeat: 'repeat',
                     backgroundSize: 'auto'
                 }}
            >
                {/* Exit Button in Browse Mode */}
                <button 
                    onClick={handleExitToMenu}
                    className="absolute top-6 right-6 z-[100] px-6 py-3 bg-red-500 hover:bg-red-400 text-white rounded-2xl border-b-4 border-black/20 transition-all hover:scale-105 active:scale-95 shadow-2xl flex items-center gap-2 font-black italic uppercase text-xs"
                >
                    <LogOut size={18} />
                    <span>Quitter</span>
                </button>

                <SkribblStarDecorations />

                <div className="relative z-10 text-center mb-10">
                    <div className="flex items-center justify-center gap-3 mb-4">
                        <Palette size={36} className="text-blue-400" />
                        <h1 className="text-4xl md:text-6xl font-black italic text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-cyan-300 to-purple-500 drop-shadow-lg">
                            SIGIL-DRAW
                        </h1>
                    </div>
                    <p className="text-slate-400 text-[10px] md:text-xs font-black tracking-[0.4em] uppercase">
                        Le Pictionary des Douze
                    </p>
                </div>

                {!session ? (
                    <div className="text-white/30 text-sm flex items-center gap-2">
                        <Loader2 size={16} className="animate-spin" /> Connexion requise...
                    </div>
                ) : !socket?.connected ? (
                    <div className="flex flex-col items-center gap-3 text-white/40">
                        <Loader2 className="animate-spin" size={32} />
                        <p className="text-xs font-black uppercase tracking-widest">Connexion au serveur...</p>
                    </div>
                ) : (
                    <div className="relative z-10 w-full max-w-xl space-y-4">
                        <div className="flex gap-4">
                            <button
                                onClick={handleExitToMenu}
                                className="px-4 md:px-6 py-4 md:py-5 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 text-white font-black uppercase text-[10px] md:text-xs tracking-widest transition-all active:scale-[0.98] flex items-center justify-center gap-3 shrink-0"
                            >
                                <ChevronLeft size={18} />
                                Menu
                            </button>
                            <button
                                onClick={handleCreate}
                                disabled={isCreating}
                                className="flex-1 py-4 md:py-5 rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-black uppercase text-xs md:text-sm italic tracking-wider shadow-xl shadow-blue-500/20 transition-all active:scale-[0.98] disabled:opacity-60 flex items-center justify-center gap-3"
                            >
                                {isCreating ? <Loader2 className="animate-spin" size={18} /> : <Plus size={18} />}
                                Créer un Salon
                            </button>
                        </div>

                        <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-white/60 font-black uppercase text-[10px] tracking-widest flex items-center gap-2">
                                    <Users size={12} className="text-blue-400" /> Salons disponibles
                                </h3>
                                <button onClick={handleRefreshList} className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/30 hover:text-white transition-colors" title="Rafraîchir">
                                    <RefreshCw size={11} />
                                </button>
                            </div>
                            {availableRooms.length === 0 ? (
                                <p className="text-white/20 text-xs text-center py-6 italic">
                                    Aucun salon actif — créez la légende !
                                </p>
                            ) : (
                                <div className="space-y-2 max-h-56 overflow-y-auto pr-1 custom-scrollbar">
                                    {availableRooms.map(room => (
                                        <div key={room.roomId} className="flex items-center justify-between p-3.5 rounded-xl bg-slate-900/60 border border-white/5 hover:border-blue-500/30 transition-all">
                                            <div>
                                                <p className="text-white font-bold text-sm">{room.hostName}</p>
                                                <p className="text-white/30 text-[10px] font-mono">
                                                    {room.playerCount}/{room.maxPlayers} joueurs · {room.rounds} rounds
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => handleJoin(room.roomId)}
                                                    disabled={!!joiningId || room.playerCount >= room.maxPlayers}
                                                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500 hover:text-white font-black text-[10px] uppercase transition-all disabled:opacity-40"
                                                >
                                                    {joiningId === room.roomId ? <Loader2 size={11} className="animate-spin" /> : <ArrowRight size={11} />}
                                                    Jouer
                                                </button>
                                                <button
                                                    onClick={() => handleJoin(room.roomId, true)}
                                                    disabled={!!joiningId}
                                                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 text-white/40 border border-white/5 hover:bg-white/10 hover:text-white transition-all text-[8px] uppercase font-black"
                                                >
                                                    Regarder
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        );
    }

    const isDrawer = !isSpectatorMode && (gameState?.drawerId === socket?.id ||
        (!!session?.user?.id && gameState?.players?.find((p: any) => p.isDrawing && p.userId === session?.user?.id) !== undefined));
    const isHost = gameState?.hostId === session?.user?.id || gameState?.hostId === socket?.id;

    return (
        <div 
            className="min-h-screen h-full w-full bg-[#1a4e9b] font-sans flex flex-col items-center justify-start sm:justify-center p-2 md:p-8 overflow-x-hidden"
            onClick={unlockAudio}
            style={{ 
                backgroundImage: `url('https://skribbl.io/res/background.png')`,
                backgroundRepeat: 'repeat',
                backgroundSize: 'auto'
            }}
        >
            {/* STYLED EXIT BUTTON */}
            <button 
                onClick={handleExitToMenu}
                className="fixed top-2 right-2 md:top-6 md:right-6 z-[200] px-4 md:px-6 py-2 md:py-3 bg-red-500 hover:bg-red-400 text-white rounded-xl md:rounded-2xl border-b-4 border-black/20 transition-all hover:scale-105 active:scale-95 shadow-2xl flex items-center gap-2 font-black italic uppercase text-[10px] md:text-xs group"
                title="Quitter la partie"
            >
                <LogOut size={16} className="group-hover:-translate-x-1 transition-transform" />
                <span className="hidden sm:inline">Quitter</span>
                <span className="sm:hidden">Sortir</span>
            </button>

            <div className="w-full max-w-[95vw] flex flex-col gap-4 md:gap-6 mx-auto animate-in fade-in zoom-in duration-500 py-2 md:py-4 px-1 md:px-2 relative h-[95vh] md:h-[90vh]">
                <div className="flex justify-center shrink-0">
                    <img 
                        src="https://skribbl.io/res/logo.gif" 
                        alt="skribbl.io" 
                        className="h-12 md:h-20 drop-shadow-[0_8px_0_rgba(0,0,0,0.15)] filter brightness-110" 
                    />
                </div>

                <div className="flex gap-4 items-stretch justify-center w-full grow min-h-0 overflow-hidden">
                    {/* Main Game Area - Fluid */}
                    <div className="flex flex-col flex-1 gap-4 min-w-0 h-full max-w-full">
                        <div className="bg-white/10 backdrop-blur-xl rounded-[2rem] md:rounded-[2.5rem] p-2 flex flex-col border-2 border-white/20 flex-1 shadow-2xl relative overflow-hidden">
                            <div className="flex flex-col lg:flex-row gap-3 md:gap-4 h-full min-h-0 overflow-hidden">
                                {/* LEFT SIDEBAR: Players - Collapsible on mobile */}
                                <div className="w-full lg:w-[200px] xl:w-[260px] h-[100px] sm:h-[130px] lg:h-full shrink-0 bg-black/20 backdrop-blur-md rounded-[1.5rem] lg:rounded-[2.5rem] border border-white/10 shadow-inner overflow-hidden">
                                    {socket && <SkribblLobby gameState={gameState} socket={socket} />}
                                </div>

                                {/* CENTER: Main Game Area */}
                                <div className="flex-1 flex flex-col gap-3 md:gap-4 min-w-0 h-full min-h-0">
                                    {/* Header Panel */}
                                    <div className="bg-white/80 backdrop-blur-md rounded-[1.5rem] md:rounded-[2rem] min-h-[60px] md:min-h-[80px] flex items-center px-4 md:px-8 relative shadow-xl border-b-4 border-black/5 shrink-0 overflow-hidden">
                                        {gameState.state !== "LOBBY" ? (
                                            <div className="flex-1 flex items-center justify-between w-full">
                                                {socket && <TopBarInfo gameState={gameState} socket={socket} isDrawer={isDrawer} />}
                                                
                                                {/* IN-GAME EXIT BUTTON (Small/Mobile friendly) */}
                                                <button 
                                                    onClick={handleExitToMenu}
                                                    className="ml-2 p-2 md:px-4 md:py-2 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded-xl border border-red-500/20 transition-all flex items-center gap-2 font-black uppercase text-[8px] md:text-[10px] italic group"
                                                    title="Quitter la partie"
                                                >
                                                    <LogOut size={14} className="group-hover:translate-x-0.5 transition-transform" />
                                                    <span className="hidden md:inline">Quitter</span>
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="w-full flex justify-between items-center text-[#5d3fd3] font-black uppercase text-[10px] md:text-xs tracking-[0.2em] italic">
                                                <div className="flex items-center gap-2">
                                                    <Loader2 className="animate-spin" size={14} />
                                                    <span>En attente...</span>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <div className="hidden sm:flex items-center gap-2 bg-[#5d3fd3]/10 px-3 md:px-4 py-1.5 rounded-full border border-[#5d3fd3]/20">
                                                        <Users size={12} /> 
                                                        <span>{gameState.players?.length || 0} JOUEURS</span>
                                                    </div>
                                                    <button 
                                                        onClick={handleExitToMenu}
                                                        className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded-xl border border-red-500/20 transition-all flex items-center gap-2 font-black uppercase text-[8px] md:text-[10px] italic group"
                                                    >
                                                        <LogOut size={14} className="group-hover:-translate-x-0.5 transition-transform" />
                                                        <span>Quitter</span>
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Drawing Board Container */}
                                    <div className="flex-1 relative min-h-0 bg-white/5 rounded-[1.5rem] md:rounded-[2.5rem] overflow-hidden border-2 border-white/20 shadow-2xl">
                                        {gameState.state === "LOBBY" ? (
                                            <div className="flex flex-col items-center justify-center h-full p-4 text-center overflow-y-auto custom-scrollbar">
                                                 <div className="bg-[#41417a] p-4 md:p-8 rounded-[2rem] md:rounded-[3rem] border-b-8 border-black/20 w-full max-w-xl shadow-2xl flex flex-col items-center">
                                                     <h2 className="text-[#eeeeee] text-2xl md:text-4xl font-black uppercase italic tracking-tighter mb-4 md:mb-8 drop-shadow-md">SALON D'ATTENTE</h2>
                                                     <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4 w-full mb-6 md:mb-10 text-left">
                                                         <div className="flex flex-col gap-1.5">
                                                             <span className="text-[8px] md:text-[10px] font-black text-[#8b8bc5] uppercase tracking-widest pl-1">Joueurs</span>
                                                             <div className="bg-[#2c2c54] text-white w-full py-2.5 md:py-3.5 rounded-xl md:rounded-2xl border border-white/5 font-bold text-xs md:text-base shadow-inner flex items-center justify-center gap-2">
                                                                 <Users size={14} className="text-blue-400" />
                                                                 {gameState?.players?.length || 0} / 8
                                                             </div>
                                                         </div>
                                                         <div className="flex flex-col gap-1.5">
                                                             <span className="text-[8px] md:text-[10px] font-black text-[#8b8bc5] uppercase tracking-widest pl-1">Manches</span>
                                                             {isHost ? (
                                                                 <div className="relative">
                                                                    <select 
                                                                        value={gameState?.maxRounds || 3}
                                                                        onChange={(e) => socket?.emit("skribbl:room:settings", { rounds: parseInt(e.target.value) })}
                                                                        className="bg-[#2c2c54] text-white w-full py-2.5 md:py-3.5 rounded-xl md:rounded-2xl border border-white/5 font-bold text-xs md:text-base shadow-inner px-4 outline-none appearance-none cursor-pointer hover:bg-[#353565] transition-colors pr-10"
                                                                    >
                                                                        {[1,2,3,4,5,6,7,8,9,10].map(r => <option key={r} value={r}>{r}</option>)}
                                                                    </select>
                                                                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-white/20"><ChevronDown size={14} /></div>
                                                                 </div>
                                                             ) : (
                                                                <div className="bg-[#2c2c54] text-white w-full py-2.5 md:py-3.5 rounded-xl md:rounded-2xl border border-white/5 font-bold text-xs md:text-base shadow-inner flex items-center justify-center">
                                                                    {gameState?.maxRounds || 3}
                                                                </div>
                                                             )}
                                                         </div>
                                                         <div className="flex flex-col gap-1.5 col-span-2 md:col-span-1">
                                                              <span className="text-[8px] md:text-[10px] font-black text-[#8b8bc5] uppercase tracking-widest pl-1">Difficulté</span>
                                                              {isHost ? (
                                                                  <div className="relative">
                                                                    <select 
                                                                        value={gameState?.difficulty || "moyen"}
                                                                        onChange={(e) => socket?.emit("skribbl:room:settings", { difficulty: e.target.value })}
                                                                        className="bg-[#2c2c54] text-white w-full py-2.5 md:py-3.5 rounded-xl md:rounded-2xl border border-white/5 font-bold text-xs md:text-base shadow-inner px-4 outline-none appearance-none cursor-pointer hover:bg-[#353565] transition-colors pr-10"
                                                                    >
                                                                        <option value="facile">Facile</option>
                                                                        <option value="moyen">Moyen</option>
                                                                        <option value="difficile">Difficile</option>
                                                                    </select>
                                                                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-white/20"><ChevronDown size={14} /></div>
                                                                  </div>
                                                              ) : (
                                                                 <div className="bg-[#2c2c54] text-white w-full py-2.5 md:py-3.5 rounded-xl md:rounded-2xl border border-white/5 font-bold text-xs md:text-base shadow-inner flex items-center justify-center capitalize">
                                                                     {gameState?.difficulty || "moyen"}
                                                                 </div>
                                                              )}
                                                         </div>
                                                     </div>

                                                     {/* CATEGORIES SELECTION */}
                                                     <div className="w-full flex flex-col gap-2 mb-8 bg-[#2c2c54]/50 p-4 rounded-[1.5rem] border border-white/5 shadow-inner">
                                                          <div className="flex items-center justify-between mb-2">
                                                              <div className="flex flex-col">
                                                                  <span className="text-[8px] md:text-[10px] font-black text-[#8b8bc5] uppercase tracking-widest pl-1">Catégories de mots</span>
                                                                  <span className="text-[7px] text-[#8b8bc5]/50 italic pl-1 lowercase">Si aucune n'est choisie, tout est activé</span>
                                                              </div>
                                                              {isHost && (
                                                                  <button 
                                                                      onClick={() => {
                                                                          const allIds = SKRIBBL_CATEGORIES.map((cat: any) => cat.id);
                                                                          const current = gameState?.allowedCategories || [];
                                                                          const next = current.length === allIds.length ? [] : allIds;
                                                                          socket?.emit("skribbl:room:settings", { categories: next });
                                                                      }}
                                                                      className="text-[8px] font-black text-blue-400 uppercase tracking-widest hover:text-blue-300 transition-colors bg-blue-500/10 px-2 py-1 rounded-lg"
                                                                  >
                                                                      {(gameState?.allowedCategories?.length || 0) === SKRIBBL_CATEGORIES.length ? "Tout décocher" : "Tout cocher"}
                                                                  </button>
                                                              )}
                                                          </div>
                                                          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                                                              {SKRIBBL_CATEGORIES.map((cat: any) => {
                                                                  const allowed = gameState?.allowedCategories || [];
                                                                  const isSelected = allowed.length === 0 || allowed.includes(cat.id);
                                                                  return (
                                                                      <button
                                                                          key={cat.id}
                                                                          disabled={!isHost}
                                                                          onClick={() => {
                                                                              const current = gameState?.allowedCategories || [];
                                                                              let next = [];
                                                                              if (current.includes(cat.id)) {
                                                                                  next = current.filter((c: string) => c !== cat.id);
                                                                              } else {
                                                                                  next = [...current, cat.id];
                                                                              }
                                                                              socket?.emit("skribbl:room:settings", { categories: next });
                                                                          }}
                                                                          className={cn(
                                                                              "flex items-center gap-2 p-2 md:p-3 rounded-xl border transition-all text-left group relative overflow-hidden",
                                                                              isSelected
                                                                                  ? "bg-blue-600/30 border-blue-500/50 text-blue-100 shadow-[0_0_15px_rgba(59,130,246,0.1)]"
                                                                                  : "bg-[#1a1a3a] border-white/5 text-white/20 grayscale opacity-40",
                                                                              isHost && "hover:border-blue-500/60 active:scale-95 cursor-pointer"
                                                                          )}
                                                                      >
                                                                          {isSelected && (
                                                                              <motion.div 
                                                                                  layoutId={`cat-bg-${cat.id}`}
                                                                                  className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-transparent pointer-events-none" 
                                                                              />
                                                                          )}
                                                                          <span className="text-sm md:text-base group-hover:scale-110 transition-transform relative z-10">{cat.icon}</span>
                                                                          <span className="text-[8px] md:text-[10px] font-black uppercase tracking-tight leading-none truncate relative z-10">{cat.label}</span>
                                                                      </button>
                                                                  );
                                                              })}
                                                          </div>
                                                     </div>
                                                     <div className="w-full flex flex-col gap-4">
                                                         {isHost ? (() => {
                                                             const canStart = (gameState?.players?.length || 0) >= 2;
                                                             return (
                                                                 <div className="flex flex-col gap-3">
                                                                     <div className="flex flex-col sm:flex-row gap-3">
                                                                        <button
                                                                            onClick={() => canStart && socket?.emit("skribbl:game:start")}
                                                                            disabled={!canStart}
                                                                            className={cn(
                                                                                "flex-[2] py-4 md:py-6 border-b-8 md:border-b-[10px] text-white font-black rounded-2xl md:rounded-[2rem] text-xl md:text-4xl transition-all uppercase tracking-tighter italic",
                                                                                canStart
                                                                                    ? "bg-[#52ce3c] hover:bg-[#5df044] border-[#2d7a1d] active:border-b-0 active:translate-y-2 shadow-[0_15px_30px_rgba(59,156,42,0.3)] cursor-pointer"
                                                                                    : "bg-slate-600/40 border-slate-800/50 cursor-not-allowed opacity-60"
                                                                            )}
                                                                        >
                                                                            LANCER !
                                                                        </button>
                                                                        <button
                                                                            onClick={handleExitToMenu}
                                                                            className="flex-1 py-4 px-6 md:py-6 md:px-8 border-b-8 md:border-b-[10px] bg-red-500 hover:bg-red-400 border-red-700 text-white font-black rounded-2xl md:rounded-[2rem] text-sm md:text-lg transition-all uppercase italic shadow-xl active:border-b-0 active:translate-y-2 flex items-center justify-center gap-2"
                                                                        >
                                                                            <X size={20} />
                                                                            Annuler
                                                                        </button>
                                                                     </div>
                                                                     {!canStart && (
                                                                         <p className="text-center text-amber-400 text-[10px] md:text-sm font-black uppercase tracking-widest animate-pulse italic">
                                                                             ⚠️ Il faut au moins 2 joueurs !
                                                                         </p>
                                                                     )}
                                                                 </div>
                                                             );
                                                         })() : (
                                                             <div className="flex flex-col items-center py-6 gap-6">
                                                                 <div className="flex flex-col items-center gap-4">
                                                                    <Loader2 size={40} className="animate-spin text-white/40" />
                                                                    <p className="text-white/40 font-black uppercase text-xs sm:text-sm tracking-[0.3em] italic">En attente du Maître...</p>
                                                                 </div>
                                                                 <button
                                                                    onClick={handleExitToMenu}
                                                                    className="w-full py-4 border-b-8 bg-red-500 hover:bg-red-400 border-red-700 text-white font-black rounded-2xl text-sm transition-all uppercase italic shadow-xl active:border-b-0 active:translate-y-2 flex items-center justify-center gap-2"
                                                                 >
                                                                    <LogOut size={18} />
                                                                    Quitter le salon
                                                                 </button>
                                                             </div>
                                                         )}
                                                     </div>
                                                 </div>
                                            </div>
                                        ) : socket ? (
                                            <div className="absolute inset-0 flex flex-col overflow-hidden">
                                                <CanvasPanel socket={socket} gameState={gameState} isDrawer={isDrawer} isSpectator={isSpectatorMode} />
                                            </div>
                                        ) : null}

                                        {/* Overlays - Fixed and constrained to the board area */}
                                        <AnimatePresence>
                                            {gameState.state === "SELECTING_WORD" && isDrawer && gameState.wordChoices?.length > 0 && (
                                                <motion.div 
                                                    initial={{ opacity: 0 }}
                                                    animate={{ opacity: 1 }}
                                                    exit={{ opacity: 0 }}
                                                    className="absolute inset-0 z-50 bg-[#1a4e9b]/95 backdrop-blur-md flex flex-col items-center justify-center gap-6 md:gap-10 p-4"
                                                >
                                                    <div className="text-center">
                                                        <p className="text-[#ffcc00] font-black uppercase tracking-[0.4em] text-[10px] md:text-sm mb-2 md:mb-4 italic">Ton tour de dessiner</p>
                                                        <h2 className="text-white font-black text-2xl md:text-5xl uppercase italic leading-none truncate max-w-full">Choisis un mot</h2>
                                                        <div className="mt-4 md:mt-6 bg-white/10 px-6 py-2 rounded-full border border-white/10 inline-block">
                                                            <span className="text-white font-black text-sm md:text-lg italic tabular-nums">{gameState.timeLeft}s</span>
                                                        </div>
                                                    </div>
                                                    <div className="flex gap-2 md:gap-4 flex-wrap justify-center max-w-4xl overflow-y-auto max-h-[60%] py-4 px-2">
                                                        {gameState.wordChoices.map((choice: any) => (
                                                            <button
                                                                key={choice.word}
                                                                onClick={() => socket?.emit("skribbl:word:select", { word: choice.word })}
                                                                className="group relative flex flex-col items-center gap-2 md:gap-4 p-4 md:p-8 bg-white hover:bg-yellow-400 rounded-2xl md:rounded-[2.5rem] border-b-[6px] md:border-b-[10px] border-black/10 hover:border-yellow-600 transition-all active:scale-95 shadow-2xl min-w-[120px] md:min-w-[200px]"
                                                            >
                                                                <div className="w-12 h-12 md:w-24 md:h-24 bg-slate-50 rounded-xl md:rounded-3xl p-2 flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform">
                                                                    {choice.iconUrl && <img src={choice.iconUrl} alt="" className="w-full h-full object-contain" />}
                                                                </div>
                                                                <span className="text-slate-900 group-hover:text-black font-black text-xs md:text-xl uppercase italic tracking-tight">{choice.word}</span>
                                                            </button>
                                                        ))}
                                                    </div>
                                                </motion.div>
                                            )}

                                            {gameState.state === "SELECTING_WORD" && !isDrawer && (
                                                <motion.div 
                                                    initial={{ opacity: 0 }}
                                                    animate={{ opacity: 1 }}
                                                    exit={{ opacity: 0 }}
                                                    className="absolute inset-0 z-50 bg-[#1a4e9b]/90 backdrop-blur-md flex flex-col items-center justify-center gap-4 text-center p-6"
                                                >
                                                    <Loader2 size={48} className="animate-spin text-[#ffcc00] mb-4" />
                                                    <p className="text-white font-black text-xl md:text-4xl uppercase italic tracking-tighter leading-tight max-w-lg">
                                                        <span className="text-[#ffcc00]">{gameState.players?.find((p: any) => p.isDrawing)?.userName || "L'artiste"}</span> est en train de choisir un mot...
                                                    </p>
                                                    <p className="text-white/30 text-xs md:text-sm font-bold uppercase tracking-widest mt-2">{gameState.timeLeft}s restantes</p>
                                                </motion.div>
                                            )}

                                            {gameState.state === "ROUND_END" && (
                                                 <motion.div 
                                                    initial={{ opacity: 0, scale: 0.9 }}
                                                    animate={{ opacity: 1, scale: 1 }}
                                                    exit={{ opacity: 0, scale: 1.1 }}
                                                    className="absolute inset-0 bg-slate-950/90 flex flex-col items-center justify-center z-50 backdrop-blur-md p-6 text-center"
                                                 >
                                                     <span className="text-white/40 text-xs md:text-2xl font-black mb-2 md:mb-4 uppercase tracking-[0.3em] italic">Le mot était</span>
                                                     <div className="relative group">
                                                         <div className="absolute inset-0 bg-white blur-3xl opacity-20 group-hover:opacity-40 transition-opacity" />
                                                         <span className="relative text-[#ffcc00] text-3xl md:text-8xl font-black uppercase tracking-tight mb-6 md:mb-10 block drop-shadow-2xl italic">{gameState.currentWord}</span>
                                                     </div>
                                                     <div className="h-1.5 w-24 md:w-60 bg-gradient-to-r from-transparent via-[#52ce3c] to-transparent rounded-full opacity-50" />
                                                 </motion.div>
                                            )}

                                            {gameState.state === "GAME_END" && (
                                                <motion.div 
                                                    initial={{ opacity: 0 }}
                                                    animate={{ opacity: 1 }}
                                                    className="absolute inset-0 bg-slate-950/95 flex flex-col items-center justify-center z-50 backdrop-blur-xl gap-8 p-6"
                                                >
                                                    <div className="relative">
                                                        <div className="absolute inset-0 bg-yellow-400 blur-3xl opacity-20 animate-pulse" />
                                                        <Trophy className="w-16 h-16 md:w-32 md:h-32 text-yellow-400 drop-shadow-[0_0_30px_rgba(250,204,21,0.5)] relative z-10" />
                                                    </div>
                                                    <div className="text-center">
                                                        <h2 className="text-white font-black text-3xl md:text-6xl uppercase italic tracking-tighter mb-2">PARTIE TERMINÉE !</h2>
                                                        <p className="text-white/40 font-black uppercase text-[10px] md:text-sm tracking-[0.4em] italic">Le Hall des Champions est là</p>
                                                    </div>
                                                    
                                                    <div className="flex flex-col gap-3 w-full max-w-[400px]">
                                                        {[...gameState.players].sort((a: any, b: any) => b.score - a.score).slice(0, 3).map((p: any, i: number) => (
                                                            <div 
                                                                key={p.id} 
                                                                className={cn(
                                                                    "flex items-center justify-between px-6 py-4 md:py-6 rounded-2xl md:rounded-3xl border transition-all", 
                                                                    i === 0 
                                                                        ? "bg-yellow-400/20 border-yellow-400/40 shadow-[0_15px_30px_-10px_rgba(250,204,21,0.2)] md:scale-110" 
                                                                        : "bg-white/5 border-white/5"
                                                                )}
                                                            >
                                                                <div className="flex items-center gap-4">
                                                                    <span className="text-2xl md:text-4xl">{i === 0 ? "🥇" : i === 1 ? "🥈" : "🥉"}</span>
                                                                    <span className="text-white font-black text-sm md:text-xl uppercase italic truncate max-w-[120px] md:max-w-[200px]">{p.userName}</span>
                                                                </div>
                                                                <div className="text-right">
                                                                    <span className="text-yellow-400 font-black text-sm md:text-2xl italic tracking-tighter tabular-nums">{p.score}</span>
                                                                    <span className="text-white/20 text-[8px] md:text-[10px] font-black uppercase tracking-widest block">KAMAS</span>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                </div>

                                {/* RIGHT SIDEBAR: Chat - Adaptive height */}
                                <div className="w-full lg:w-[240px] xl:w-[320px] h-[150px] sm:h-[200px] lg:h-full shrink-0 bg-white/95 backdrop-blur-md rounded-[1.5rem] lg:rounded-[2.5rem] flex flex-col overflow-hidden border border-white/20 shadow-2xl">
                                    {socket && <ChatPanel socket={socket} messages={messages} gameState={gameState} isDrawer={isDrawer} isSpectator={isSpectatorMode} />}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
