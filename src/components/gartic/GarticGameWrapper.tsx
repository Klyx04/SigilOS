"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import { useSession } from "next-auth/react";
import { GarticLayout } from "./GarticLayout";
import { LobbyScreen } from "./LobbyScreen";
import { DrawingScreen } from "./DrawingScreen";
import { GuessingScreen } from "./GuessingScreen";
import { RevealScreen } from "./RevealScreen";
import { Loader2, Plus, Users, ArrowRight, RefreshCw, Phone, Sparkles, X, ArrowRightCircle, Trophy, Crown, Home, LogOut } from "lucide-react";
import { toast } from "sonner";
import { playSoundEffect } from "@/lib/sounds";
import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

interface AvailableRoom {
    roomId: string;
    playerCount: number;
    maxPlayers: number;
    mode: string;
}

export default function GarticGameWrapper({ roomId: initialRoomId, guildId }: { roomId?: string, guildId: string }) {
    const { data: session } = useSession();
    const router = useRouter();
    const searchParams = useSearchParams();
    const isSpectatorMode = searchParams.get('spectate') === 'true';

    const [phase, setPhase] = useState<"browse" | "game">(initialRoomId ? "game" : "browse");
    const [socket, setSocket] = useState<Socket | null>(null);
    const [gameState, setGameState] = useState<any>(null);
    const [currentRoomId, setCurrentRoomId] = useState<string | undefined>(initialRoomId);
    const [availableRooms, setAvailableRooms] = useState<AvailableRoom[]>([]);
    const [isCreating, setIsCreating] = useState(false);
    const [joiningId, setJoiningId] = useState<string | null>(null);

    // Stable refs
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
                s.emit("gartic:room:join", { 
                    roomId: rId, 
                    playerObj: { 
                        userName: user.name, 
                        userId: user.id, 
                        userAvatar: user.image,
                        isSpectator: isSpectatorMode
                    } 
                });
            } else {
                s.emit("gartic:room:list");
            }
        });

        s.on("gartic:room:list", (rooms: AvailableRoom[]) => {
            setAvailableRooms(rooms || []);
            setIsCreating(false);
            setJoiningId(null);
        });

        s.on("gartic:room:created", ({ roomId }: { roomId: string }) => {
            const user = sessionRef.current?.user;
            if (!user) return;
            setCurrentRoomId(roomId);
            setIsCreating(false); 
            const url = new URL(window.location.href);
            url.searchParams.set("room", roomId);
            window.history.replaceState(null, "", url.toString());
            s.emit("gartic:room:join", { 
                roomId, 
                playerObj: { userName: user.name, userId: user.id, userAvatar: user.image } 
            });
        });

        s.on("gartic:state:update", (state: any) => {
            // Host migration notification
            if (lastHostId.current && state.hostId !== lastHostId.current) {
                const currentUserId = sessionRef.current?.user?.id;
                if (state.hostId === currentUserId || state.hostId === socket?.id) {
                    toast.success("Vous êtes maintenant l'hôte du salon !", { 
                        icon: <Crown className="text-yellow-400" />,
                        description: "Vous pouvez maintenant lancer la partie."
                    });
                    playSoundEffect("success");
                } else {
                    const newHost = state.players?.find((p: any) => p.id === state.hostId);
                    if (newHost) {
                        toast.info(`${newHost.username} est le nouvel hôte.`, { icon: "👑" });
                    }
                }
            }
            lastHostId.current = state.hostId;

            setGameState((prev: any) => {
                if (prev?.phase !== state.phase) {
                    if (state.phase === "REVEAL") playSoundEffect("success");
                    else if (state.phase !== "LOBBY" && state.phase !== "STARTING") playSoundEffect("ding");
                }
                return state;
            });
            if (phase !== "game") setPhase("game");
        });

        s.on("gartic:error", (err: any) => {
            toast.error(err.message || "Une erreur est survenue");
            setIsCreating(false);
            setJoiningId(null);
        });

        s.on("gartic:sound:play", (soundName: "tick" | "ding" | "fail" | "success") => {
            playSoundEffect(soundName);
        });

        return () => { s.disconnect(); };
    }, [session?.user?.id, buildWsUrl]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleCreate = useCallback(() => {
        if (!socket || isCreating) return;
        const user = sessionRef.current?.user;
        if (!user) return;
        setIsCreating(true);
        socket.emit("gartic:room:create", {
            maxPlayers: 14, drawTime: 60, mode: "NORMAL",
            userName: user.name, userId: user.id, userAvatar: user.image,
        });
    }, [socket, isCreating]);

    const handleJoin = useCallback((roomId: string, asSpectator: boolean = false) => {
        if (!socket || joiningId) return;
        const user = sessionRef.current?.user;
        if (!user) return;
        setJoiningId(roomId);
        setCurrentRoomId(roomId);
        socket.emit("gartic:room:join", { 
            roomId, 
            playerObj: { 
                userName: user.name, 
                userId: user.id, 
                userAvatar: user.image,
                isSpectator: asSpectator 
            } 
        });
    }, [socket, joiningId]);

    const handleRefresh = useCallback(() => { socket?.emit("gartic:room:list"); }, [socket]);

    const handleReturnToLobby = useCallback(() => {
        setPhase("browse");
        setGameState(null);
        setCurrentRoomId(undefined);
        const url = new URL(window.location.href);
        url.searchParams.delete("room");
        window.history.replaceState(null, "", url.toString());
        setTimeout(() => socket?.emit("gartic:room:list"), 300);
    }, [socket]);

    const handleExitToMenu = useCallback(() => {
        socket?.emit("gartic:room:leave");
        router.push(`/dashboard/${guildId}/mini-jeux#mini-jeux`);
    }, [socket, router, guildId]);

    // ── PHASE BROWSE ──
    if (phase === "browse" || !gameState) {
        return (
            <GarticLayout phase="BROWSE" onClose={handleExitToMenu}>
                <div className="flex flex-col items-center justify-center h-full w-full max-w-4xl mx-auto gap-12 animate-in fade-in zoom-in duration-700">
                    <button 
                        onClick={handleExitToMenu}
                        className="fixed top-6 right-6 z-[200] px-6 py-3 bg-red-500 hover:bg-red-400 text-white rounded-2xl border-b-4 border-black/20 transition-all hover:scale-105 active:scale-95 shadow-2xl flex items-center gap-2 font-black italic uppercase text-xs"
                    >
                        <LogOut size={18} />
                        <span>Quitter</span>
                    </button>

                    {/* Header */}
                    <div className="text-center px-4">
                        <div className="inline-flex items-center gap-3 bg-white/10 backdrop-blur-md border border-white/20 px-6 py-2 rounded-full mb-8 shadow-xl">
                            <Sparkles size={18} className="text-[#a78bfa] animate-pulse" />
                            <span className="text-white font-black uppercase tracking-[0.3em] text-[10px] italic">SIGILOS ORIGINAL GAME</span>
                        </div>
                        
                        <div className="relative">
                            <h1 className="text-5xl md:text-8xl lg:text-9xl font-black italic text-white leading-none tracking-tighter drop-shadow-[0_10px_0_rgba(0,0,0,0.2)]">
                                SIGIL<span className="text-[#a78bfa]">PHONE</span>
                            </h1>
                            <div className="absolute -bottom-2 md:-bottom-4 left-1/2 -translate-x-1/2 w-24 md:w-48 h-2 md:h-3 bg-[#5d3fd3] rounded-full skew-x-[-20deg] shadow-lg" />
                        </div>
                        
                        <p className="mt-12 text-white/60 text-lg font-bold uppercase tracking-[0.2em] italic max-w-lg mx-auto leading-relaxed">
                            Le téléphone arabe version <span className="text-white underline decoration-purple-500 decoration-[4px] underline-offset-4">AMAKNA !</span> Écris, dessine, et rigole.
                        </p>
                    </div>

                    {!session ? (
                        <div className="bg-white/10 backdrop-blur-xl border-4 border-white/20 p-12 rounded-[3.5rem] flex flex-col items-center gap-6 shadow-2xl">
                            <Loader2 className="h-12 w-12 animate-spin text-[#a78bfa]" />
                            <p className="text-white font-black uppercase tracking-widest text-sm italic">Connexion au réseau...</p>
                        </div>
                    ) : (
                        <div className="w-full flex flex-col items-center gap-8">
                            <div className="w-full bg-white/10 backdrop-blur-xl border-[8px] border-white/10 rounded-[4rem] p-10 md:p-14 flex flex-col items-center gap-10 hover:bg-white/[0.15] transition-all group shadow-2xl relative overflow-hidden">
                                <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />
                                
                                <div className="flex flex-col items-center gap-4 md:gap-6 z-10 transition-transform group-hover:scale-102 duration-500">
                                    <div className="w-16 h-16 md:w-20 md:h-20 bg-[#5d3fd3] rounded-2xl md:rounded-[1.5rem] flex items-center justify-center text-3xl md:text-5xl shadow-2xl border-b-4 md:border-b-8 border-black/20 group-hover:rotate-6 transition-all">
                                        🎮
                                    </div>
                                    <div className="text-center">
                                        <h3 className="text-white font-black text-xl md:text-3xl uppercase italic tracking-tighter">PRÊT POUR L'AVENTURE ?</h3>
                                        <p className="text-white/40 text-[9px] md:text-xs mt-2 font-black uppercase tracking-widest leading-none">Crée un salon et défie ta guilde !</p>
                                    </div>
                                </div>

                                <div className="w-full flex flex-col sm:flex-row gap-4 max-w-2xl">
                                    <button
                                        onClick={handleCreate}
                                        disabled={isCreating}
                                        className="flex-[2] py-5 md:py-7 rounded-2xl md:rounded-[2rem] bg-[#2ed573] hover:bg-[#26af5f] text-white font-black uppercase italic tracking-tighter text-lg md:text-2xl transition-all disabled:opacity-50 border-b-[6px] md:border-b-[10px] border-black/20 hover:translate-y-1 md:hover:translate-y-2 active:translate-y-2 active:border-b-0 shadow-2xl group flex items-center justify-center gap-4"
                                    >
                                        {isCreating ? (
                                            <Loader2 className="animate-spin h-6 w-6" />
                                        ) : (
                                            <>
                                                <span>NOUVEAU SALON</span>
                                                <ArrowRightCircle size={20} className="md:w-6 md:h-6 group-hover:translate-x-1 transition-transform" />
                                            </>
                                        )}
                                    </button>

                                    {availableRooms.length > 0 && (
                                        <div className="flex-[3] flex flex-col gap-3">
                                            {availableRooms.map(room => (
                                                <div key={room.roomId} className="bg-white/5 p-4 rounded-3xl border border-white/10 flex items-center justify-between group hover:bg-white/10 transition-all">
                                                    <div className="flex flex-col">
                                                        <span className="text-white font-black text-xs uppercase italic truncate max-w-[120px]">Salon de {room.roomId.slice(0, 6)}</span>
                                                        <span className="text-white/40 text-[9px] font-bold uppercase">{room.playerCount}/{room.maxPlayers} JOUEURS</span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <button 
                                                            onClick={() => handleJoin(room.roomId)}
                                                            className="px-4 py-2 bg-purple-500 hover:bg-purple-400 text-white font-black text-[10px] uppercase italic rounded-xl border-b-3 border-black/20 transition-all hover:scale-105"
                                                        >
                                                            Jouer
                                                        </button>
                                                        <button 
                                                            onClick={() => handleJoin(room.roomId, true)}
                                                            className="px-3 py-2 bg-white/5 hover:bg-white/10 text-white/40 hover:text-white font-black text-[9px] uppercase italic rounded-xl transition-all"
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

                            <div className="flex items-center gap-8 text-white/20 font-black text-[10px] uppercase tracking-[0.4em] italic">
                                <span className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" /> SERVEUR : ACTIF</span>
                                <div className="w-1 h-1 rounded-full bg-white/20" />
                                <span>VERSION 2.0.4</span>
                            </div>
                        </div>
                    )}
                </div>
            </GarticLayout>
        );
    }

    // ── PHASE GAME ──
    const currentUserId = session?.user?.id;
    const isHost = (currentUserId && gameState.hostId === currentUserId) ||
        gameState.players?.find((p: any) => p.id === socket?.id)?.isHost ||
        gameState.players?.[0]?.id === socket?.id ||
        gameState.hostId === socket?.id;

    const isDrawer = !isSpectatorMode && !!gameState.task;

    const renderPhase = () => {
        switch (gameState.phase) {
            case "LOBBY":
                return (
                    <LobbyScreen
                        room={{
                            id: currentRoomId || gameState.id,
                            maxPlayers: gameState.maxPlayers || 14,
                            players: gameState.players,
                            mode: gameState.mode || "NORMAL"
                        }}
                        onStart={() => socket?.emit("gartic:game:start")}
                        onInvite={() => {
                            navigator.clipboard.writeText(window.location.href).catch(() => {});
                            toast.success("Lien d'invitation copié !");
                        }}
                        onClose={handleExitToMenu}
                        isHost={isHost}
                    />
                );
            case "STARTING":
            case "INTERMISSION":
                return (
                    <div className="flex flex-col items-center justify-center h-full gap-6 animate-pulse">
                        <Loader2 className="h-20 w-20 text-purple-400 animate-spin" />
                        <h2 className="text-4xl font-black italic text-white uppercase tracking-tighter">
                            {gameState.phase === "STARTING" ? "La partie commence..." : "Préparation..."}
                        </h2>
                    </div>
                );
            case "WRITING":
                return (
                    <GuessingScreen
                        isDrawer={false}
                        isWriting={true}
                        wordCategory="Écris quelque chose !"
                        onSubmit={(text: string) => socket?.emit("gartic:text:submit", { text })}
                        socket={socket!}
                        timeLeft={gameState.timer || 0}
                        totalTime={gameState.maxTimer || 30}
                        round={gameState.round || 1}
                        totalRounds={gameState.players?.length || 1}
                        onClose={handleExitToMenu}
                        isSpectator={isSpectatorMode}
                    />
                );
            case "DRAWING":
                return (
                    <DrawingScreen
                        isDrawer={isDrawer}
                        word={gameState.task?.content}
                        wordHint="C'est ton tour de dessiner !"
                        drawerName={session?.user?.name || "Moi"}
                        socket={socket!}
                        roomId={currentRoomId!}
                        timeLeft={gameState.timer || 0}
                        totalTime={gameState.maxTimer || 60}
                        players={gameState.players || []}
                        round={gameState.round || 1}
                        totalRounds={gameState.players?.length || 1}
                        onClose={handleExitToMenu}
                        isSpectator={isSpectatorMode}
                    />
                );
            case "GUESSING":
                return (
                    <GuessingScreen
                        isDrawer={false}
                        wordHint="Devine ce qu'il a dessiné !"
                        wordCategory="Devinette"
                        currentWord={gameState.task?.content}
                        onSubmit={(text: string) => socket?.emit("gartic:text:submit", { text })}
                        socket={socket!}
                        timeLeft={gameState.timer || 0}
                        totalTime={gameState.maxTimer || 45}
                        round={gameState.round || 1}
                        totalRounds={gameState.players?.length || 1}
                        onClose={handleExitToMenu}
                        isSpectator={isSpectatorMode}
                    />
                );
            case "REVEAL":
                return (
                    <RevealScreen
                        albums={gameState.albums || []}
                        revealIndex={gameState.revealIndex ?? 0}
                        isHost={isHost}
                        onNextAlbum={() => socket?.emit("gartic:reveal:next")}
                        onExit={handleExitToMenu}
                        players={gameState.players || []}
                    />
                );
            case "SCORES":
                return (
                    <div className="flex flex-col items-center justify-center h-full w-full max-w-5xl mx-auto gap-12 animate-in fade-in zoom-in duration-700">
                        <div className="text-center px-4">
                            <div className="inline-flex items-center gap-3 bg-white/10 backdrop-blur-md border border-white/20 px-6 py-2 rounded-full mb-8 shadow-xl">
                                <Sparkles size={18} className="text-yellow-400 animate-pulse" />
                                <span className="text-white font-black uppercase tracking-[0.3em] text-[10px] italic">PARTIE TERMINÉE</span>
                            </div>
                            
                            <h2 className="text-4xl md:text-8xl font-black italic text-white uppercase leading-none tracking-tighter drop-shadow-[0_10px_0_rgba(0,0,0,0.2)] text-center">
                                MERCI D'AVOIR <span className="text-purple-300">JOUÉ !</span>
                            </h2>
                            <p className="mt-4 md:mt-8 text-white/60 text-sm md:text-xl font-bold uppercase tracking-[0.2em] italic max-w-2xl mx-auto leading-relaxed">
                                On espère que vous avez bien rigolé ! Prêt pour une autre session ?
                            </p>
                        </div>

                        <div className="w-full flex flex-wrap justify-center gap-6">
                            {gameState.players.map((p: any) => (
                                <div 
                                    key={p.id} 
                                    className="flex flex-col items-center gap-3 group"
                                >
                                    <div className="w-24 h-24 rounded-full border-[6px] border-white/10 bg-white/5 p-1 backdrop-blur-sm group-hover:scale-110 transition-transform duration-500">
                                        <img 
                                            src={p.userAvatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${p.username || p.userName}`} 
                                            alt="avatar" 
                                            className="w-full h-full object-cover rounded-full" 
                                        />
                                    </div>
                                    <span className="font-black text-white uppercase tracking-tighter text-sm italic group-hover:text-purple-300 transition-colors">
                                        {p.username || p.userName}
                                    </span>
                                </div>
                            ))}
                        </div>

                        <div className="flex flex-col sm:flex-row gap-4 md:gap-6 w-full max-w-2xl mt-4 md:mt-8">
                            <button 
                                onClick={handleReturnToLobby} 
                                className="flex-1 py-5 md:py-8 rounded-2xl md:rounded-[2.5rem] bg-[#2ed573] hover:bg-[#26af5f] text-white font-black uppercase italic tracking-tighter text-lg md:text-2xl transition-all border-b-[8px] md:border-b-[12px] border-black/20 hover:border-b-[4px] md:hover:border-b-[8px] hover:translate-y-1 active:translate-y-3 active:border-b-0 shadow-2xl flex items-center justify-center gap-3 md:gap-4 group"
                            >
                                <RefreshCw className="group-hover:rotate-180 transition-transform duration-700 w-6 h-6 md:w-8 md:h-8" />
                                <span>REOUVRIR</span>
                            </button>
                            
                            <button 
                                onClick={handleExitToMenu} 
                                className="flex-1 py-5 md:py-8 rounded-2xl md:rounded-[2.5rem] bg-[#ff4757] hover:bg-[#ff6b81] text-white font-black uppercase italic tracking-tighter text-lg md:text-2xl transition-all border-b-[8px] md:border-b-[12px] border-black/20 hover:border-b-[4px] md:hover:border-b-[8px] hover:translate-y-1 active:translate-y-3 active:border-b-0 shadow-2xl flex items-center justify-center gap-3 md:gap-4 group backdrop-blur-md"
                            >
                                <LogOut className="group-hover:-translate-x-1 transition-transform w-6 h-6 md:w-8 md:h-8" />
                                <span>QUITTER</span>
                            </button>
                        </div>
                    </div>
                );

            default:
                return (
                    <div className="flex flex-col items-center justify-center h-full text-white">
                        <Loader2 className="h-16 w-16 animate-spin mb-4" />
                        <h2 className="text-2xl font-black italic">Chargement...</h2>
                    </div>
                );
        }
    };

    return (
        <GarticLayout phase={gameState?.phase || "LOBBY"} onClose={handleExitToMenu}>
            {renderPhase()}
        </GarticLayout>
    );
}
